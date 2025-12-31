
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
const SITE_PATH = '/sites/Vialacteos'; 

// GUIDs das Listas
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
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items?$top=500&$select=*,Author/Title&$expand=Author`;
      const response = await spFetch(endpoint, accessToken);
      if (!response.ok) return [];
      
      const data = await response.json();
      const results = data.d?.results || [];

      return results.map((item: any) => ({
        id: item.Id.toString(),
        mirrorId: item.Id,
        title: item.Title || 'Sem Título',
        branch: item[FIELD_MAP.branch] || '',
        status: (item[FIELD_MAP.status] as RequestStatus) || RequestStatus.PENDENTE,
        orderNumbers: item[FIELD_MAP.orderNumbers] || '',
        invoiceNumber: item[FIELD_MAP.invoiceNumber] || '',
        payee: item[FIELD_MAP.payee] || '',
        paymentMethod: item[FIELD_MAP.paymentMethod] || '',
        pixKey: item[FIELD_MAP.pixKey] || '',
        paymentDate: item[FIELD_MAP.paymentDate] || '',
        bank: item[FIELD_MAP.bank] || '',
        agency: item[FIELD_MAP.agency] || '',
        account: item[FIELD_MAP.account] || '',
        accountType: item[FIELD_MAP.accountType] || '',
        generalObservation: item[FIELD_MAP.generalObservation] || '',
        statusManual: item[FIELD_MAP.statusManual] || '',
        createdAt: item.Created,
        updatedAt: item.Modified,
        createdByUserId: item.AuthorId?.toString() || '',
        createdByName: item.Author?.Title || 'Sistema',
        attachments: []
      }));
    } catch (e) {
      console.error("Erro getRequests:", e);
      return [];
    }
  },

  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    try {
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      const response = await spFetch(endpoint, accessToken);
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
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
      const filter = encodeURIComponent(`ID_SOL eq '${requestId}'`);
      const endpointItems = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${filter}`;
      const resItems = await spFetch(endpointItems, accessToken);
      if (!resItems.ok) return [];
      
      const dataItems = await resItems.json();
      const items = dataItems.d?.results || [];
      const results: Attachment[] = [];

      for (const item of items) {
        const endpointAtts = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})/AttachmentFiles`;
        const resAtts = await spFetch(endpointAtts, accessToken);
        if (resAtts.ok) {
          const dataAtts = await resAtts.json();
          const files = dataAtts.d?.results || [];
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
              createdAt: item.Created
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
    // Para POST, precisamos do ListItemEntityTypeFullName. 
    // Em listas genéricas é SP.Data.NOME_DA_LISTAListItem
    const body: any = {
      '__metadata': { 'type': 'SP.Data.VialacteosListItem' }
    };

    Object.entries(data).forEach(([key, value]) => {
      const spField = (FIELD_MAP as any)[key];
      if (spField && value !== undefined) body[spField] = value;
    });

    const res = await spFetch(`/_api/web/lists(guid'${MAIN_LIST_ID}')/items`, accessToken, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;odata=verbose' },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Erro ao criar item no SharePoint");
    const json = await res.json();
    return { id: json.d.Id.toString() };
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const body: any = {
      '__metadata': { 'type': 'SP.Data.VialacteosListItem' }
    };

    Object.entries(data).forEach(([key, value]) => {
      const spField = (FIELD_MAP as any)[key];
      if (spField && value !== undefined) body[spField] = value;
    });

    const res = await spFetch(`/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})`, accessToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;odata=verbose',
        'IF-MATCH': '*',
        'X-HTTP-Method': 'MERGE'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) throw new Error("Erro ao atualizar item no SharePoint");
    return { success: true };
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
