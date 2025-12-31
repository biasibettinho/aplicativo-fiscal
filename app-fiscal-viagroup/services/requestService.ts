
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    if (!user || !accessToken) return [];
    
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      if (
        user.role === UserRole.ADMIN_MASTER || 
        user.role === UserRole.FISCAL_ADMIN || 
        user.role === UserRole.FISCAL_COMUM
      ) {
        return all;
      }

      if (user.role === UserRole.SOLICITANTE) {
        return all.filter(r => 
          r.createdByUserId === user.id || 
          r.createdByName.toLowerCase().includes(user.name.split(' ')[0].toLowerCase())
        ); 
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

  // Fixed parameter ordering to match the call site in DashboardSolicitante.tsx (accessToken, data, files)
  createRequest: async (accessToken: string, data: Partial<PaymentRequest>, files?: { invoice?: File | null, ticket?: File | null }): Promise<any> => {
    const item = await sharepointService.createRequest(accessToken, data);
    if (item && item.id && files) {
      // Usa o ID numérico (fields.id) retornado pelo Graph se disponível, senão tenta extrair
      const numericId = item.fields?.id || item.fields?.ID;
      if (numericId) {
        if (files.invoice) await sharepointService.addAttachment(accessToken, numericId.toString(), files.invoice);
        if (files.ticket) await sharepointService.addAttachment(accessToken, numericId.toString(), files.ticket);
      }
    }
    return item;
  },

  updateRequest: async (id: string, data: Partial<PaymentRequest>, accessToken: string): Promise<any> => {
    return await sharepointService.updateRequest(accessToken, id, data);
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
