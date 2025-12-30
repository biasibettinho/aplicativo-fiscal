
import { PaymentRequest, RequestStatus, Attachment } from '../types';

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
 * Função utilitária para chamadas ao Graph com lógica de retentativa e headers de preferência
 */
async function graphFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {},
  retries = 3
) {
  // Fix: Using 'any' for headers to prevent type mismatch with options.headers (HeadersInit)
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Prefer": "HonorNonIndexedQueriesWarning", // Crucial para filtros em colunas não indexadas
    ...options.headers,
  };

  let lastError: any;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.ok) return res;
      
      const errorText = await res.text();
      lastError = new Error(`Graph API ${res.status}: ${errorText}`);
      
      // Se for erro de rate limit ou servidor, espera um pouco antes de tentar de novo
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      break; 
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw lastError;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
    reader.onerror = (error) => reject(error);
  });
};

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      let allItems: any[] = [];
      let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=999`;

      while (nextUrl) {
        const response = await graphFetch(nextUrl, accessToken);
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
          orderNumbers: f['Qualopedido_x0028_s_x0029__x003f'] || f[FIELD_MAP.orderNumbers] || '',
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
          attachments: [] 
        };
      });
    } catch (e) {
      console.error("Erro ao listar solicitações:", e);
      return [];
    }
  },

  getAttachmentBlobUrl: async (accessToken: string, listId: string, itemId: string, attachmentId: string): Promise<string> => {
    try {
      const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/attachments/${attachmentId}/$value`;
      const response = await graphFetch(url, accessToken);
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error(`Erro ao baixar binário do anexo ${attachmentId}:`, e);
      return '';
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    try {
      const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/attachments`;
      const response = await graphFetch(url, accessToken);
      const data = await response.json();
      
      if (!data.value || data.value.length === 0) return [];

      const attachments = await Promise.all(data.value.map(async (a: any) => {
        const blobUrl = await sharepointService.getAttachmentBlobUrl(accessToken, MAIN_LIST_ID, itemId, a.id);
        if (!blobUrl) return null;
        
        return {
          id: a.id,
          requestId: itemId,
          fileName: a.name,
          type: 'invoice_pdf',
          mimeType: 'application/pdf',
          size: 0,
          storageUrl: blobUrl,
          createdAt: new Date().toISOString()
        };
      }));
      
      return attachments.filter(a => a !== null) as Attachment[];
    } catch (e) {
      console.error(`Erro ao capturar anexos do item ${itemId}:`, e);
      return [];
    }
  },

  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    try {
      // Tenta filtro por ID_SOL (String e Number como fallback)
      let items: any[] = [];
      const filters = [
        `fields/ID_SOL eq '${requestId}'`,
        `fields/ID_SOL eq ${requestId}`
      ];

      for (const filter of filters) {
        const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items?expand=fields&$filter=${filter}`;
        try {
          const res = await graphFetch(url, accessToken);
          const data = await res.json();
          if (data.value && data.value.length > 0) {
            items = data.value;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      const allAttachments: Attachment[] = [];

      for (const item of items) {
        const attUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${SECONDARY_LIST_ID}/items/${item.id}/attachments`;
        const attRes = await graphFetch(attUrl, accessToken);
        const attData = await attRes.json();
        
        if (attData.value) {
          const processed = await Promise.all(attData.value.map(async (a: any) => {
            const blobUrl = await sharepointService.getAttachmentBlobUrl(accessToken, SECONDARY_LIST_ID, item.id, a.id);
            if (!blobUrl) return null;
            return {
              id: a.id,
              requestId: requestId,
              fileName: a.name,
              type: 'boleto',
              mimeType: 'application/pdf',
              size: 0,
              storageUrl: blobUrl,
              createdAt: item.createdDateTime
            };
          }));
          allAttachments.push(...processed.filter(a => a !== null) as Attachment[]);
        }
      }
      
      return allAttachments;
    } catch (e) {
      console.error(`Erro no lookup de boletos para ${requestId}:`, e);
      return [];
    }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber || '',
      'Qualopedido_x0028_s_x0029__x003f': data.orderNumbers || '',
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

    const resp = await graphFetch(url, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
    
    return await resp.json();
  },

  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, nfs: File[], boletos: File[]) => {
    const POWER_AUTOMATE_URL = 'https://default7d9754b3dcdb4efe8bb7c0e5587b86.ed.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/279b9f46c29b485fa069720fb0f2a329/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sH0mJTwun6v7umv0k3OKpYP7nXVUckH2TnaRMXHfIj8';

    const mapFiles = async (files: File[]) => {
      return Promise.all(files.map(async (f) => ({
        name: f.name,
        content: await fileToBase64(f)
      })));
    };

    const body = {
      itemId,
      invoiceNumber,
      invoiceFiles: await mapFiles(nfs),
      ticketFiles: await mapFiles(boletos)
    };

    return fetch(POWER_AUTOMATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const fields: any = {};
    Object.keys(data).forEach(key => {
      const spKey = FIELD_MAP[key as keyof typeof FIELD_MAP];
      if (spKey) fields[spKey] = (data as any)[key];
    });
    
    const resp = await graphFetch(url, accessToken, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    
    return await resp.json();
  }
};
