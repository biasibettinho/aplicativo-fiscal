
import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const AUX_LIST_ID = '53b6fecb-56e9-4917-ad5b-d46f10b47938';

const FIELD_MAP = {
  title: 'Title',
  invoiceNumber: 'Qualon_x00fa_merodaNF_x003f_',
  orderNumbers: 'Qualopedido_x0028_s_x0029__x003f',
  status: 'Status',
  branch: 'Filial',
  generalObservation: 'Observa_x00e7__x00e3_o',
  paymentMethod: 'MET_PAGAMENTO',
  pixKey: 'CAMPO_PIX',
  paymentDate: 'DATA_PAG',
  payee: 'PESSOA',
  statusManual: 'STATUS_ESPELHO_MANUAL',
  bank: 'BANCO',
  agency: 'AGENCIA',
  account: 'CONTA',
  accountType: 'TIPO_CONTA'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sanitizeFileName = (name: string) => {
  return name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[#%*:<>?/|\\"]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 80);
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
    reader.onerror = (error) => reject(error);
  });
};

async function parseGraphError(response: Response) {
  const requestId = response.headers.get('request-id') || 'N/A';
  let errorDetail = '';
  try {
    const body = await response.json();
    errorDetail = body.error?.message || JSON.stringify(body);
  } catch (e) {
    errorDetail = await response.text();
  }
  return `[${response.status}] ${errorDetail} (ReqID: ${requestId})`;
}

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      let allItems: any[] = [];
      let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields,attachments&$top=999`;

      while (nextUrl) {
        const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error(await parseGraphError(response));
        const data = await response.json();
        if (data.value) allItems = [...allItems, ...data.value];
        nextUrl = data['@odata.nextLink'] || null;
      }
      
      return allItems.map((item: any) => {
        const f = item.fields || {};
        return {
          id: item.id,
          mirrorId: parseInt(item.id, 10) || 0,
          title: f.Title || 'Sem Título',
          branch: f[FIELD_MAP.branch] || '',
          status: (f[FIELD_MAP.status] as RequestStatus) || RequestStatus.PENDENTE,
          orderNumbers: f[FIELD_MAP.orderNumbers] || '',
          invoiceNumber: f[FIELD_MAP.invoiceNumber] || '',
          payee: f[FIELD_MAP.payee] || '',
          paymentMethod: f[FIELD_MAP.paymentMethod] || '',
          pixKey: f[FIELD_MAP.pixKey] || '',
          paymentDate: f[FIELD_MAP.paymentDate] || '',
          bank: f[FIELD_MAP.bank] || '',
          agency: f[FIELD_MAP.agency] || '',
          account: f[FIELD_MAP.account] || '',
          accountType: f[FIELD_MAP.accountType] || '',
          generalObservation: f[FIELD_MAP.generalObservation] || '',
          statusManual: f[FIELD_MAP.statusManual] || '',
          createdAt: item.createdDateTime,
          updatedAt: item.lastModifiedDateTime,
          createdByUserId: item.createdBy?.user?.id || 'unknown',
          createdByName: item.createdBy?.user?.displayName || 'Sistema',
          attachments: (item.attachments || []).map((a: any) => ({
            id: a.id,
            fileName: a.name,
            storageUrl: a.contentBytes 
          }))
        };
      });
    } catch (e: any) {
      console.error(e);
      return [];
    }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber || '',
      [FIELD_MAP.orderNumbers]: data.orderNumbers || '',
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch || 'Matriz SP',
      [FIELD_MAP.paymentMethod]: data.paymentMethod,
      [FIELD_MAP.paymentDate]: data.paymentDate,
      [FIELD_MAP.payee]: data.payee || '',
      [FIELD_MAP.bank]: data.bank || '',
      [FIELD_MAP.agency]: data.agency || '',
      [FIELD_MAP.account]: data.account || '',
      [FIELD_MAP.accountType]: data.accountType || 'Conta Corrente',
      [FIELD_MAP.generalObservation]: data.generalObservation || '',
      [FIELD_MAP.pixKey]: data.pixKey || '',
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    
    if (!resp.ok) throw new Error(await parseGraphError(resp));
    return await resp.json();
  },

  uploadAttachment: async (accessToken: string, listId: string, itemId: string, file: File, customName: string, onLog?: (msg: string) => void) => {
    const extension = file.name.split('.').pop() || 'pdf';
    const fileName = `${sanitizeFileName(customName)}.${extension}`;
    const base64 = await fileToBase64(file);
    const attachmentEndpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/attachments`;

    const log = (m: string) => { console.log(m); if (onLog) onLog(m); };

    log(`Iniciando upload de ${fileName}...`);

    let ready = false;
    const maxRetries = 10;
    
    // LOOP DE PRONTIDÃO: Verifica se o endpoint /attachments existe antes de tentar o POST
    for (let i = 0; i < maxRetries; i++) {
      log(`Checando prontidão do segmento (tentativa ${i+1}/${maxRetries})...`);
      
      const check = await fetch(attachmentEndpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (check.ok) {
        ready = true;
        log(`Segmento 'attachments' detectado e pronto.`);
        break;
      }

      const errText = await check.text();
      if (errText.toLowerCase().includes('not found') || check.status === 404) {
        log(`SharePoint ainda não provisionou o recurso. Aguardando 5s...`);
        await delay(5000);
      } else {
        throw new Error(`Erro inesperado na verificação: ${await parseGraphError(check)}`);
      }
    }

    if (!ready) throw new Error("O SharePoint não liberou o espaço de anexos para este item a tempo.");

    log(`Executando POST para envio do arquivo...`);
    const resp = await fetch(attachmentEndpoint, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ name: fileName, contentBytes: base64 })
    });

    if (resp.ok) {
      log(`Sucesso: ${fileName} enviado.`);
      return true;
    }
    
    const finalErr = await parseGraphError(resp);
    log(`Erro no upload final: ${finalErr}`);
    throw new Error(finalErr);
  },

  async createAuxiliaryItem(accessToken: string, mainRequestId: string) {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${AUX_LIST_ID}/items`;
    await delay(1000);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Title: `Boleto Ref ID: ${mainRequestId}`, ID_SOLICITACAO: mainRequestId } })
    });
    if (!resp.ok) throw new Error(await parseGraphError(resp));
    return await resp.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const fields: any = {};
    Object.keys(data).forEach(key => {
      const spKey = FIELD_MAP[key as keyof typeof FIELD_MAP];
      if (spKey) fields[spKey] = (data as any)[key];
    });
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!resp.ok) throw new Error(await parseGraphError(resp));
    return await resp.json();
  }
};
