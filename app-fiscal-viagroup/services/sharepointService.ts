
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
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[#%*:<>?/|\\"]/g, '').replace(/\s+/g, '_').substring(0, 80);
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Função para extrair detalhes técnicos de erros do Microsoft Graph
 */
async function parseGraphError(response: Response) {
  const requestId = response.headers.get('request-id') || 'N/A';
  const clientRequestId = response.headers.get('client-request-id') || 'N/A';
  const date = response.headers.get('date') || 'N/A';
  
  let errorDetail = 'Erro desconhecido';
  try {
    const body = await response.json();
    errorDetail = body.error?.message || JSON.stringify(body);
  } catch (e) {
    errorDetail = await response.text();
  }

  return `[MS-GRAPH-ERROR] 
Status: ${response.status}
Msg: ${errorDetail}
Request-ID: ${requestId}
Client-Request-ID: ${clientRequestId}
Date: ${date}`;
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

  uploadAttachment: async (accessToken: string, listId: string, itemId: string, file: File, customName: string) => {
    const extension = file.name.split('.').pop() || 'pdf';
    const fileName = `${sanitizeFileName(customName)}.${extension}`;
    const base64 = await fileToBase64(file);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/attachments`;

    let lastErrorMessage = '';
    const maxRetries = 6;

    for (let i = 0; i < maxRetries; i++) {
      try {
        // Delay progressivo (4s, 8s, 12s...) - SharePoint Online é lento para propagar anexos
        await delay(4000 * (i + 1));

        // Tenta verificar se o item e seu segmento de anexos já são visíveis
        const check = await fetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!check.ok) {
           lastErrorMessage = await parseGraphError(check);
           continue;
        }

        // Tenta o upload propriamente dito
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fileName, contentBytes: base64 })
        });

        if (resp.ok) return true;
        
        lastErrorMessage = await parseGraphError(resp);
        
        // Se o erro for "Resource not found for segment attachments", continuamos o loop
        if (!lastErrorMessage.toLowerCase().includes('attachments')) {
           throw new Error(lastErrorMessage);
        }

      } catch (e: any) {
        lastErrorMessage = e.message;
        if (!lastErrorMessage.toLowerCase().includes('attachments')) throw e;
      }
    }

    throw new Error(`O recurso de anexos do SharePoint não ficou pronto após ${maxRetries} tentativas.\n\nLOG TÉCNICO:\n${lastErrorMessage}`);
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
