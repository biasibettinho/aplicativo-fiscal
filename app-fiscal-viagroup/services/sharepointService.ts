
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
const SITE_PATH = '/sites/Vialacteos'; 
const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';

// IDs das Listas (GUIDs)
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const SECONDARY_LIST_ID = '53b6fecb-384b-4388-90af-d46f10b47938';

// Nomes para Fallback (Baseado no log, parece haver espaço duplo)
const MAIN_LIST_TITLE = 'Lista  APP Fiscal'; 

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

async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[GRAPH ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

/**
 * Utilitário SharePoint REST com Redundância
 */
async function spFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const baseUrl = `https://${TENANT}${SITE_PATH}`;
  const url = `${baseUrl}${endpoint}`;
  
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    "Accept": "application/json;odata=verbose",
    ...options.headers,
  };
  
  return fetch(url, { ...options, headers });
}

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`;
      const response = await graphFetch(endpoint, accessToken);
      if (!response.ok) return [];
      
      const data = await response.json();
      return (data.value || []).map((item: any) => {
        const f = item.fields || {};
        const numericId = f.id || f.ID || parseInt(item.id, 10);
        const creatorId = item.createdBy?.user?.id || f.AuthorLookupId || '';

        return {
          id: numericId.toString(),
          mirrorId: numericId,
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
          createdByUserId: creatorId,
          createdByName: item.createdBy?.user?.displayName || f.AuthorDisplayName || 'Sistema',
          attachments: []
        };
      });
    } catch (e) {
      return [];
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      // TENTATIVA 1: Via GUID (Mais seguro)
      let endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      let response = await spFetch(endpoint, accessToken);
      
      // TENTATIVA 2: Fallback via Nome (Caso o GUID falhe por erro de path)
      if (!response.ok) {
        endpoint = `/_api/web/lists/getbytitle('${MAIN_LIST_TITLE}')/items(${itemId})/AttachmentFiles`;
        response = await spFetch(endpoint, accessToken);
      }

      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        const fileNameEncoded = encodeURIComponent(file.FileName);
        // Usamos a URL relativa do servidor que é garantida pelo SharePoint
        const binaryUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
        
        // Tenta baixar o blob para criar uma URL local (evita problemas de cookie/auth no <img>)
        try {
          const blobRes = await fetch(binaryUrl, { 
            headers: { Authorization: `Bearer ${accessToken}` } 
          });
          if (blobRes.ok) {
            const blob = await blobRes.blob();
            return {
              id: file.FileName,
              requestId: itemId,
              fileName: file.FileName,
              type: 'invoice_pdf',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl: URL.createObjectURL(blob),
              createdAt: new Date().toISOString()
            };
          }
        } catch (e) {}
        
        return {
          id: file.FileName,
          requestId: itemId,
          fileName: file.FileName,
          type: 'invoice_pdf',
          mimeType: 'application/pdf',
          size: 0,
          storageUrl: binaryUrl,
          createdAt: new Date().toISOString()
        };
      }));
    } catch (e) {
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    if (!requestId) return [];
    try {
      // Aqui o Graph é usado para localizar o item na lista secundária
      const filter = encodeURIComponent(`fields/ID_SOL eq '${requestId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const items = data.value || [];
      const results: Attachment[] = [];

      for (const item of items) {
        const numericSecondaryId = item.fields.id || item.fields.ID;
        const endpointAtts = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${numericSecondaryId})/AttachmentFiles`;
        const spRes = await spFetch(endpointAtts, accessToken);
        
        if (spRes.ok) {
          const spData = await spRes.json();
          const files = spData.d?.results || [];
          for (const file of files) {
            results.push({
              id: file.FileName,
              requestId,
              fileName: file.FileName,
              type: 'boleto',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl: `https://${TENANT}${file.ServerRelativeUrl}`,
              createdAt: item.createdDateTime
            });
          }
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber || '',
      [FIELD_MAP.orderNumbers]: data.orderNumbers || '',
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch || '',
      [FIELD_MAP.paymentMethod]: data.paymentMethod,
      [FIELD_MAP.paymentDate]: data.paymentDate,
      [FIELD_MAP.payee]: data.payee || '',
      [FIELD_MAP.bank]: data.bank || '',
      [FIELD_MAP.agency]: data.agency || '',
      [FIELD_MAP.account]: data.account || '',
      [FIELD_MAP.accountType]: data.accountType || '',
      [FIELD_MAP.pixKey]: data.pixKey || '',
      [FIELD_MAP.generalObservation]: data.generalObservation || '',
    };
    const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const response = await graphFetch(endpoint, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    if (!response.ok) throw new Error("Erro ao criar item");
    const item = await response.json();
    return { id: item.fields.id.toString(), ...item.fields };
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    if (data.status !== undefined) fields[FIELD_MAP.status] = data.status;
    if (data.statusManual !== undefined) fields[FIELD_MAP.statusManual] = data.statusManual;
    const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const response = await graphFetch(endpoint, accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!response.ok) throw new Error("Erro ao atualizar");
    return await response.json();
  },

  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, invoiceFiles: File[], ticketFiles: File[]): Promise<any> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  }
};
