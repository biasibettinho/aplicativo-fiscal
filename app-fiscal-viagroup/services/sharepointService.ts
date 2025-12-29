
import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
// IMPORTANTE: Atualize o ID abaixo com o ID da nova lista que você criou
let CACHED_LIST_ID = 'NOVA_LISTA_ID_AQUI'; 

const FIELD_MAP = {
  title: 'Title',
  invoiceNumber: 'invoice_number',
  orderNumbers: 'order_numbers',
  status: 'status',
  branch: 'branch',
  generalObservation: 'general_observation',
  paymentMethod: 'payment_method',
  pixKey: 'pix_key',
  paymentDate: 'payment_date',
  payee: 'payee',
  statusManual: 'status_manual',
  errorType: 'error_type',
  errorObservation: 'error_observation',
  sharedWithUserId: 'shared_with_user_id',
  shareComment: 'share_comment',
  bank: 'bank',
  agency: 'agency',
  account: 'account',
  accountType: 'account_type'
};

export const sharepointService = {
  resolveListId: async (accessToken: string) => {
    if (CACHED_LIST_ID !== 'NOVA_LISTA_ID_AQUI') return CACHED_LIST_ID;
    try {
      const resp = await fetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      const list = data.value.find((l: any) => l.displayName === 'Solicitacoes_SisPag_v2');
      if (list) {
        CACHED_LIST_ID = list.id;
        return list.id;
      }
    } catch (e) {
      console.error("Erro ao resolver ID da lista:", e);
    }
    return CACHED_LIST_ID;
  },

  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const listId = await sharepointService.resolveListId(accessToken);
    if (listId === 'NOVA_LISTA_ID_AQUI') return [];

    let allItems: any[] = [];
    // Adicionado $top=999 e loop para seguir o nextLink (paginação)
    let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields&$top=999`;

    try {
      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) break;

        const data = await response.json();
        allItems = [...allItems, ...data.value];
        nextUrl = data['@odata.nextLink'] || null;
      }

      return allItems.map((item: any) => {
        const f = item.fields;
        // Fix: Added mirrorId to match PaymentRequest interface.
        // We use parseInt on item.id as SharePoint list IDs are numerical strings.
        return {
          id: item.id,
          mirrorId: parseInt(item.id, 10) || 0,
          title: f.Title || '',
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
          errorType: f[FIELD_MAP.errorType] || '',
          errorObservation: f[FIELD_MAP.errorObservation] || '',
          sharedWithUserId: f[FIELD_MAP.sharedWithUserId] || '',
          shareComment: f[FIELD_MAP.shareComment] || '',
          createdAt: item.createdDateTime,
          updatedAt: item.lastModifiedDateTime,
          createdByUserId: item.createdBy?.user?.id,
          createdByName: item.createdBy?.user?.displayName,
        };
      });
    } catch (error) {
      console.error("Erro ao buscar dados no SharePoint:", error);
      return [];
    }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const listId = await sharepointService.resolveListId(accessToken);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items`;
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber,
      [FIELD_MAP.orderNumbers]: data.orderNumbers,
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch,
      [FIELD_MAP.paymentMethod]: data.paymentMethod,
      [FIELD_MAP.paymentDate]: data.paymentDate,
      [FIELD_MAP.payee]: data.payee,
      [FIELD_MAP.bank]: data.bank,
      [FIELD_MAP.agency]: data.agency,
      [FIELD_MAP.account]: data.account,
      [FIELD_MAP.accountType]: data.accountType,
      [FIELD_MAP.generalObservation]: data.generalObservation,
      [FIELD_MAP.pixKey]: data.pixKey,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    return response.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const listId = await sharepointService.resolveListId(accessToken);
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/fields`;
    const fields: any = {};
    Object.keys(data).forEach(key => {
      if (FIELD_MAP[key as keyof typeof FIELD_MAP]) {
        fields[FIELD_MAP[key as keyof typeof FIELD_MAP]] = (data as any)[key];
      }
    });
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });
    return response.json();
  }
};
