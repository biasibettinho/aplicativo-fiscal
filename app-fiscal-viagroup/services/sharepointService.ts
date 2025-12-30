
import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
let CACHED_MAIN_LIST_ID = ''; 
let CACHED_AUX_LIST_ID = '';

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
  errorType: 'OBS_ERRO',
  errorObservation: 'OBS_CRIACAO',
  sharedWithUserId: 'SHARED_WITH',
  shareComment: 'COMENT_SHARE',
  bank: 'BANCO',
  agency: 'AGENCIA',
  account: 'CONTA',
  accountType: 'TIPO_CONTA'
};

/**
 * Sanitiza o nome do arquivo para o SharePoint
 */
const sanitizeFileName = (name: string) => {
  const parts = name.split('.');
  const extension = parts.length > 1 ? parts.pop() : 'pdf';
  const baseName = parts.join('.');
  
  return baseName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[#%*:<>?/|\\"]/g, '') // Caracteres proibidos no SharePoint
    .replace(/\s+/g, '_')           // Espaços por underline
    .substring(0, 100)              // Limite de caracteres
    + '.' + extension;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
    reader.onerror = (error) => reject(error);
  });
};

export const sharepointService = {
  resolveListIdByName: async (accessToken: string, listName: string, isMain: boolean = true) => {
    if (isMain && CACHED_MAIN_LIST_ID) return CACHED_MAIN_LIST_ID;
    if (!isMain && CACHED_AUX_LIST_ID) return CACHED_AUX_LIST_ID;

    try {
      const resp = await fetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      const list = data.value?.find((l: any) => 
        l.displayName.toLowerCase() === listName.toLowerCase() || 
        l.name.toLowerCase() === listName.toLowerCase() ||
        (isMain && l.displayName.toLowerCase().includes('sispag'))
      );
      
      if (list) {
        if (isMain) CACHED_MAIN_LIST_ID = list.id;
        else CACHED_AUX_LIST_ID = list.id;
        return list.id;
      }
    } catch (e) {
      console.error(`Erro ao resolver lista ${listName}:`, e);
    }
    return '';
  },

  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const listId = await sharepointService.resolveListIdByName(accessToken, 'solicitacoes_sispag_v2', true);
    if (!listId) return [];
    
    let allItems: any[] = [];
    let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields&$top=999`;

    try {
      while (nextUrl) {
        const response = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
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
        };
      });
    } catch (e) { return []; }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const listId = await sharepointService.resolveListIdByName(accessToken, 'solicitacoes_sispag_v2', true);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`;
    
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber,
      [FIELD_MAP.orderNumbers]: data.orderNumbers,
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch,
      [FIELD_MAP.paymentMethod]: data.paymentMethod,
      [FIELD_MAP.paymentDate]: data.paymentDate,
      [FIELD_MAP.payee]: data.payee,
      [FIELD_MAP.bank]: data.bank,
      [FIELD_MAP.agency]: data.agency,
      [FIELD_MAP.account]: data.account,
      [FIELD_MAP.accountType]: data.accountType,
      [FIELD_MAP.generalObservation]: data.generalObservation,
      [FIELD_MAP.pixKey]: data.pixKey,
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return resp.json();
  },

  uploadAttachment: async (accessToken: string, listId: string, itemId: string, file: File, customName?: string) => {
    // Se customName for passado, usa ele preservando a extensão original
    const extension = file.name.split('.').pop();
    const fileNameToSanitize = customName ? `${customName}.${extension}` : file.name;
    const fileName = sanitizeFileName(fileNameToSanitize);
    
    const base64 = await fileToBase64(file);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/attachments`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fileName, contentBytes: base64 })
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || "Erro no upload do anexo");
    }
    return true;
  },

  async createAuxiliaryItem(accessToken: string, mainRequestId: string, title: string) {
    const listId = await sharepointService.resolveListIdByName(accessToken, 'APP_Fiscal_AUX_ANEXOS', false);
    if (!listId) throw new Error("Lista auxiliar não encontrada.");
    
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { Title: `Boleto Ref ID: ${mainRequestId}`, ID_SOLICITACAO: mainRequestId } })
    });
    return resp.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const listId = await sharepointService.resolveListIdByName(accessToken, 'solicitacoes_sispag_v2', true);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/fields`;
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
    return resp.json();
  }
};
