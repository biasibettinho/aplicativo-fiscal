import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const AUX_LIST_NAME = 'APP_Fiscal_AUX_ANEXOS';

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

// Função auxiliar para evitar erro 400 no SharePoint limpando o nome do arquivo
const sanitizeFileName = (name: string) => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-zA-Z0-9.]/g, "_") // Substitui espaços e símbolos por "_"
    .replace(/_{2,}/g, "_");        // Remove sublinhados duplicados
};

export const sharepointService = {
  // 1. LISTAGEM
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
      url = data['@odata.nextLink'];
    }
    return allRequests;
  },

  // 2. CRIAÇÃO
  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items`;
    const fields: any = {};
    
    Object.entries(data).forEach(([key, value]) => {
      const spField = FIELD_MAP[key as keyof typeof FIELD_MAP];
      if (spField && value !== undefined) {
        fields[spField] = value;
      }
    });

    fields.Title = data.title;
    fields[FIELD_MAP.status] = data.status || RequestStatus.PENDENTE;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || 'Erro criar item');
    }
    return response.json();
  },

  // 3. ANEXAR NOTA FISCAL (Com limpeza de nome para evitar Erro 400)
  uploadMainAttachment: async (accessToken: string, itemId: string, file: File): Promise<any> => {
    const cleanName = sanitizeFileName(file.name);
    const fileNameEncoded = encodeURIComponent(cleanName);
    
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/attachments/${fileNameEncoded}/content`;
    const arrayBuffer = await file.arrayBuffer();
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': file.type || 'application/octet-stream' 
      },
      body: arrayBuffer
    });

    if (!response.ok) {
      const errorDetail = await response.json();
      throw new Error(`Erro ao anexar NF (${cleanName}): ${errorDetail.error?.message || 'Erro 400'}`);
    }
    return response.json();
  },

  // 4. ANEXAR BOLETO (Lista Auxiliar)
  uploadAuxiliaryAttachment: async (accessToken: string, parentId: string, file: File): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${AUX_LIST_NAME}/items`;
    const cleanName = sanitizeFileName(file.name);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          Title: cleanName,
          ID_SOL: parentId.toString()
        }
      })
    });

    if (!response.ok) throw new Error(`Erro ao criar registro de boleto`);
    const newItem = await response.json();
    
    const uploadUrl = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${AUX_LIST_NAME}/items/${newItem.id}/attachments/${encodeURIComponent(cleanName)}/content`;
    const arrayBuffer = await file.arrayBuffer();
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${accessToken}`, 
        'Content-Type': file.type || 'application/octet-stream' 
      },
      body: arrayBuffer
    });

    if (!uploadRes.ok) throw new Error(`Erro no upload do arquivo do boleto`);
  },

  // 5. ATUALIZAÇÃO
  updateRequest: async (accessToken: string, itemId: string, data: Partial<PaymentRequest>): Promise<any> => {
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
    const fields: any = {};
    
    Object.entries(data).forEach(([key, value]) => {
      const spField = FIELD_MAP[key as keyof typeof FIELD_MAP];
      if (value !== undefined && spField) {
        fields[spField as string] = value;
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
