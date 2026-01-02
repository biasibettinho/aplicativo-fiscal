
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { sharepointService } from './sharepointService';

export const requestService = {
  getRequestsFiltered: async (user: User, accessToken: string): Promise<PaymentRequest[]> => {
    if (!user || !accessToken) return [];
    
    try {
      const all = await sharepointService.getRequests(accessToken);
      
      if (user.role === UserRole.ADMIN_MASTER) return all;

      if (user.role === UserRole.SOLICITANTE) {
        return all.filter(r => r.createdByUserId === user.id); 
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

  createRequest: async (accessToken: string, data: Partial<PaymentRequest>, files?: { invoice?: File | null, ticket?: File | null }): Promise<any> => {
    // 1. Cria o item no SharePoint via Graph para persistência de metadados
    const item = await sharepointService.createRequest(accessToken, data);
    
    if (item && item.fields) {
      const numericId = item.fields.id || item.fields.ID;
      
      // 2. Prepara a array de arquivos para o Power Automate conforme a nova especificação
      const invoiceFiles: { name: string, content: string }[] = [];

      // Função auxiliar para converter arquivo em Base64
      const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result?.toString().split(',')[1] || '');
        reader.onerror = error => reject(error);
      });

      // 3. Processa e adiciona os anexos na array (Nota Fiscal primeiro, Boleto depois)
      if (files?.invoice) {
        invoiceFiles.push({
          name: files.invoice.name,
          content: await toBase64(files.invoice)
        });
      }

      if (files?.ticket) {
        invoiceFiles.push({
          name: files.ticket.name,
          content: await toBase64(files.ticket)
        });
      }

      // 4. Constrói o payload final
      const flowPayload: any = {
        ...data,
        id: numericId.toString(),
        invoiceFiles: invoiceFiles // Array de objetos conforme solicitado
      };

      // 5. Dispara o Gatilho do Power Automate
      // RESTRIÇÃO: O salvamento direto via sharepointService.addAttachment foi removido.
      // O fluxo é agora o único responsável por processar a array e salvar nas listas.
      await sharepointService.triggerPowerAutomateFlow(flowPayload);
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
