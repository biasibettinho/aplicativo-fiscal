
import { PaymentRequest, RequestStatus, Attachment } from '../types';
import { authService } from './authService';

/**
 * CONFIGURAÇÕES REAIS DO AMBIENTE VIA LACTEOS
 */
const SITE_URL = 'https://vialacteoscombr.sharepoint.com/sites/Powerapps';
const BASE_URL = 'https://vialacteoscombr.sharepoint.com';
const GRAPH_SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const SECONDARY_LIST_ID = '53b6fecb-56e9-4917-ad5b-d46f10b47938';

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

function mapRequestToFields(data: Partial<PaymentRequest>) {
  const fields: any = {};
  if (data.title !== undefined) fields[FIELD_MAP.title] = data.title;
  if (data.invoiceNumber !== undefined) fields[FIELD_MAP.invoiceNumber] = data.invoiceNumber;
  if (data.orderNumbers !== undefined) fields[FIELD_MAP.orderNumbers] = data.orderNumbers;
  if (data.status !== undefined) fields[FIELD_MAP.status] = data.status;
  if (data.branch !== undefined) fields[FIELD_MAP.branch] = data.branch;
  if (data.generalObservation !== undefined) fields[FIELD_MAP.generalObservation] = data.generalObservation;
  if (data.paymentMethod !== undefined) fields[FIELD_MAP.paymentMethod] = data.paymentMethod;
  if (data.pixKey !== undefined) fields[FIELD_MAP.pixKey] = data.pixKey;
  if (data.paymentDate !== undefined) fields[FIELD_MAP.paymentDate] = data.paymentDate;
  if (data.payee !== undefined) fields[FIELD_MAP.payee] = data.payee;
  if (data.statusManual !== undefined) fields[FIELD_MAP.statusManual] = data.statusManual;
  if (data.bank !== undefined) fields[FIELD_MAP.bank] = data.bank;
  if (data.agency !== undefined) fields[FIELD_MAP.agency] = data.agency;
  if (data.account !== undefined) fields[FIELD_MAP.account] = data.account;
  if (data.accountType !== undefined) fields[FIELD_MAP.accountType] = data.accountType;
  return fields;
}

async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[MS GRAPH ERROR] URL: ${url}`, { status: res.status, errorBody: txt });
    return res;
  }
  return res;
}

/**
 * Função auxiliar para chamadas à API REST nativa do SharePoint com token de audiência correta
 */
async function spRestFetch(url: string, options: RequestInit = {}) {
  const spToken = await authService.getSharePointToken();
  if (!spToken) {
    console.error("[SP REST] Falha ao adquirir token de audiência SharePoint.");
    return new Response(null, { status: 401 });
  }

  const headers: any = {
    Authorization: `Bearer ${spToken}`,
    'Accept': 'application/json;odata=verbose',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`[SP REST ERROR] URL: ${url}`, { status: res.status, errorBody: txt });
    return res;
  }
  return res;
}

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`;
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

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    try {
      const fields = mapRequestToFields(data);
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items`;
      const response = await graphFetch(endpoint, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error("Erro createRequest:", e);
      return null;
    }
  },

  updateRequest: async (accessToken: string, graphId: string, data: Partial<PaymentRequest>): Promise<any> => {
    try {
      const fields = mapRequestToFields(data);
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/fields`;
      const response = await graphFetch(endpoint, accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error("Erro updateRequest:", e);
      return null;
    }
  },

  /**
   * Busca anexos da Nota Fiscal Principal usando API REST nativa.
   * Isolado para garantir que funcione independentemente de outras listas.
   */
  getItemAttachments: async (unusedToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      
      const response = await spRestFetch(endpoint);
      if (!response.ok) return [];
      
      const data = await response.json();
      const files = data.d?.results || [];

      return files.map((file: any) => ({
        id: file.FileName,
        requestId: itemId,
        fileName: file.FileName,
        type: 'invoice_pdf',
        mimeType: 'application/pdf',
        size: 0,
        storageUrl: `${BASE_URL}${file.ServerRelativeUrl}`,
        createdAt: new Date().toISOString()
      }));
    } catch (e) {
      console.error("Erro getItemAttachments (Main Invoice):", e);
      return [];
    }
  },

  /**
   * Busca anexos da lista secundária (Boletos e Comprovantes) usando API REST nativa.
   * Realiza o filtro por ID_SOL e itera por cada item encontrado para recuperar seus arquivos.
   */
  getSecondaryAttachments: async (unusedToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      // Passo A: Filtro na lista secundária
      const filter = `ID_SOL eq '${itemId}'`;
      const findItemUrl = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${encodeURIComponent(filter)}&$select=Id,Attachments`;
      
      const findResponse = await spRestFetch(findItemUrl);
      if (!findResponse.ok) return [];
      
      const findData = await findResponse.json();
      // Passo B: Verifica d.results (JSON Verbose)
      const secondaryItems = findData.d?.results || [];
      
      const allSecondaryAttachments: Attachment[] = [];

      // Passo C: Loop pelos itens encontrados
      for (const item of secondaryItems) {
        if (item.Attachments) {
          const attUrl = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})/AttachmentFiles`;
          const attResponse = await spRestFetch(attUrl);
          
          if (attResponse.ok) {
            const attData = await attResponse.json();
            const files = attData.d?.results || [];
            
            files.forEach((file: any) => {
              allSecondaryAttachments.push({
                id: `${item.Id}_${file.FileName}`,
                requestId: itemId,
                fileName: file.FileName,
                type: 'boleto',
                mimeType: 'application/pdf',
                size: 0,
                // Combinação da base com ServerRelativeUrl
                storageUrl: `${BASE_URL}${file.ServerRelativeUrl}`,
                createdAt: new Date().toISOString()
              });
            });
          }
        }
      }

      return allSecondaryAttachments;
    } catch (e) {
      console.error("Erro getSecondaryAttachments (Boletos):", e);
      return []; // Retorna vazio em caso de erro para não quebrar a NF principal
    }
  }
};
