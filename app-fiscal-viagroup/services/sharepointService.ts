
import { PaymentRequest, RequestStatus } from '../types';

const SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
let CACHED_LIST_ID = ''; 

// Mapeamento de campos internos do SharePoint (nomes de sistema)
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
  resolveListId: async (accessToken: string) => {
    if (CACHED_LIST_ID) return CACHED_LIST_ID;
    try {
      const resp = await fetch(`https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await resp.json();
      
      if (!data.value) return '';

      // Busca por nome exato ou termo parcial ignorando case
      const list = data.value.find((l: any) => 
        l.displayName.toLowerCase() === 'solicitacoes_sispag_v2' || 
        l.name.toLowerCase() === 'solicitacoes_sispag_v2' ||
        l.displayName.toLowerCase().includes('sispag')
      );
      
      if (list) {
        CACHED_LIST_ID = list.id;
        return list.id;
      }
    } catch (e) {
      console.error("Erro ao resolver ID da lista:", e);
    }
    return '';
  },

  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    const listId = await sharepointService.resolveListId(accessToken);
    if (!listId) {
      console.error("Lista SisPag não encontrada no SharePoint.");
      return [];
    }

    let allItems: any[] = [];
    // Adicionamos $top=999 para maximizar o tamanho do lote e expand=fields para pegar os dados
    let nextUrl: string | null = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items?expand=fields&$top=999`;

    try {
      while (nextUrl) {
        const response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
          const errData = await response.json();
          console.error("Erro ao buscar itens (paginação):", errData);
          break;
        }

        const data = await response.json();
        allItems = [...allItems, ...data.value];
        
        // O segredo para pegar mais de 2000 itens (ou qualquer limite do Graph) está aqui:
        nextUrl = data['@odata.nextLink'] || null;
      }

      console.log(`Total de itens recuperados do SharePoint: ${allItems.length}`);

      return allItems.map((item: any) => {
        const f = item.fields || {};
        // O ID do criador no Graph é item.createdBy.user.id
        // Sincronizamos este ID com o user.id da nossa aplicação para o RLS (filtros) funcionar
        const creatorId = item.createdBy?.user?.id || f.AuthorLookupId;
        
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
          createdByUserId: creatorId,
          createdByName: item.createdBy?.user?.displayName || 'Sistema',
        };
      });
    } catch (error) {
      console.error("Erro crítico na integração SharePoint:", error);
      return [];
    }
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>): Promise<any> => {
    const listId = await sharepointService.resolveListId(accessToken);
    if (!listId) throw new Error("Lista SharePoint não encontrada.");
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
    if (!listId) throw new Error("Lista SharePoint não encontrada.");
    const url = `https://graph.microsoft.com/v1.0/sites/${SITE_ID}/lists/${listId}/items/${itemId}/fields`;
    
    const fields: any = {};
    Object.keys(data).forEach(key => {
      const spKey = FIELD_MAP[key as keyof typeof FIELD_MAP];
      if (spKey) {
        fields[spKey] = (data as any)[key];
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
