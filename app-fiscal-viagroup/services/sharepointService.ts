
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
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
 * Função auxiliar para baixar o conteúdo binário de um anexo via Graph
 */
async function downloadAttachmentContent(accessToken: string, downloadUrl: string): Promise<string> {
  try {
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return '';
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error("Erro ao converter anexo para Blob:", e);
    return '';
  }
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
        // No Graph, precisamos do ID do item da lista (e não o GUID do item)
        const numericId = f.id || f.ID || item.id;
        const creatorId = item.createdBy?.user?.id || f.AuthorLookupId || '';

        let pDate = f[FIELD_MAP.paymentDate] || '';
        if (pDate && !pDate.includes('T')) pDate = new Date(pDate).toISOString();

        return {
          id: numericId.toString(),
          graphId: item.id, // Guardamos o ID do Graph para operações de anexo
          mirrorId: parseInt(numericId.toString(), 10),
          title: f.Title || 'Sem Título',
          branch: f[FIELD_MAP.branch] || '',
          status: (f[FIELD_MAP.status] as RequestStatus) || RequestStatus.PENDENTE,
          orderNumbers: f[FIELD_MAP.orderNumbers] || '',
          invoiceNumber: f[FIELD_MAP.invoiceNumber] || '',
          payee: f[FIELD_MAP.payee] || '',
          paymentMethod: f[FIELD_MAP.paymentMethod] || '',
          pixKey: f[FIELD_MAP.pixKey] || '',
          paymentDate: pDate,
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
      console.error("Erro getRequests:", e);
      return [];
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      // USANDO GRAPH API EM VEZ DE REST API (Resolve erro 401)
      // O itemId aqui deve ser o ID do Graph (string longa) ou o ID numérico (testamos ambos)
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/attachments`;
      const response = await graphFetch(endpoint, accessToken);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.value || [];

      return await Promise.all(files.map(async (file: any) => {
        // No Graph v1.0, o conteúdo pode ser acessado via endpoint /$value
        const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/attachments/${file.id}/$value`;
        const blobUrl = await downloadAttachmentContent(accessToken, downloadUrl);

        return {
          id: file.id,
          requestId: itemId,
          fileName: file.name,
          type: 'invoice_pdf',
          mimeType: file.contentType || 'application/pdf',
          size: file.size || 0,
          storageUrl: blobUrl || downloadUrl,
          createdAt: file.lastModifiedDateTime || new Date().toISOString()
        };
      }));
    } catch (e) {
      console.error("Erro getItemAttachments via Graph:", e);
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    if (!requestId) return [];
    try {
      const filter = encodeURIComponent(`fields/ID_SOL eq '${requestId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const items = data.value || [];
      const results: Attachment[] = [];

      for (const item of items) {
        const attEndpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items/${item.id}/attachments`;
        const attRes = await graphFetch(attEndpoint, accessToken);
        
        if (attRes.ok) {
          const attData = await attRes.json();
          const files = attData.value || [];
          for (const file of files) {
            const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items/${item.id}/attachments/${file.id}/$value`;
            const blobUrl = await downloadAttachmentContent(accessToken, downloadUrl);

            results.push({
              id: file.id,
              requestId,
              fileName: file.name,
              type: 'boleto',
              mimeType: file.contentType || 'application/pdf',
              size: file.size || 0,
              storageUrl: blobUrl || downloadUrl,
              createdAt: item.createdDateTime
            });
          }
        }
      }
      return results;
    } catch (e) {
      console.error("Erro getSecondaryAttachments via Graph:", e);
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
    return { id: item.id, ...item.fields };
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    if (data.status !== undefined) fields[FIELD_MAP.status] = data.status;
    if (data.statusManual !== undefined) fields[FIELD_MAP.statusManual] = data.statusManual;
    
    // O itemId para o Graph pode ser o ID numérico ou o ID de string.
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
