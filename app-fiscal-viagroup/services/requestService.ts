import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    if (!user || !accessToken) return [];
    
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      if (user.role === UserRole.ADMIN_MASTER) return all;

      // SOLICITANTE: Filtro Robusto (ID ou Email)
      if (user.role === UserRole.SOLICITANTE) {
          return all.filter(r => {
              const idMatch = r.createdByUserId && user.id && r.createdByUserId.toString().toLowerCase() === user.id.toString().toLowerCase();
              const emailMatch = r.authorEmail && user.email && r.authorEmail.toLowerCase() === user.email.toLowerCase();
              
              return idMatch || emailMatch;
          });
      }
      
      if (user.role === UserRole.FISCAL_COMUM || user.role === UserRole.FISCAL_ADMIN) {
        return all;
      }

      if (user.role === UserRole.FINANCEIRO || user.role === UserRole.FINANCEIRO_MASTER) {
        const financeAllowed = [
          RequestStatus.APROVADO, 
          RequestStatus.LANCADO, 
          RequestStatus.FATURADO, 
          RequestStatus.ERRO_FINANCEIRO, 
          RequestStatus.COMPARTILHADO
        ];
        return all.filter(r => financeAllowed.includes(r.status) || r.statusManual === 'Compartilhado');
      }
      
      return [];
    } catch (error) {
      console.error("Erro ao filtrar solicitações:", error);
      return [];
    }
  },

  // Função dedicada para a tela "Minhas Solicitações"
  getMyRequests: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
      if (!user || !accessToken) return [];

      try {
          const all = await sharepointService.getRequests(accessToken);
          
          return all.filter(r => {
              const idMatch = r.createdByUserId && user.id && r.createdByUserId.toString().toLowerCase() === user.id.toString().toLowerCase();
              const emailMatch = r.authorEmail && user.email && r.authorEmail.toLowerCase() === user.email.toLowerCase();
              return idMatch || emailMatch;
          });
      } catch (error) {
          console.error("Erro ao buscar minhas solicitações:", error);
          return [];
      }
  },

  /**
   * Centraliza o envio para o Power Automate.
   */
   processFlowSubmission: async (data: Partial<PaymentRequest>, files: { invoice?: File | File[] | null, ticket?: File | File[] | null }, itemId: string): Promise<boolean> => {
    // Arrays de ficheiros para o Power Automate
    const invoiceFiles: { name: string, content: string }[] = [];
    const ticketFiles: { name: string, content: string }[] = [];

    // Função auxiliar para converter arquivo em Base64 limpo
    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result?.toString();
        if (result && result.includes(',')) {
          resolve(result.split(',')[1]);
        } else {
          resolve('');
        }
      };
      reader.onerror = error => reject(error);
    });
    // Processa anexos (suporta múltiplos arquivos)
    const normalizeFiles = (f?: File | File[] | null): File[] => {
      if (!f) return [];
      return Array.isArray(f) ? f : [f];
    };

    for (const file of normalizeFiles(files.invoice)) {
      invoiceFiles.push({
        name: file.name,
        content: await toBase64(file)
      });
    }

    for (const file of normalizeFiles(files.ticket)) {
      ticketFiles.push({
        name: file.name,
        content: await toBase64(file)
      });
    }
    // --- LOGS DE DEPURAÇÃO ---
    console.log("🔍 DADOS RECEBIDOS NO SERVICE:", data);
    console.log("🔍 ORDER NUMBER (ANTES DO PAYLOAD):", data.orderNumber);
    // -------------------------

    // Constrói o payload final conforme solicitado
    const flowPayload: any = {
      ...data,
      itemId: itemId, 
      invoiceFiles: invoiceFiles,
      ticketFiles: ticketFiles,

      // Novo campo (texto) - enviado também como propriedade simples para facilitar o Parse JSON no Power Automate
      budget: (data as any).budget || '',
      
      // ✅ CAMPOS OBRIGATÓRIOS DO SHAREPOINT
      "Qualopedido_x0028_s_x0029__x003f": data.orderNumber || '', // Nome interno exato
      Qualopedido: data.orderNumber || '', // Fallback
      NF: data.invoiceNumber || '',
      Filial: data.branch || '',
      Or_x00e7_amento: (data as any).budget || ''
    };

    // --- LOG DO PAYLOAD FINAL ---
    console.log("📦 PAYLOAD FINAL ENVIADO AO FLUXO:", flowPayload);
    // ----------------------------

    // Dispara o Gatilho
    return await sharepointService.triggerPowerAutomateFlow(flowPayload);
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>, files?: { invoice?: File | File[] | null, ticket?: File | File[] | null }): Promise<boolean> => {
    return await requestService.processFlowSubmission(data, files || {}, "0");
  },

  updateRequest: async (id: string, data: Partial<PaymentRequest>, accessToken: string, files?: { invoice?: File | File[] | null, ticket?: File | File[] | null }): Promise<boolean> => {
    return await requestService.processFlowSubmission(data, files || {}, id);
  },

  changeStatus: async (id: string, status: RequestStatus, accessToken: string, comment?: string): Promise<any> => {
    const update: Partial<PaymentRequest> = { status };
    if (comment) update.generalObservation = comment;
    return await sharepointService.updateRequest(accessToken, id, update);
  },

  shareRequest: async (id: string, shareUserId: string, comment: string, accessToken: string): Promise<any> => {
    return await sharepointService.updateRequest(accessToken, id, {
      sharedWithUserId: shareUserId,
      shareComment: comment,
      statusManual: 'Compartilhado'
    });
  }
};
