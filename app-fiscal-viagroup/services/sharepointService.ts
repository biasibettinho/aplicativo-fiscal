import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { authService } from './authService';

/**
 * CONFIGURAÇÕES REAIS DO AMBIENTE VIA LACTEOS
 */
const SITE_URL = 'https://vialacteoscombr.sharepoint.com/sites/Powerapps';
const BASE_URL = 'https://vialacteoscombr.sharepoint.com';
const GRAPH_SITE_ID = 'vialacteoscombr.sharepoint.com,f1ebbc10-56fd-418d-b5a9-d2ea9e83eaa1,c5526737-ed2d-40eb-8bda-be31cdb73819';
const MAIN_LIST_ID = '51e89570-51be-41d0-98c9-d57a5686e13b';
const SECONDARY_LIST_ID = '53b6fecb-56e9-4917-ad5b-d46f10b47938'; // APP_Fiscal_AUX_ANEXOS
const USER_LIST_ID = 'aab3f85b-2541-4974-ab1a-e0a0ee688b4e';
const HISTORY_LIST_ID = '4b5c196a-26bf-419a-8bab-c59f8f64e612';
const POWER_AUTOMATE_URL = 'https://default7d9754b3dcdb4efe8bb7c0e5587b86.ed.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/279b9f46c29b485fa069720fb0f2a329/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sH0mJTwun6v7umv0k3OKpYP7nXVUckH2TnaRMXHfIj8';

const FIELD_MAP = {
  title: 'Title',
  invoiceNumber: 'Qualon_x00fa_merodaNF_x003f_',
  orderNumbers: 'Qualopedido_x0028_s_x0029__x003f',
  status: 'Status',
  branch: 'Filial',
  generalObservation: 'Observa_x00e7__x00e3_o',
  approverObservation: 'OBSERVACAO_APROVADORES', 
  paymentMethod: 'MET_PAGAMENTO',
  pixKey: 'CAMPO_PIX',
  paymentDate: 'DATA_PAG',
  payee: 'PESSOA',
  statusManual: 'STATUS_ESPELHO_MANUAL',
  statusFinal: 'STATUS_FINAL',
  statusEspelho: 'STATUS_ESPELHO',
  bank: 'BANCO',
  agency: 'AGENCIA',
  account: 'CONTA',
  accountType: 'TIPO_CONTA',
  sharedWithEmail: 'PESSOA_COMPARTILHADA',
  sharedByName: 'PESSOA_COMPARTILHOU',
  shareComment: 'COMENTARIO_COMPARTILHAMENTO',
  errorObservation: 'OBS_ERRO' 
};

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

async function spRestFetch(url: string, options: RequestInit = {}) {
  const spToken = await authService.getSharePointToken();
  if (!spToken) {
    console.error("[SP REST] Falha ao adquirir token de audiência SharePoint.");
    return new Response(null, { status: 401 });
  }

  const headers: any = {
    Authorization: `Bearer ${spToken}`,
    'Accept': 'application/json;odata=verbose',
    'Content-Type': 'application/json;odata=verbose',
    ...options.headers,
  };
  const res = await fetch(url, { ...options, headers });
  return res;
}

const stripHtml = (html: any) => {
  if (!html) return '';
  const text = html.toString();
  return text.replace(/<[^>]*>?/gm, '').trim();
};

export const sharepointService = {
  getUserRoleFromSharePoint: async (email: string): Promise<UserRole> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items?$filter=EmailUsuario eq '${email}'`;
      const response = await spRestFetch(endpoint);
      if (!response.ok) return UserRole.SOLICITANTE;
      
      const data = await response.json();
      const items = data.d?.results || [];
      
      if (items.length === 0) return UserRole.SOLICITANTE;
      
      const { Setor, Nivel } = items[0];
      
      if (Nivel === 'Admin') return UserRole.ADMIN_MASTER;
      if (Setor === 'Fiscal') return Nivel === 'Master' ? UserRole.FISCAL_ADMIN : UserRole.FISCAL_COMUM;
      if (Setor === 'Financeiro') return Nivel === 'Master' ? UserRole.FINANCEIRO_MASTER : UserRole.FINANCEIRO;
      
      return UserRole.SOLICITANTE;
    } catch (e) {
      console.error("Erro ao buscar papel do usuário no SharePoint:", e);
      return UserRole.SOLICITANTE;
    }
  },

  getAllSharePointUsers: async (): Promise<any[]> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items?$select=EmailUsuario,Setor,Nivel,Status,Id`;
      const response = await spRestFetch(endpoint);
      if (!response.ok) return [];
      const data = await response.json();
      return data.d?.results || [];
    } catch (e) {
      console.error("Erro crítico ao buscar todos os usuários do SharePoint:", e);
      return [];
    }
  },

  triggerPowerAutomateFlow: async (payload: any): Promise<boolean> => {
    try {
      const response = await fetch(POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error("Erro ao disparar Power Automate:", e);
      return false;
    }
  },

  getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
    try {
      let allItems: any[] = [];
      let nextLink = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items?expand=fields&$top=500`;

      while (nextLink) {
        const response = await graphFetch(nextLink, accessToken);
        if (!response.ok) break;
        const data = await response.json();
        allItems = [...allItems, ...(data.value || [])];
        nextLink = data['@odata.nextLink'] || null;
      }
      
      return allItems.map((item: any) => {
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
          approverObservation: f[FIELD_MAP.approverObservation] || '', 
          statusManual: f[FIELD_MAP.statusManual] || '',
          statusFinal: f[FIELD_MAP.statusFinal] || '',
          statusEspelho: f[FIELD_MAP.statusEspelho] || '',
          sharedWithEmail: stripHtml(f[FIELD_MAP.sharedWithEmail] || f['PESSOA_COMPARTILHADA'] || f['PessoaCompartilhada']).toLowerCase(),
          sharedByName: f[FIELD_MAP.sharedByName] || '',
          shareComment: f[FIELD_MAP.shareComment] || '',
          errorObservation: f[FIELD_MAP.errorObservation] || '',
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

  updateRequest: async (accessToken: string, graphId: string, data: Partial<PaymentRequest>): Promise<any> => {
    try {
      const fields: any = {};
      Object.entries(FIELD_MAP).forEach(([key, spField]) => {
        if ((data as any)[key] !== undefined) fields[spField] = (data as any)[key];
      });

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

  getSecondaryAttachments: async (unusedToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      const filter = `ID_SOL eq '${itemId}'`;
      const findItemUrl = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${encodeURIComponent(filter)}&$select=Id,Attachments`;
      
      const findResponse = await spRestFetch(findItemUrl);
      if (!findResponse.ok) return [];
      
      const findData = await findResponse.json();
      const secondaryItems = findData.d?.results || [];
      
      const allSecondaryAttachments: Attachment[] = [];

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
      return [];
    }
  },

  deleteAttachment: async (listGuid: string, itemId: string, fileName: string): Promise<boolean> => {
    try {
      console.log(`[DEBUG-SP] Tentando deletar anexo: ${fileName} do item ${itemId} na lista ${listGuid}`);
      const url = `${SITE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles/getByFileName('${fileName}')`;
      const response = await spRestFetch(url, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'DELETE'
        }
      });
      console.log(`[DEBUG-SP] Resultado deleção: ${response.status} ${response.statusText}`);
      return response.ok;
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao deletar anexo:", e);
      return false;
    }
  },

  uploadAttachment: async (listGuid: string, itemId: string, file: File): Promise<boolean> => {
    try {
      console.log(`[DEBUG-SP] Subindo arquivo: ${file.name} para item ${itemId}`);
      const spToken = await authService.getSharePointToken();
      const arrayBuffer = await file.arrayBuffer();
      const url = `${SITE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles/add(FileName='${file.name}')`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${spToken}`,
          'Accept': 'application/json;odata=verbose',
          'Content-Type': file.type
        },
        body: arrayBuffer
      });
      console.log(`[DEBUG-SP] Resultado upload: ${response.status} ${response.statusText}`);
      return response.ok;
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao subir anexo:", e);
      return false;
    }
  },

  deleteSecondaryItemsByRequestId: async (requestId: string): Promise<void> => {
    try {
      console.log(`[DEBUG-SP] Buscando itens secundários para ID_SOL: ${requestId}`);
      const filter = `ID_SOL eq '${requestId}'`;
      const url = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const res = await spRestFetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.d?.results || [];
        console.log(`[DEBUG-SP] Encontrados ${items.length} itens secundários para remover.`);
        for (const item of items) {
          console.log(`[DEBUG-SP] Deletando item secundário ID: ${item.Id}...`);
          const delRes = await spRestFetch(`${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})`, {
            method: 'POST',
            headers: { 
              'X-HTTP-Method': 'DELETE', 
              'IF-MATCH': '*' 
            }
          });
          console.log(`[DEBUG-SP] Deleção item ${item.Id} status: ${delRes.status}`);
        }
      } else {
        console.error(`[DEBUG-SP] Falha ao buscar itens secundários: ${res.status}`);
      }
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao limpar lista secundária:", e);
    }
  },

  createSecondaryItemWithAttachment: async (requestId: string, file: File): Promise<boolean> => {
    try {
      console.log(`[DEBUG-SP] Criando item secundário para ID_SOL: ${requestId} com arquivo: ${file.name}`);
      alert(`[TESTE] Criando item secundário para ID_SOL: ${requestId}`); 
      
      const url = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items`;
      const body = JSON.stringify({
        'ID_SOL': requestId,
        'Title': `Boleto - Sol ${requestId}`
      });

      const res = await spRestFetch(url, {
        method: 'POST',
        body: body,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      console.log(`[DEBUG-SP] Status criação item secundário: ${res.status}`);

      if (res.ok) {
        const data = await res.json();
        const newItemId = data.Id || data.d?.Id;
        console.log(`[DEBUG-SP] Item secundário criado. ID: ${newItemId}`);
        alert(`[TESTE] Item criado! ID: ${newItemId}. Subindo arquivo...`);

        const uploadSuccess = await sharepointService.uploadAttachment(SECONDARY_LIST_ID, newItemId.toString(), file);
        console.log(`[DEBUG-SP] Upload finalizado. Sucesso: ${uploadSuccess}`);
        alert(`[TESTE] Upload boleto: ${uploadSuccess ? 'SUCESSO' : 'FALHOU'}`);
        
        return uploadSuccess;
      } else {
        const errorText = await res.text();
        console.error(`[DEBUG-SP] Erro ao criar item: ${res.status} - ${errorText}`);
        alert(`[ERRO] Falha criar item: ${res.status}. Ver console.`);
        return false;
      }
    } catch (e: any) {
      console.error("[DEBUG-SP] Exceção ao criar item secundário:", e);
      alert(`[ERRO CRÍTICO] ${e.message}`);
      return false;
    }
  },

  addHistoryLog: async (accessToken: string, requestId: number, logData: { ATUALIZACAO: string, OBSERVACAO: string, MSG_OBSERVACAO: string, usuario_logado: string }): Promise<boolean> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${HISTORY_LIST_ID}/items`;
      const response = await graphFetch(endpoint, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            ID_SOL: requestId,
            ATUALIZACAO: logData.ATUALIZACAO,
            OBSERVACAO: logData.OBSERVACAO,
            MSG_OBSERVACAO: logData.MSG_OBSERVACAO,
            usuario_logado: logData.usuario_logado
          }
        })
      });
      return response.ok;
    } catch (e) {
      console.error("Erro ao adicionar log de histórico:", e);
      return false;
    }
  },

  getHistoryLogs: async (accessToken: string, requestId: string): Promise<any[]> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${HISTORY_LIST_ID}/items?expand=fields&$filter=fields/ID_SOL eq ${requestId}&$orderby=createdDateTime desc`;
      const response = await graphFetch(endpoint, accessToken);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.value || []).map((item: any) => ({
        id: item.id,
        createdAt: item.createdDateTime,
        status: item.fields.ATUALIZACAO,
        obs: item.fields.OBSERVACAO,
        msg: item.fields.MSG_OBSERVACAO,
        user: item.fields.usuario_logado
      }));
    } catch (e) {
      console.error("Erro ao buscar histórico:", e);
      return [];
    }
  }
};