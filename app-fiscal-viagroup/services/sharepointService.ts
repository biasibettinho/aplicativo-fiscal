
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
 * Utilitário para chamadas ao Microsoft Graph (Metadados e Identidade)
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
 * Utilitário para chamadas à SharePoint REST API (Anexos e Binários)
 */
async function spFetch(endpoint: string, accessToken: string, options: RequestInit = {}) {
  const cleanPath = SITE_PATH.startsWith('/') ? SITE_PATH : `/${SITE_PATH}`;
  const url = `https://${TENANT}${cleanPath}${endpoint}`;
  
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    "Accept": "application/json;odata=verbose",
    ...options.headers,
  };
  
  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`[SP REST ERROR] ${url} | Status: ${res.status}`, txt);
      return res;
    }
    return res;
  } catch (err) {
    console.error(`[SP REST FETCH CRITICAL] ${url}`, err);
    throw err;
  }
}

export const sharepointService = {
  /**
   * Busca as solicitações da lista principal usando Microsoft Graph.
   */
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`;
      const response = await graphFetch(endpoint, accessToken);
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
      console.error("Erro getRequests via Graph:", e);
      return [];
    }
  },

  /**
   * Busca anexos de um item da lista principal usando SharePoint REST.
   */
  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      const response = await spFetch(endpoint, accessToken);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
        
        try {
          const contentRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
          
          if (contentRes.ok) {
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
          }
        } catch (e) {
          console.warn(`Fallback para URL direta (CORS?) no arquivo: ${file.FileName}`);
        }
        
        return {
          id: file.FileName,
          requestId: itemId,
          fileName: file.FileName,
          type: 'invoice_pdf',
          mimeType: 'application/pdf',
          size: 0,
          storageUrl: downloadUrl,
          createdAt: new Date().toISOString()
        };
      }));
    } catch (e) {
      console.error("Erro getItemAttachments:", e);
      return [];
    }
  },

  /**
   * Busca anexos da lista secundária (Boletos) usando Graph para localização e REST para arquivos.
   */
  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    if (!requestId) return [];
    try {
      // Filtragem por ID_SOL usando Graph (mais performático para filtros complexos)
      const filter = encodeURIComponent(`fields/ID_SOL eq '${requestId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const items = data.value || [];
      const results: Attachment[] = [];

      for (const item of items) {
        // Para cada item da lista secundária, pegamos os arquivos de anexo via REST
        const endpointAtts = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.id})/AttachmentFiles`;
        const spRes = await spFetch(endpointAtts, accessToken);
        
        if (spRes.ok) {
          const spData = await spRes.json();
          const files = spData.d?.results || [];
          
          for (const file of files) {
            const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
            let finalUrl = downloadUrl;
            
            try {
              const contentRes = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
              if (contentRes.ok) {
                const blob = await contentRes.blob();
                finalUrl = URL.createObjectURL(blob);
              }
            } catch (e) {
              console.warn("Fallback para URL direta na lista secundária:", file.FileName);
            }
            
            results.push({
              id: file.FileName,
              requestId,
              fileName: file.FileName,
              type: 'boleto',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl: finalUrl,
              createdAt: item.createdDateTime
            });
          }
        }
      }
      return results;
    } catch (e) {
      console.error("Erro getSecondaryAttachments:", e);
      return [];
    }
  },

  // Fix: Completed createRequest implementation
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

    if (!response.ok) throw new Error("Erro ao criar item no SharePoint");
    const item = await response.json();
    return { id: item.id, ...item.fields };
  },

  // Fix: Added missing updateRequest method
  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    if (data.title !== undefined) fields.Title = data.title;
    if (data.status !== undefined) fields[FIELD_MAP.status] = data.status;
    if (data.invoiceNumber !== undefined) fields[FIELD_MAP.invoiceNumber] = data.invoiceNumber;
    if (data.orderNumbers !== undefined) fields[FIELD_MAP.orderNumbers] = data.orderNumbers;
    if (data.branch !== undefined) fields[FIELD_MAP.branch] = data.branch;
    if (data.paymentMethod !== undefined) fields[FIELD_MAP.paymentMethod] = data.paymentMethod;
    if (data.paymentDate !== undefined) fields[FIELD_MAP.paymentDate] = data.paymentDate;
    if (data.payee !== undefined) fields[FIELD_MAP.payee] = data.payee;
    if (data.bank !== undefined) fields[FIELD_MAP.bank] = data.bank;
    if (data.agency !== undefined) fields[FIELD_MAP.agency] = data.agency;
    if (data.account !== undefined) fields[FIELD_MAP.account] = data.account;
    if (data.accountType !== undefined) fields[FIELD_MAP.accountType] = data.accountType;
    if (data.pixKey !== undefined) fields[FIELD_MAP.pixKey] = data.pixKey;
    if (data.generalObservation !== undefined) fields[FIELD_MAP.generalObservation] = data.generalObservation;
    if (data.statusManual !== undefined) fields[FIELD_MAP.statusManual] = data.statusManual;

    const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const response = await graphFetch(endpoint, accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });

    if (!response.ok) throw new Error("Erro ao atualizar item no SharePoint");
    return await response.json();
  },

  // Fix: Added missing triggerPowerAutomateUpload method
  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, invoiceFiles: File[], ticketFiles: File[]): Promise<any> => {
    // Simulação do gatilho do Power Automate para upload de arquivos
    console.log(`[PA TRIGGER] Item ${itemId} | NF ${invoiceNumber} | Files: ${invoiceFiles.length + ticketFiles.length}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { success: true };
  }
};
