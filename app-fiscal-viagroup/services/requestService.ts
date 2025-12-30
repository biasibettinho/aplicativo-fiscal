import { PaymentRequest, RequestStatus } from '../types';

// IDs ORIGINAIS MANTIDOS PARA ESTABILIDADE
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

/**
 * Gera nome do arquivo baseado no primeiro número encontrado na Nota Fiscal
 */
const generateFileName = (originalName: string, invoiceNumber?: string) => {
  const extension = originalName.split('.').pop();
  
  if (invoiceNumber) {
    const firstMatch = invoiceNumber.match(/\d+/);
    if (firstMatch) {
      return `NF_${firstMatch[0]}.${extension}`;
    }
  }

  const cleanBase = originalName.split('.').slice(0, -1).join('.')
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[#%*:<>?/|\\"]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 30);
    
  return `${cleanBase}.${extension}`;
};

export const sharepointService = {
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
          title: f.Title || '',
          invoiceNumber: f[FIELD_MAP.invoiceNumber] || '',
          status: (f[FIELD_MAP.status] as RequestStatus) || RequestStatus.PENDENTE,
          branch: f[FIELD_MAP.branch] || '',
          createdAt: item.createdDateTime,
          // Mantenha os outros mapeamentos conforme sua necessidade
        };
      });

      allRequests.push(...pageRequests);
      url = data['@odata.nextLink'];
    }
    return allRequests;
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
      [FIELD_MAP.pixKey]: data.pixKey,
      [FIELD_MAP.generalObservation]: data.generalObservation
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro ao criar item');
    }
    return response.json();
  },

  async uploadAttachment(accessToken: string, itemId: string, file: File, invoiceNumber?: string) {
    const cleanName = generateFileName(file.name, invoiceNumber);
    console.log(`📤 Tentando anexo: ${cleanName}`);
    
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/attachments/${cleanName}/content`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': file.type
      },
      body: file
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Erro no upload:", errorData);
      throw new Error(errorData.error?.message || "Erro 400 no anexo");
    }
    return true;
  }
};
