
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
const SITE_PATH = '/sites/Vialacteos'; 
const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';

// IDs das Listas (GUIDs)
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
 * Chamada ao Microsoft Graph (Melhor para metadados e identidade)
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
    console.error(`[GRAPH ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

/**
 * Chamada à SharePoint REST API (Melhor para arquivos binários/anexos)
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
    console.error(`[SP REST ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      // Usamos Graph para buscar a lista de itens pois ele retorna o ID do Azure AD correto para filtros
      const response = await graphFetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`, accessToken);
      if (!response.ok) return [];
      
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
      console.error("Erro ao buscar solicitações via Graph:", e);
      return [];
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    try {
      // Usamos REST API para anexos
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      const response = await spFetch(endpoint, accessToken);
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
        // Faz o download binário autenticado para gerar um Blob local e evitar problemas de cross-origin/auth no visualizador
        const contentRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        let storageUrl = downloadUrl;
        if (contentRes.ok) {
          const blob = await contentRes.blob();
          storageUrl = URL.createObjectURL(blob);
        }
        
        return {
          id: file.FileName,
          requestId: itemId,
          fileName: file.FileName,
          type: 'invoice_pdf',
          mimeType: 'application/pdf',
          size: 0,
          storageUrl,
          createdAt: new Date().toISOString()
        };
      }));
    } catch (e) {
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    try {
      // 1. Localiza itens na lista secundária vinculados ao ID_SOL via Graph (mais rápido para busca)
      const filter = encodeURIComponent(`fields/ID_SOL eq '${requestId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const results: Attachment[] = [];

      // 2. Busca anexos binários via REST API para cada item encontrado
      for (const item of (data.value || [])) {
        const endpointAtts = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.id})/AttachmentFiles`;
        const spRes = await spFetch(endpointAtts, accessToken);
        
        if (spRes.ok) {
          const spData = await spRes.json();
          const files = spData.d?.results || [];
          
          for (const file of files) {
            const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
            const contentRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            
            let storageUrl = downloadUrl;
            if (contentRes.ok) {
              const blob = await contentRes.blob();
              storageUrl = URL.createObjectURL(blob);
            }
            
            results.push({
              id: file.FileName,
              requestId,
              fileName: file.FileName,
              type: 'boleto',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl,
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

  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, invoiceFiles: File[], ticketFiles: File[]): Promise<any> => {
    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = reject;
    });

    const invoices = await Promise.all(invoiceFiles.map(async f => ({ fileName: f.name, content: await toBase64(f) })));
    const tickets = await Promise.all(ticketFiles.map(async f => ({ fileName: f.name, content: await toBase64(f) })));

    const FLOW_URL = 'https://prod-141.westus.logic.azure.com:443/workflows/da8673a0a38f4201889895066a98297b/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pU0kI6_uT_v-L2w7-v8f8f8f8f8f8f8f8f8f8f8f8f8';

    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, invoiceNumber, invoices, tickets })
    });

    return res;
  }
};
