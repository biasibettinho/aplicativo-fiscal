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

/**
 * Mapeamento corrigido baseado no XML oficial da Lista (InternalNames)
 */
const FIELD_MAP = {
    // Campos Simples
    title: 'Title',
    branch: 'Filial',
    status: 'Status',
    payee: 'FAVORECIDO',
    bank: 'BANCO',
    agency: 'AGENCIA',
    account: 'CONTA',
    accountType: 'TIPO_CONTA',
    discount: 'DESCONTO',
    messageId: 'Message_ID',

    // Campos com Codificação ou Nomes Diferentes do Display
    invoiceNumber: 'Qualon_x00fa_merodaNF_x003f_',
    orderNumber: 'Qualopedido_x0028_s_x0029__x003f',
    generalObservation: 'Observa_x00e7__x00e3_o',
    budget: 'Or_x00e7_amento',
    finalizationDate: 'Datafinaliza_x00e7__x00e3_o',
    paymentMethod: 'MET_PAGAMENTO',
    pixKey: 'CAMPO_PIX',
    paymentDate: 'DATA_PAG',

    // Campos de Aprovação e Status
    approverObservation: 'Observa_x00e7__x00e3_o', 
    statusManual: 'STATUS_ESPELHO_MANUAL',
    statusFinal: 'STATUS_FINAL',
    errorObservation: 'OBS_ERRO',
    creationObservation: 'OBS_CRIACAO',
    sendDateFiscal: 'Dataenvio_fiscal',
    sendDateFinance: 'Dataenvio_financeiro',

    // CORREÇÕES CRÍTICAS
    statusEspelho: 'TESTE',
    shareComment: 'comentario_compartilhamento',
    sharedWithEmail: 'PESSOA_COMPARTILHADA',
    sharedByName: 'PESSOA_COMPARTILHOU',

    // NOVAS COLUNAS DE AUTORIA PERSONALIZADA (POWER AUTOMATE FLOW)
    createdByName: 'SolicitanteNome',
    createdByUserId: 'SOLICITANTE_ID',
    authorEmail: 'SOLICITANTE_EMAIL'
};

const normalizePayloadKeys = (data: any) => {
    if (!data) return {};
    const normalized: any = {};
    const corrections: Record<string, string> = {
        'COMENTARIO_COMPARTILHAMENTO': 'comentario_compartilhamento',
        'shareComment': 'comentario_compartilhamento',
        'PESSOA_COMPARTILHADA': 'PESSOA_COMPARTILHADA',
        'sharedWithEmail': 'PESSOA_COMPARTILHADA',
        'STATUS_ESPELHO': 'TESTE',
        'status': 'Status',
        'statusFinal': 'STATUS_FINAL',
        'approverObservation': 'Observa_x00e7__x00e3_o',
        'errorObservation': 'OBS_ERRO',
        'createdByName': 'SolicitanteNome',
        'createdByUserId': 'SOLICITANTE_ID',
        'AuthorEmail': 'SOLICITANTE_EMAIL'
    };
    Object.keys(data).forEach(key => {
        const correctKey = corrections[key] || key;
        normalized[correctKey] = data[key];
    });
    return normalized;
};

const sanitizePayload = (data: any) => {
    if (!data) return {};
    const clean = { ...data };
    const forbidden = ['id', 'ID', 'Author', 'Editor', 'Created', 'Modified', 'Attachments', 'AttachmentFiles', 'GUID', 'UniqueId', 'ContentType', 'ContentTypeId', 'eTag', 'odata.type', 'odata.id', 'odata.etag', 'odata.editLink', 'fields@odata.context'];
    forbidden.forEach(key => delete clean[key]);
    Object.keys(clean).forEach(key => { if (key.startsWith('odata.') || key.startsWith('__')) delete clean[key]; });
    return clean;
};

const detectIdSolFieldKey = (fieldsObj: any): string | null => {
  if (!fieldsObj) return null;
  if (fieldsObj.ID_SOL !== undefined) return "ID_SOL";
  const keys = Object.keys(fieldsObj);
  return keys.find(k => k.toLowerCase().includes("id") && k.toLowerCase().includes("sol")) || null;
};

async function graphFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const headers: any = { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) console.error(`[MS GRAPH ERROR] URL: ${url}`, { status: res.status, statusText: res.statusText });
  return res;
}

/**
 * Função auxiliar para fazer fetch com retry caso o token expire (401).
 */
async function graphFetchWithRetry(url: string, token: string, options: any = {}) {
    let response = await fetch(url, { 
        ...options, 
        headers: { 
            ...options.headers, 
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': options.method === 'PATCH' || options.method === 'POST' ? 'application/json' : undefined
        } 
    });
    
    if (response.status === 401) {
        console.warn("Token expirado (401). Tentando renovar...");
        const newToken = await authService.getSharePointToken();
        if (newToken) {
            response = await fetch(url, { 
                ...options, 
                headers: { 
                    ...options.headers, 
                    Authorization: `Bearer ${newToken}`,
                    'Accept': 'application/json',
                    'Content-Type': options.method === 'PATCH' || options.method === 'POST' ? 'application/json' : undefined
                } 
            });
        }
    }
    return response;
}

async function spRestFetch(url: string, options: RequestInit = {}) {
  const spToken = await authService.getSharePointToken();
  if (!spToken) return new Response(null, { status: 401 });
  const headers: any = { Authorization: `Bearer ${spToken}`, 'Accept': 'application/json;odata=verbose', 'Content-Type': 'application/json;odata=verbose', ...options.headers };
  return await fetch(url, { ...options, headers });
}

const stripHtml = (html: any) => {
  if (!html) return '';
  const text = html.toString();
  return text.replace(/<[^>]*>?/gm, '').trim();
};

export const sharepointService = {
    // --- FUNÇÃO GETREQUESTS COM PAGINAÇÃO E FILTRO HÍBRIDO ---
    getRequests: async (accessToken: string): Promise<PaymentRequest[]> => {
        try {
            let allItems: any[] = [];
            // URL Inicial com paginação máxima (999) e expansão de campos
            let nextLink: string | null = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items?$expand=fields&$top=999`;

            // Loop de Paginação (Busca tudo até acabar)
            while (nextLink) {
                const response = await graphFetchWithRetry(nextLink, accessToken, {
                    headers: {
                        'Prefer': 'HonorNonIndexedQueriesWarningMayFailRandomly'
                    }
                });

                if (!response.ok) {
                    console.error(`[GRAPH ERROR] getRequests: ${response.status}`);
                    break;
                }

                const data = await response.json();
                const pageItems = data.value || [];
                allItems = [...allItems, ...pageItems];
                
                // Atualiza o link para a próxima página (ou null se acabou)
                nextLink = data['@odata.nextLink'] || null;
            }

            console.log(`[DEBUG] Total de itens carregados: ${allItems.length}`);

            return allItems.map((item: any) => {
                const f = item.fields || {};
                
                // LÓGICA DE FALLBACK HÍBRIDA (SUPORTE LEGADO + NOVO)
                // 1. Tenta SOLICITANTE_ID (itens novos)
                // 2. Tenta createdBy.user.id (itens antigos/legados)
                // 3. Normaliza para string vazia se falhar
                const idSolicitante = f.SOLICITANTE_ID || item.createdBy?.user?.id || '';

                // Normalização de Email (minúsculo para comparação segura)
                const emailSolicitante = (f.SOLICITANTE_EMAIL || item.createdBy?.user?.email || '').toLowerCase();

                // Helper para extrair valores baseados no FIELD_MAP
                const getVal = (mapKey: keyof typeof FIELD_MAP) => {
                    const internalName = FIELD_MAP[mapKey];
                    return f[internalName] || f[mapKey] || '';
                };

                let pDate = getVal('paymentDate');
                if (pDate && !pDate.includes('T')) {
                  const d = new Date(pDate);
                  if (!isNaN(d.getTime())) pDate = d.toISOString();
                }

                return {
                    id: String(f.id || f.ID || item.id), // ID do Graph (string)
                    graphId: item.id,
                    mirrorId: parseInt(f.id || f.ID || '0', 10),
                    title: f.Title || getVal('title') || 'Sem Título',
                    status: (getVal('status') as RequestStatus) || (f.Status as RequestStatus) || RequestStatus.PENDENTE,
                    
                    // CAMPOS CRÍTICOS PARA FILTRO
                    createdByUserId: idSolicitante, 
                    createdByName: f.SolicitanteNome || item.createdBy?.user?.displayName || 'Sistema',
                    authorEmail: emailSolicitante,
                    
                    branch: getVal('branch'),
                    paymentMethod: getVal('paymentMethod'),
                    paymentDate: pDate,
                    
                    invoiceNumber: f.Qualon_x00fa_merodaNF_x003f_ || f.NF || '',
                    // CORREÇÃO: Tenta variações do nome interno para garantir que pegue o valor do pedido
                    orderNumber: f.Qualopedido_x0028_s_x0029__x003f || f.Qualopedido_x0028_s_x0029__x003f_ || f.Pedido || '',
                    
                    payee: getVal('payee'),
                    bank: getVal('bank'),
                    agency: getVal('agency'),
                    account: getVal('account'),
                    accountType: getVal('accountType'),
                    pixKey: getVal('pixKey'),
                    
                    totalValue: 0, 
                    generalObservation: stripHtml(getVal('generalObservation')),
                    approverObservation: stripHtml(getVal('approverObservation')),
                    
                    createdAt: item.createdDateTime,
                    updatedAt: item.lastModifiedDateTime,
                    
                    statusManual: f.StatusManual || getVal('statusManual'),
                    statusFinal: f.StatusFinal || getVal('statusFinal'),
                    statusEspelho: getVal('statusEspelho'),
                    sharedWithEmail: stripHtml(f[FIELD_MAP.sharedWithEmail] || f['PESSOA_COMPARTILHADA'] || '').toLowerCase(),
                    sharedByName: getVal('sharedByName'),
                    shareComment: stripHtml(getVal('shareComment')),
                    errorObservation: getVal('errorObservation'),
                    attachments: []
                } as PaymentRequest;
            });

        } catch (error) {
            console.error("Erro fatal ao buscar solicitações (Paginação):", error);
            return [];
        }
    },
    // --- FIM DA FUNÇÃO ---

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
    } catch (e) { return UserRole.SOLICITANTE; }
  },

  getAllSharePointUsers: async (): Promise<any[]> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items?$select=EmailUsuario,Setor,Nivel,Title,Id`;
      const response = await spRestFetch(endpoint);
      if (!response.ok) return [];
      const data = await response.json();
      return data.d?.results || [];
    } catch (e) { return []; }
  },

  addSharePointUser: async (userData: any): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items`;
      const payload = { '__metadata': { 'type': 'SP.Data.App_Gestao_UsuariosListItem' }, ...userData };
      const response = await spRestFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) });
      return response.ok;
    } catch (e) { return false; }
  },

  updateSharePointUser: async (id: number, userData: any): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items(${id})`;
      const payload = { '__metadata': { 'type': 'SP.Data.App_Gestao_UsuariosListItem' }, ...userData };
      const response = await spRestFetch(endpoint, { method: 'POST', headers: { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, body: JSON.stringify(payload) });
      return response.ok;
    } catch (e) { return false; }
  },

  deleteSharePointUser: async (id: number): Promise<boolean> => {
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${USER_LIST_ID}')/items(${id})`;
      const response = await spRestFetch(endpoint, { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } });
      return response.ok;
    } catch (e) { return false; }
  },

  triggerPowerAutomateFlow: async (payload: any): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutos de Timeout

      const response = await fetch(POWER_AUTOMATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (e) {
      console.error("Erro ou Timeout no Power Automate:", e);
      return false;
    }
  },

  updateRequest: async (accessToken: string, graphId: string, data: Partial<PaymentRequest>): Promise<any> => {
    try {
      const rawFields: any = {};
      Object.entries(FIELD_MAP).forEach(([key, spField]) => { if ((data as any)[key] !== undefined) rawFields[spField] = (data as any)[key]; });
      const normalizedFields = normalizePayloadKeys(rawFields);
      const cleanedFields = sanitizePayload(normalizedFields);
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}`;
      const response = await graphFetchWithRetry(endpoint, accessToken, { method: 'PATCH', body: JSON.stringify({ fields: cleanedFields }) });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) { return null; }
  },

  updateRequestFields: async (accessToken: string, graphId: string, fields: any): Promise<boolean> => {
    try {
        const normalizedFields = normalizePayloadKeys(fields);
        const cleanedFields = sanitizePayload(normalizedFields);
        const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${MAIN_LIST_ID}/items/${graphId}`;
        const response = await graphFetchWithRetry(endpoint, accessToken, { method: 'PATCH', body: JSON.stringify({ fields: cleanedFields }) });
        return response.ok;
    } catch (e) { return false; }
  },

  getItemAttachments: async (unusedToken: string, itemId: string): Promise<Attachment[]> => {
    if (!itemId) return [];
    try {
      const endpoint = `${SITE_URL}/_api/web/lists(guid'${MAIN_LIST_ID}')/items(${itemId})/AttachmentFiles`;
      const response = await spRestFetch(endpoint);
      if (!response.ok) return [];
      const data = await response.json();
      const files = data.d?.results || [];
      return files.map((file: any) => ({ id: file.FileName, requestId: itemId, fileName: file.FileName, type: 'invoice_pdf', mimeType: 'application/pdf', size: 0, storageUrl: `${BASE_URL}${file.ServerRelativeUrl}`, createdAt: new Date().toISOString() }));
    } catch (e) { return []; }
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
            files.forEach((file: any) => { allSecondaryAttachments.push({ id: `${item.Id}_${file.FileName}`, requestId: itemId, fileName: file.FileName, type: 'boleto', mimeType: 'application/pdf', size: 0, storageUrl: `${BASE_URL}${file.ServerRelativeUrl}`, createdAt: new Date().toISOString() }); });
          }
        }
      }
      return allSecondaryAttachments;
    } catch (e) { return []; }
  },

  deleteAttachment: async (listGuid: string, itemId: string, fileName: string): Promise<boolean> => {
    try {
      const url = `${SITE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles/getByFileName('${fileName}')`;
      const response = await spRestFetch(url, { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE' } });
      return response.ok;
    } catch (e) { return false; }
  },

  uploadAttachment: async (listGuid: string, itemId: string, file: File): Promise<boolean> => {
    try {
      const spToken = await authService.getSharePointToken();
      const arrayBuffer = await file.arrayBuffer();
      const url = `${SITE_URL}/_api/web/lists(guid'${listGuid}')/items(${itemId})/AttachmentFiles/add(FileName='${file.name}')`;
      const response = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${spToken}`, 'Accept': 'application/json;odata=verbose', 'Content-Type': file.type }, body: arrayBuffer });
      return response.ok;
    } catch (e) { return false; }
  },

  deleteSecondaryItemsByRequestId: async (requestId: string): Promise<void> => {
    try {
      const filter = `ID_SOL eq '${requestId}'`;
      const url = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items?$filter=${encodeURIComponent(filter)}&$select=Id`;
      const res = await spRestFetch(url);
      if (res.ok) {
        const data = await res.json();
        const items = data.d?.results || [];
        for (const item of items) { await spRestFetch(`${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items(${item.Id})`, { method: 'POST', headers: { 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' } }); }
      }
    } catch (e) { }
  },

  createSecondaryItemWithAttachment: async (requestId: string, file: File): Promise<boolean> => {
    try {
      const url = `${SITE_URL}/_api/web/lists(guid'${SECONDARY_LIST_ID}')/items`;
      const body = JSON.stringify({ 'ID_SOL': requestId, 'Title': `Boleto - Sol ${requestId}` });
      const res = await spRestFetch(url, { method: 'POST', body: body, headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        const newItemId = data.Id || data.d?.Id;
        return await sharepointService.uploadAttachment(SECONDARY_LIST_ID, newItemId.toString(), file);
      }
      return false;
    } catch (e) { return false; }
  },

  addHistoryLog: async (accessToken: string, requestId: number, logData: any): Promise<boolean> => {
    try {
      const endpoint = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${HISTORY_LIST_ID}/items`;
      const response = await graphFetchWithRetry(endpoint, accessToken, { method: 'POST', body: JSON.stringify({ fields: { ID_SOL: requestId, ATUALIZACAO: logData.ATUALIZACAO, OBSERVACAO: logData.OBSERVACAO, MSG_OBSERVACAO: logData.MSG_OBSERVACAO, usuario_logado: logData.usuario_logado } }) });
      return response.ok;
    } catch (e) { return false; }
  },

  getHistoryLogs: async (accessToken: string, requestId: string): Promise<any[]> => {
    let nextLink: string | null = `https://graph.microsoft.com/v1.0/sites/${GRAPH_SITE_ID}/lists/${HISTORY_LIST_ID}/items?$expand=fields&$orderby=createdDateTime desc&$top=100`;
    let pageCount = 0; let allMatches: any[] = []; let idKey: string | null = null;
    try {
      while (nextLink && pageCount < 30) {
        pageCount++;
        const response = await graphFetchWithRetry(nextLink, accessToken);
        if (!response.ok) break;
        const data = await response.json();
        const pageItems = data.value || [];
        nextLink = data['@odata.nextLink'] || null;
        if (pageItems.length === 0) break;
        if (!idKey) { for (const item of pageItems) { idKey = detectIdSolFieldKey(item.fields); if (idKey) break; } }
        if (idKey) {
          const matches = pageItems.filter((item: any) => {
            const fieldValue = item.fields?.[idKey!];
            if (fieldValue === undefined || fieldValue === null) return false;
            return fieldValue.toString().trim() === requestId.toString().trim();
          });
          if (matches.length > 0) allMatches = [...allMatches, ...matches];
        }
      }
      const uniqueMatches = Array.from(new Map(allMatches.map(item => [item.id, item])).values());
      uniqueMatches.sort((a: any, b: any) => new Date(b.createdDateTime).getTime() - new Date(a.createdDateTime).getTime());
      return uniqueMatches.map((item: any) => ({ id: item.id, createdAt: item.createdDateTime, status: item.fields?.ATUALIZACAO || '', obs: item.fields?.OBSERVACAO || '', msg: item.fields?.MSG_OBSERVACAO || '', user: item.fields?.usuario_logado || '' }));
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
      return [];
    }
  }
};