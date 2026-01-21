
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

console.log("[DEBUG INIT] Usando Lista Principal (ID):", MAIN_LIST_ID);

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

/**
 * Função auxiliar para detectar a chave real do campo ID_SOL no fields do Graph
 */
const detectIdSolFieldKey = (fieldsObj: any): string | null => {
  if (!fieldsObj) return null;
  if (fieldsObj.ID_SOL !== undefined) return "ID_SOL";

  const keys = Object.keys(fieldsObj);
  const found = keys.find(k => k.toLowerCase().includes("id") && k.toLowerCase().includes("sol"));
  return found || null;
};

async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    ...options.headers,
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    console.error(`[MS GRAPH ERROR] URL: ${url}`, { 
      status: res.status, 
      statusText: res.statusText 
    });
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
  // Função puramente para debug
  debugGetItemFields: async (accessToken: string, itemId: string) => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${itemId}/fields`;
      const response = await graphFetch(endpoint, accessToken);
      const data = await response.json();
      console.log("🔥 [DIAGNÓSTICO] CAMPOS DISPONÍVEIS NO GRAPH:", data);
      return data;
    } catch (e) {
      console.error("[DIAGNÓSTICO] Erro ao ler campos:", e);
    }
  },

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
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items?$select=EmailUsuario,Setor,Nivel,Title,Id`;
      const response = await spRestFetch(endpoint);
      if (!response.ok) {
        console.error("Erro na resposta da lista de usuários:", response.status);
        return [];
      }
      const data = await response.json();
      return data.d?.results || [];
    } catch (e) {
      console.error("Erro crítico ao buscar todos os usuários do SharePoint:", e);
      return [];
    }
  },

  addSharePointUser: async (userData: { EmailUsuario: string, Setor: string, Nivel: string, Title: string }): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items`;
      const payload = {
        '__metadata': { 'type': 'SP.Data.App_Gestao_UsuariosListItem' },
        ...userData
      };
      const response = await spRestFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error("Erro ao adicionar usuário no SharePoint:", e);
      return false;
    }
  },

  updateSharePointUser: async (id: number, userData: { EmailUsuario: string, Setor: string, Nivel: string, Title: string }): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items(${id})`;
      const payload = {
        '__metadata': { 'type': 'SP.Data.App_Gestao_UsuariosListItem' },
        ...userData
      };
      const response = await spRestFetch(endpoint, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'MERGE',
          'IF-MATCH': '*'
        },
        body: JSON.stringify(payload)
      });
      return response.ok;
    } catch (e) {
      console.error("Erro ao atualizar usuário no SharePoint:", e);
      return false;
    }
  },

  deleteSharePointUser: async (id: number): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items(${id})`;
      const response = await spRestFetch(endpoint, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'DELETE',
          'IF-MATCH': '*'
        }
      });
      return response.ok;
    } catch (e) {
      console.error("Erro ao deletar usuário no SharePoint:", e);
      return false;
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

        const rawComment = f['COMENTARIO_COMPARTILHAMENTO'] || f['SharingComment'];
        const commentText = typeof rawComment === 'object' && rawComment !== null 
            ? (rawComment as any).toString() 
            : (rawComment || '');

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
          generalObservation: stripHtml(f[FIELD_MAP.generalObservation] || ''),
          approverObservation: stripHtml(f[FIELD_MAP.approverObservation] || ''), 
          statusManual: f[FIELD_MAP.statusManual] || '',
          statusFinal: f[FIELD_MAP.statusFinal] || '',
          statusEspelho: f[FIELD_MAP.statusEspelho] || '',
          sharedWithEmail: stripHtml(f[FIELD_MAP.sharedWithEmail] || f['PESSOA_COMPARTILHADA'] || f['PessoaCompartilhada']).toLowerCase(),
          sharedByName: f[FIELD_MAP.sharedByName] || '',
          shareComment: commentText,
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

      console.log("[DEBUG UPDATE] Chamando updateRequest. ID:", graphId, "Dados:", JSON.stringify(fields));
      console.log("[DEBUG UPDATE] Executando comando MS Graph PATCH...");

      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/fields`;
      const response = await graphFetch(endpoint, accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[DEBUG UPDATE] FALHA NA RESPOSTA:", errorData);
        return null;
      }
      
      console.log("[DEBUG UPDATE] Sucesso MS Graph PATCH!");
      const result = await response.json();
      return result;
    } catch (e: any) {
      console.error("[DEBUG UPDATE] FALHA CRÍTICA:", e);
      return null;
    }
  },

  /**
   * TAREFA: Método para atualizar campos específicos diretamente no SharePoint via Graph.
   * Adicionados logs agressivos para investigação de persistência.
   */
  updateRequestFields: async (accessToken: string, graphId: string, fields: any): Promise<boolean> => {
    try {
      console.log("[DEBUG UPDATE_FIELDS] Chamando updateRequestFields. GraphID:", graphId, "Payload:", JSON.stringify(fields));
      console.log("[DEBUG UPDATE_FIELDS] Executando comando MS Graph PATCH...");
      
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}/fields`;
      const response = await graphFetch(endpoint, accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });
      
      if (response.ok) {
        console.log("[DEBUG UPDATE_FIELDS] Sucesso MS Graph PATCH! GraphID:", graphId);
        return true;
      } else {
        const errorData = await response.json();
        console.error("[DEBUG UPDATE_FIELDS] Erro na resposta do Graph:", errorData);
        return false;
      }
    } catch (e) {
      console.error("[DEBUG UPDATE_FIELDS] FALHA CRÍTICA ao atualizar GraphID:", graphId, e);
      return false;
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
      const url = `${SITE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles/getByFileName('${fileName}')`;
      const response = await spRestFetch(url, {
        method: 'POST',
        headers: {
          'X-HTTP-Method': 'DELETE'
        }
      });
      return response.ok;
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao deletar anexo:", e);
      return false;
    }
  },

  uploadAttachment: async (listGuid: string, itemId: string, file: File): Promise<boolean> => {
    try {
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
      return response.ok;
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao subir anexo:", e);
      return false;
    }
  },

  deleteSecondaryItemsByRequestId: async (requestId: string): Promise<void> => {
    try {
      const filter = `ID_SOL eq '${requestId}'`;
      const url = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const res = await spRestFetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.d?.results || [];
        for (const item of items) {
          await spRestFetch(`${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})`, {
            method: 'POST',
            headers: { 
              'X-HTTP-Method': 'DELETE', 
              'IF-MATCH': '*' 
            }
          });
        }
      }
    } catch (e) {
      console.error("[DEBUG-SP] Erro ao limpar lista secundária:", e);
    }
  },

  createSecondaryItemWithAttachment: async (requestId: string, file: File): Promise<boolean> => {
    try {
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

      if (res.ok) {
        const data = await res.json();
        const newItemId = data.Id || data.d?.Id;
        const uploadSuccess = await sharepointService.uploadAttachment(SECONDARY_LIST_ID, newItemId.toString(), file);
        return uploadSuccess;
      } else {
        return false;
      }
    } catch (e: any) {
      console.error("[DEBUG-SP] Exceção ao criar item secundário:", e);
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
    let nextLink: string | null = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${HISTORY_LIST_ID}/items?$expand=fields&$orderby=createdDateTime desc&$top=100`;
    let pageCount = 0;
    let allMatches: any[] = [];
    let idKey: string | null = null;
    const MAX_PAGES = 30; 

    try {
      while (nextLink && pageCount < MAX_PAGES) {
        pageCount++;
        const response = await graphFetch(nextLink, accessToken);
        if (!response.ok) break;

        const data = await response.json();
        const pageItems = data.value || [];
        nextLink = data['@odata.nextLink'] || null;

        if (pageItems.length === 0) break;

        if (!idKey) {
          for (const item of pageItems) {
            idKey = detectIdSolFieldKey(item.fields);
            if (idKey) break;
          }
        }

        if (idKey) {
          const matches = pageItems.filter((item: any) => {
            const fieldValue = item.fields?.[idKey!];
            if (fieldValue === undefined || fieldValue === null) return false;
            const fValueStr = fieldValue.toString().trim();
            const targetStr = requestId.toString().trim();
            if (fValueStr === targetStr) return true;
            const nTarget = parseInt(targetStr, 10);
            const nValue = typeof fieldValue === 'number' ? fieldValue : parseInt(fValueStr, 10);
            if (!isNaN(nTarget) && !isNaN(nValue) && nTarget === nValue) return true;
            return false;
          });
          if (matches.length > 0) allMatches = [...allMatches, ...matches];
        }
      }

      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.id, item])).values());
      uniqueMatches.sort((a: any, b: any) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime());

      return uniqueMatches.map((item: any) => ({
        id: item.id,
        createdAt: item.createdDateTime,
        status: item.fields?.ATUALIZACAO || '',
        obs: item.fields?.OBSERVACAO || '',
        msg: item.fields?.MSG_OBSERVACAO || '',
        user: item.fields?.usuario_logado || ''
      }));

    } catch (e: any) {
      console.error("[DEBUG-HISTORY] Erro crítico:", e);
      return [];
    }
  }
};
