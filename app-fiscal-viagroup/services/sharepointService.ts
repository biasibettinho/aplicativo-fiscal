
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
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

async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`[GRAPH WARN] ${url}`, txt);
    return res;
  }
  return res;
}

async function downloadAttachmentContent(accessToken: string, downloadUrl: string): Promise<string> {
  try {
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) return '';
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch (e) {
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
        const numericId = f.id || f.ID || item.id;
        const creatorId = item.createdBy?.user?.id || f.AuthorLookupId || '';

        let pDate = f[FIELD_MAP.paymentDate] || '';
        if (pDate && !pDate.includes('T')) pDate = new Date(pDate).toISOString();

        return {
          id: numericId.toString(),
          graphId: item.id, 
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

  getItemAttachments: async (accessToken: string, graphId: string): Promise<Attachment[]> => {
    if (!graphId) return [];
    try {
      // Tentativa 1: Endpoint direto de anexos
      let endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/attachments`;
      let response = await graphFetch(endpoint, accessToken);
      
      let files = [];
      if (response.ok) {
        const data = await response.json();
        files = data.value || [];
      } else {
        // Fallback: Busca o item expandindo anexos
        const fallbackUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}?expand=attachments`;
        const fbRes = await graphFetch(fallbackUrl, accessToken);
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          files = fbData.attachments || [];
        }
      }

      if (files.length === 0) return [];

      return await Promise.all(files.map(async (file: any) => {
        const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/attachments/${file.id}/$value`;
        const blobUrl = await downloadAttachmentContent(accessToken, downloadUrl);

        return {
          id: file.id,
          requestId: graphId,
          fileName: file.name,
          type: 'invoice_pdf',
          mimeType: file.contentType || 'application/pdf',
          size: file.size || 0,
          storageUrl: blobUrl || downloadUrl,
          createdAt: file.lastModifiedDateTime || new Date().toISOString()
        };
      }));
    } catch (e) {
      console.error("Erro getItemAttachments:", e);
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, numericId: string): Promise<Attachment[]> => {
    if (!numericId) return [];
    try {
      const filter = encodeURIComponent(`fields/ID_SOL eq '${numericId}'`);
      const graphUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields,attachments&$filter=${filter}`;
      const res = await graphFetch(graphUrl, accessToken);
      
      if (!res.ok) return [];
      const data = await res.json();
      const items = data.value || [];
      const results: Attachment[] = [];

      for (const item of items) {
        const files = item.attachments || [];
        for (const file of files) {
          const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items/${item.id}/attachments/${file.id}/$value`;
          const blobUrl = await downloadAttachmentContent(accessToken, downloadUrl);

          results.push({
            id: file.id,
            requestId: numericId,
            fileName: file.name,
            type: 'boleto',
            mimeType: file.contentType || 'application/pdf',
            size: file.size || 0,
            storageUrl: blobUrl || downloadUrl,
            createdAt: item.createdDateTime
          });
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  },

  // Fix: Added the missing createRequest function called by requestService
  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    Object.entries(data).forEach(([key, value]) => {
      const fieldName = (FIELD_MAP as any)[key];
      if (fieldName && value !== undefined) {
        fields[fieldName] = value;
      }
    });

    const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const response = await graphFetch(endpoint, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    if (!response.ok) throw new Error("Erro ao criar solicitação no SharePoint");
    return await response.json();
  },

  updateRequest: async (accessToken: string, graphId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const fields: any = {};
    // Fix: Updated to map all provided fields using FIELD_MAP
    Object.entries(data).forEach(([key, value]) => {
      const fieldName = (FIELD_MAP as any)[key];
      if (fieldName && value !== undefined) {
        fields[fieldName] = value;
      }
    });
    
    const endpoint = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/fields`;
    const response = await graphFetch(endpoint, accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    if (!response.ok) throw new Error("Erro ao atualizar");
    return await response.json();
  }
};
