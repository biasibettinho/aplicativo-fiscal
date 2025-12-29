
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      if (user.role === UserRole.ADMIN_MASTER || user.role === UserRole.FISCAL_COMUM || user.role === UserRole.FISCAL_ADMIN) {
        return all;
      }

      if (user.role === UserRole.SOLICITANTE) {
        // Agora filtramos para que o solicitante veja apenas o que ele criou
        return all.filter(r => r.createdByUserId === user.id); 
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
      console.error("Erro ao filtrar solicitações do SharePoint:", error);
      return [];
    }
  },

  createRequest: async (data: Partial<PaymentRequest>, accessToken: string): Promise<any> => {
    return await sharepointService.createRequest(accessToken, data);
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
