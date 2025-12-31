
import { PaymentRequest, RequestStatus, Attachment } from '../types';

const TENANT = 'vialacteoscombr.sharepoint.com';
const SITE_PATH = '/sites/Vialacteos'; 

// IDs das Listas (GUIDs) - Mais precisos que os títulos para chamadas REST
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
    console.error(`[SHAREPOINT REST ERROR] ${url}`, txt);
    return res;
  }
  return res;
}

export const sharepointService = {
  /**
   * Busca itens da lista principal usando SharePoint REST API em vez do Graph
   */
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      // Usamos a GUID da lista para máxima precisão. 
      // Selecionamos Author/Title para obter quem criou.
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items?$top=500&$select=*,Author/Title&$expand=Author`;
      const response = await spFetch(endpoint, accessToken);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const results = data.d?.results || [];

      return results.map((item: any) => {
        return {
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
        };
      });
    } catch (e) {
      console.error("Erro ao buscar solicitações via SP REST:", e);
      return [];
    }
  },

  /**
   * Busca anexos do item na lista principal usando o endpoint de AttachmentFiles
   */
  getItemAttachments: async (accessToken: string, itemId: string): Promise<Attachment[]> => {
    try {
      // Endpoint: /_api/web/lists(guid'...')/items(ID)/AttachmentFiles
      const endpoint = `/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      
      const response = await spFetch(endpoint, accessToken);
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return await Promise.all(files.map(async (file: any) => {
        // Para baixar o conteúdo, usamos a URL absoluta do servidor.
        const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
        
        // Chamada para obter o blob (binário) do arquivo com autenticação
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
        } else {
          // Fallback para URL direta se o fetch binário falhar
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
        }
      }));
    } catch (e) {
      console.error("Erro getItemAttachments via SharePoint REST:", e);
      return [];
    }
  },

  /**
   * Busca anexos na lista secundária filtrando itens pelo ID_SOL via SharePoint REST
   */
  getSecondaryAttachments: async (accessToken: string, requestId: string): Promise<Attachment[]> => {
    try {
      // 1. Localiza os itens na lista secundária (Boletos) vinculados ao ID_SOL
      const filter = encodeURIComponent(`ID_SOL eq '${requestId}'`);
      const endpointItems = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${filter}`;
      
      const resItems = await spFetch(endpointItems, accessToken);
      if (!resItems.ok) return [];
      
      const dataItems = await resItems.json();
      const items = dataItems.d?.results || [];
      const results: Attachment[] = [];

      // 2. Para cada item encontrado, busca seus arquivos anexos
      for (const item of items) {
        const endpointAtts = `/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})/AttachmentFiles`;
        const resAtts = await spFetch(endpointAtts, accessToken);
        
        if (resAtts.ok) {
          const dataAtts = await resAtts.json();
          const files = dataAtts.d?.results || [];
          
          for (const file of files) {
            const downloadUrl = `https://${TENANT}${file.ServerRelativeUrl}`;
            
            // Tentativa de carregar como Blob para evitar problemas de visualização
            const contentRes = await fetch(downloadUrl, {
               headers: { Authorization: `Bearer ${accessToken}` }
            });
            
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
              storageUrl: storageUrl,
              createdAt: item.Created
            });
          }
        }
      }
      return results;
    } catch (e) {
      console.error("Erro getSecondaryAttachments via SharePoint REST:", e);
      return [];
    }
  },

  /**
   * Cria um novo item na lista principal
   */
  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
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

  /**
   * Atualiza um item existente na lista principal
   */
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

  /**
   * Dispara o Power Automate para processamento de arquivos
   */
  triggerPowerAutomateUpload: async (itemId: string, invoiceNumber: string, invoiceFiles: File[], ticketFiles: File[]): Promise<any> => {
    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
      reader.onerror = reject;
    });

    const invoices = await Promise.all(invoiceFiles.map(async f => ({ fileName: f.name, content: await toBase64(f) })));
    const tickets = await Promise.all(ticketFiles.map(async f => ({ fileName: f.name, content: await toBase64(f) })));

    // Webhook URL do Flow de Integração (Placeholder)
    const FLOW_URL = 'https://prod-141.westus.logic.azure.com:443/workflows/da8673a0a38f4201889895066a98297b/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=pU0kI6_uT_v-L2w7-v8f8f8f8f8f8f8f8f8f8f8f8f8';

    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        invoiceNumber,
        invoices,
        tickets
      })
    });

    if (!res.ok) throw new Error("Falha ao notificar Power Automate.");
    return res;
  }
};
