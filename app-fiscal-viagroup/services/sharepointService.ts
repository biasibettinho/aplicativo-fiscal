import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';

const FIELD_MAP = {
  title: 'Title',
  invoiceNumber: 'Qualon_x00fa_merodaNF_x003f_',
  orderNumbers: 'Qualopedido_x0028_s_x0029__x003f',
  status: 'Status',
  branch: 'Filial',
  generalObservation: 'Observa_x00e7__x00e3_o',
  mirrorId: 'ID_ESPELHO',
  paymentMethod: 'MET_PAGAMENTO',
  pixKey: 'CAMPO_PIX',
  paymentDate: 'DATA_PAG',
  payee: 'PESSOA',
  discountText: 'DESCONTO',
  statusManual: 'STATUS_ESPELHO_MANUAL',
  errorType: 'OBS_ERRO',
  errorObservation: 'OBS_CRIACAO',
  sharedWithUserId: 'SHARED_WITH',
  shareComment: 'COMENT_SHARE',
  bank: 'BANCO',
  agency: 'AGENCIA',
  account: 'CONTA',
  accountType: 'TIPO_CONTA'
};

export const sharepointService = {
  // 👇 ESTA FUNÇÃO faz paginação COMPLETA (>2000 itens!)
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const allRequests: PaymentRequest[] = [];
    let url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=5000`;

    while (url) {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Falha SharePoint');
      }

      const data = await response.json();
      const pageRequests = data.value.map((item: any) => {
        const f = item.fields;
        return {
          id: item.id,
          mirrorId: f[FIELD_MAP.mirrorId] || 0,
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
          discountText: f[FIELD_MAP.discountText] || '',
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

      allRequests.push(...pageRequests);
      url = data['@odata.nextLink'];  // 👈 PAGINAÇÃO AQUI!
    }

    console.log(`✅ ${allRequests.length} itens carregados!`);
    return allRequests;
  },

  // Mantém as outras funções iguais
  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch || 'Matriz SP',
      // ... outros campos
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) throw new Error('Erro criar item');
    return response.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const fields: any = {};
    
    Object.entries(data).forEach(([key, value]) => {
      if (value && FIELD_MAP[key as keyof typeof FIELD_MAP]) {
        fields[FIELD_MAP[key as keyof typeof FIELD_MAP] as string] = value;
      }
    });

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields)
    });

    if (!response.ok) throw new Error('Erro atualizar item');
    return response.json();
  },
};
