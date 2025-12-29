
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { supabase } from './supabase';

export const requestService = {
  getRequestsFiltered: async (user: User, _token: string): Promise<PaymentRequest[]> => {
    try {
      let query = supabase
        .from('payment_requests')
        .select(`
          *,
          attachments (*)
        `);

      if (user.role === UserRole.SOLICITANTE) {
        query = query.eq('created_by_user_id', user.id);
      } else if (user.role === UserRole.FINANCEIRO || user.role === UserRole.FINANCEIRO_MASTER) {
        query = query.or(`status.in.("${RequestStatus.APROVADO}","${RequestStatus.LANCADO}","${RequestStatus.FATURADO}","${RequestStatus.ERRO_FINANCEIRO}","${RequestStatus.COMPARTILHADO}"),shared_with_user_id.eq.${user.id}`);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;

      return (data || []).map(r => ({
        ...r,
        id: r.id.toString(),
        invoiceNumber: r.invoice_number,
        orderNumbers: r.order_numbers,
        paymentMethod: r.payment_method,
        paymentDate: r.payment_date,
        generalObservation: r.general_observation,
        errorType: r.error_type,
        errorObservation: r.error_observation,
        accountType: r.account_type,
        pixKey: r.pix_key,
        createdByUserId: r.created_by_user_id,
        createdByName: r.created_by_name,
        bank: r.bank,
        agency: r.agency,
        account: r.account,
        branch: r.branch
      })) as PaymentRequest[];
    } catch (error) {
      console.error("Erro Supabase:", error);
      return [];
    }
  },

  createRequest: async (data: Partial<PaymentRequest>, _token: string): Promise<any> => {
    const sessionStr = localStorage.getItem('sispag_session');
    const user = sessionStr ? JSON.parse(sessionStr).user : null;

    const { data: result, error } = await supabase
      .from('payment_requests')
      .insert([{
        title: data.title,
        invoice_number: data.invoiceNumber,
        order_numbers: data.orderNumbers,
        payee: data.payee,
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate,
        general_observation: data.generalObservation,
        bank: data.bank,
        agency: data.agency,
        account: data.account,
        account_type: data.accountType,
        pix_key: data.pixKey,
        status: RequestStatus.PENDENTE,
        created_by_user_id: user?.id,
        created_by_name: user?.name,
        branch: data.branch || user?.department || 'Matriz SP'
      }])
      .select();

    if (error) throw error;
    return result[0];
  },

  updateRequest: async (id: string, data: Partial<PaymentRequest>, _token: string): Promise<any> => {
    const payload: any = {
      updated_at: new Date().toISOString()
    };
    
    if (data.title) payload.title = data.title;
    if (data.status) payload.status = data.status;
    if (data.invoiceNumber !== undefined) payload.invoice_number = data.invoiceNumber;
    if (data.orderNumbers !== undefined) payload.order_numbers = data.orderNumbers;
    if (data.payee) payload.payee = data.payee;
    if (data.paymentMethod) payload.payment_method = data.paymentMethod;
    if (data.paymentDate) payload.payment_date = data.paymentDate;
    if (data.bank) payload.bank = data.bank;
    if (data.agency) payload.agency = data.agency;
    if (data.account) payload.account = data.account;
    if (data.accountType) payload.account_type = data.accountType;
    if (data.pixKey !== undefined) payload.pix_key = data.pixKey;
    if (data.errorType !== undefined) payload.error_type = data.errorType;
    if (data.errorObservation !== undefined) payload.error_observation = data.errorObservation;
    if (data.generalObservation !== undefined) payload.general_observation = data.generalObservation;
    if (data.branch) payload.branch = data.branch;

    const { error } = await supabase
      .from('payment_requests')
      .update(payload)
      .eq('id', id);

    if (error) throw error;
    return true;
  },

  // Fix: Added changeStatus method to handle status transitions from fiscal and financial dashboards
  changeStatus: async (id: string, status: RequestStatus, _token: string, _comment?: string): Promise<any> => {
    const { error } = await supabase
      .from('payment_requests')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
