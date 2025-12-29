
import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const AUX_LIST_ID = '53b6fecb-56e9-4917-ad5b-d46f10b47938';

// Mapeamento de nomes internos para nomes de sistema
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
  fiscalSendDate: 'Dataenvio_fiscal',
  finalizationDate: 'Datafinaliza_x00e7__x00e3_o',
  sharedWithUserId: 'SHARED_WITH',
  shareComment: 'COMENT_SHARE',
  // Campos bancários (Assumindo nomes padrão se não fornecidos anteriormente)
  bank: 'BANCO',
  agency: 'AGENCIA',
  account: 'CONTA',
  accountType: 'TIPO_CONTA'
};

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Falha ao conectar com SharePoint');
    }

    const data = await response.json();
    return data.value.map((item: any) => {
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
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber,
      [FIELD_MAP.orderNumbers]: data.orderNumbers,
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch || 'Matriz SP',
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
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro ao criar item no SharePoint');
    }

    return response.json();
  },

  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    
    const fields: any = {};
    if (data.status) fields[FIELD_MAP.status] = data.status;
    if (data.errorType) fields[FIELD_MAP.errorType] = data.errorType;
    if (data.errorObservation) fields[FIELD_MAP.errorObservation] = data.errorObservation;
    if (data.statusManual) fields[FIELD_MAP.statusManual] = data.statusManual;
    if (data.sharedWithUserId) fields[FIELD_MAP.sharedWithUserId] = data.sharedWithUserId;
    if (data.shareComment) fields[FIELD_MAP.shareComment] = data.shareComment;
    if (data.generalObservation) fields[FIELD_MAP.generalObservation] = data.generalObservation;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro ao atualizar item no SharePoint');
    }

    return response.json();
  }
};
