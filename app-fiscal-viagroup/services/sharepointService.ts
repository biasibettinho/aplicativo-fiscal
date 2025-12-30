import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';

// Mapeamento exato dos campos internos do seu SharePoint
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
  sharedWithUserId: 'SHARED_WITH_ID'
};

export const sharepointService = {
  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields`;

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error('Erro ao buscar dados do SharePoint');
    
    const data = await response.json();

    return data.value.map((item: any) => {
      const f = item.fields;
      return {
        id: item.id,
        title: f.Title || '',
        invoiceNumber: f[FIELD_MAP.invoiceNumber] || '',
        orderNumbers: f[FIELD_MAP.orderNumbers] || '',
        status: (f[FIELD_MAP.status] as RequestStatus) || RequestStatus.PENDENTE,
        branch: f[FIELD_MAP.branch] || '',
        generalObservation: f[FIELD_MAP.generalObservation] || '',
        mirrorId: f[FIELD_MAP.mirrorId] || 0,
        paymentMethod: f[FIELD_MAP.paymentMethod] || '',
        pixKey: f[FIELD_MAP.pixKey] || '',
        paymentDate: f[FIELD_MAP.paymentDate] || '',
        payee: f[FIELD_MAP.payee] || '',
        discountText: f[FIELD_MAP.discountText] || '',
        statusManual: f[FIELD_MAP.statusManual] || '',
        errorType: f[FIELD_MAP.errorType] || '',
        errorObservation: f[FIELD_MAP.errorObservation] || '',
        sharedWithUserId: f[FIELD_MAP.sharedWithUserId] || '',
        hasAttachments: !!f.Attachments, // Converte para booleano
        createdAt: item.createdDateTime,
        updatedAt: item.lastModifiedDateTime,
        createdByUserId: item.createdBy?.user?.id || '',
        createdByName: item.createdBy?.user?.displayName || 'Usuário SharePoint'
      };
    });
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    
    const fields: any = {
      Title: data.title,
      [FIELD_MAP.status]: data.status || RequestStatus.PENDENTE,
      [FIELD_MAP.branch]: data.branch,
      [FIELD_MAP.invoiceNumber]: data.invoiceNumber,
      [FIELD_MAP.orderNumbers]: data.orderNumbers,
      [FIELD_MAP.payee]: data.payee,
      [FIELD_MAP.paymentMethod]: data.paymentMethod,
      [FIELD_MAP.paymentDate]: data.paymentDate,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) throw new Error('Erro ao criar item');
    return response.json();
  }
};
