mport { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      let filtered: PaymentRequest[] = [];

      // 1. Aplicamos os filtros de acordo com o papel do usuário
      if (user.role === UserRole.ADMIN_MASTER || user.role === UserRole.FISCAL_COMUM || user.role === UserRole.FISCAL_ADMIN) {
        filtered = all;
      } else if (user.role === UserRole.SOLICITANTE) {
        // Filtra para o solicitante ver apenas o que ele criou
        filtered = all.filter(r => r.createdByUserId === user.id); 
      } else if (user.role === UserRole.FINANCEIRO || user.role === UserRole.FINANCEIRO_MASTER) {
        const financeAllowed = [
          RequestStatus.APROVADO, 
          RequestStatus.LANCADO, 
          RequestStatus.FATURADO, 
          RequestStatus.ERRO_FINANCEIRO, 
          RequestStatus.COMPARTILHADO
        ];
        filtered = all.filter(r => financeAllowed.includes(r.status) || r.statusManual === 'Compartilhado');
      }

      // 2. ORDENAÇÃO DECRESCENTE (ID maior primeiro)
      // Usamos Number() para garantir que a comparação seja numérica e não alfabética
      return filtered.sort((a, b) => Number(b.id) - Number(a.id));

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
