
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
const SITE_PATH = '/sites/Vialacteos'; // Ajuste o path se necessário (ex: /sites/Fiscal)
const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const SECONDARY_LIST_ID = '53b6fecb-384b-4388-90af-d46f10b47938';

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

/**
 * Utilitário para chamadas ao Microsoft Graph
 */
async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[GRAPH ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

/**
 * Utilitário para chamadas à SharePoint REST API
 */
async function spFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const url = `https://${TENANT}${SITE_PATH}${endpoint}`;
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json;odata=verbose",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[SHAREPOINT REST ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const response = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`, accessToken);
      const data = await response.json();
      return (data.value || []).map((item: any) => {
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
          createdByUserId: item.createdBy?.user?.id || '',
          createdByName: item.createdBy?.user?.displayName || 'Sistema',
          attachments: []
        };
      });
    } catch (e) {
      return [];
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    try {
      // Endpoint sugerido: AttachmentFiles via SharePoint REST API
      const endpoint = `/_api/web/lists/getbyid('${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      const response = await spFetch(endpoint, accessToken);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        // Para baixar o conteúdo, usamos o ServerRelativeUrl
        const downloadEndpoint = `/_api/web/GetFileByServerRelativeUrl('${file.ServerRelativeUrl}')/$value`;
        const contentRes = await spFetch(downloadEndpoint, accessToken);
        const blob = await contentRes.blob();
        
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
      }));
    } catch (e) {
      console.error("Erro ao buscar anexos via SharePoint REST:", e);
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    try {
      // 1. Localiza os itens na lista secundária que referenciam o ID da solicitação (via Graph)
      const filter = encodeURIComponent(`fields/ID_SOL eq '${requestId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const results: Attachment[] = [];

      // 2. Para cada item encontrado, busca seus anexos via SharePoint REST API
      for (const item of (data.value || [])) {
        const endpoint = `/_api/web/lists/getbyid('${SECONDARY_LIST_ID}')/items(${item.id})/AttachmentFiles`;
        const spRes = await spFetch(endpoint, accessToken);
        
        if (spRes.ok) {
          const spData = await spRes.json();
          const files = spData.d?.results || [];
          
          for (const file of files) {
            const downloadEndpoint = `/_api/web/GetFileByServerRelativeUrl('${file.ServerRelativeUrl}')/$value`;
            const contentRes = await spFetch(downloadEndpoint, accessToken);
            const blob = await contentRes.blob();
            
            results.push({
              id: file.FileName,
              requestId,
              fileName: file.FileName,
              type: 'boleto',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl: URL.createObjectURL(blob),
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
    const resp = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    return await resp.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    Object.keys(data).forEach(key => {
      const spKey = (FIELD_MAP as any)[key];
      if (spKey) fields[spKey] = (data as any)[key];
    });
    const resp = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`, accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    return await resp.json();
  },

  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, nfs: File[], boletos: File[]) => {
    const url = 'https://default7d9754b3dcdb4efe8bb7c0e5587b86.ed.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/279b9f46c29b485fa069720fb0f2a329/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sH0mJTwun6v7umv0k3OKpYP7nXVUckH2TnaRMXHfIj8';
    const toB64 = (f: File): Promise<any> => new Promise((res) => {
      const r = new FileReader();
      r.onload = () => res({ name: f.name, content: (r.result as string).split(',')[1] });
      r.readAsDataURL(f);
    });
    const body = {
      itemId,
      invoiceNumber,
      invoiceFiles: await Promise.all(nfs.map(toB64)),
      ticketFiles: await Promise.all(boletos.map(toB64))
    };
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }
};
