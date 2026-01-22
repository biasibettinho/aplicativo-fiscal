import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    if (!user || !accessToken) return [];
    
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      if (user.role === UserRole.ADMIN_MASTER) return all;

      // SOLICITANTE: Filtro Robusto (ID ou Email)
      // Isso garante que o usuário veja seus itens mesmo se houver divergência de Case no ID
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

  // Função dedicada para a tela "Minhas Solicitações" (DashboardSolicitante usado por Admin/Financeiro)
  // Garante que o usuário veja seus próprios itens, ignorando filtros de Role
  getMyRequests: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
      if (!user || !accessToken) return [];

      try {
          // Busca tudo (pode ser otimizado com filtro OData no futuro, mas por segurança filtramos em memória agora)
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
   * Não cria mais o item via Graph antes do envio.
   */
  processFlowSubmission: async (data: Partial<PaymentRequest>, files: { invoice?: File | null, ticket?: File | null }, itemId: string): Promise<boolean> => {
    // Arrays de ficheiros para o Power Automate
    const invoiceFiles: { name: string, content: string }[] = [];
    const ticketFiles: { name: string, content: string }[] = [];

    // Função auxiliar para converter arquivo em Base64 limpo
    const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result?.toString();
        // Remove o prefixo "data:application/pdf;base64," ou similar
        if (result && result.includes(',')) {
          resolve(result.split(',')[1]);
        } else {
          resolve('');
        }
      };
      reader.onerror = error => reject(error);
    });

    // Processa anexos
    if (files.invoice) {
      invoiceFiles.push({
        name: files.invoice.name,
        content: await toBase64(files.invoice)
      });
    }

    if (files.ticket) {
      ticketFiles.push({
        name: files.ticket.name,
        content: await toBase64(files.ticket)
      });
    }

    // Constrói o payload final conforme solicitado
    const flowPayload: any = {
      ...data,
      itemId: itemId, // "0" para novos, ID Real para edições
      invoiceFiles: invoiceFiles,
      ticketFiles: ticketFiles
    };

    // Dispara o Gatilho e aguarda o status da resposta (200/202)
    return await sharepointService.triggerPowerAutomateFlow(flowPayload);
  },

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>, files?: { invoice?: File | null, ticket?: File | null }): Promise<boolean> => {
    // Para novas solicitações, itemId é sempre "0"
    return await requestService.processFlowSubmission(data, files || {}, "0");
  },

  updateRequest: async (id: string, data: Partial<PaymentRequest>, accessToken: string, files?: { invoice?: File | null, ticket?: File | null }): Promise<boolean> => {
    // Para edições, enviamos o ID real do SharePoint
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