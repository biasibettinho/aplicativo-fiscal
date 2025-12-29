
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, Clock, Loader2, Calendar, CreditCard, Landmark, Edit3, Send, Paperclip, FileText, Banknote
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();
  
  const initialFormData: Partial<PaymentRequest> = {
    title: '',
    invoiceNumber: '',
    orderNumbers: '',
    payee: '',
    paymentMethod: 'Boleto',
    paymentDate: todayStr,
    generalObservation: '',
    bank: '',
    agency: '',
    account: '',
    accountType: 'Conta Corrente',
    pixKey: '',
    branch: authState.user?.department || 'Matriz SP'
  };

  const [formData, setFormData] = useState<Partial<PaymentRequest>>(initialFormData);

  // Sincroniza a filial com o Escritório (department) do usuário logado
  useEffect(() => {
    if (authState.user?.department) {
      setFormData(prev => ({ ...prev, branch: authState.user?.department }));
    }
  }, [authState.user, isNew]);

  const syncData = useCallback(async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const current = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(current);
    } catch (e) {
      console.error("Erro ao sincronizar solicitações:", e);
    } finally {
      setIsLoading(false);
    }
  }, [authState.user, authState.token]);

  useEffect(() => {
    syncData();
  }, [syncData]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.toString().includes(searchTerm) ||
        (req.invoiceNumber && req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const reqDate = new Date(req.createdAt);
      reqDate.setHours(0, 0, 0, 0);

      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (reqDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (reqDate > end) matchesDate = false;
      }

      return matchesSearch && matchesDate;
    });
  }, [requests, searchTerm, startDate, endDate]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  const isFormValid = useMemo(() => {
    return !!formData.title && !!formData.paymentMethod;
  }, [formData]);

  const handleSave = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    try {
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP' };
      if (isEditing && selectedId) {
        const currentReq = requests.find(r => r.id === selectedId);
        let nextStatus = (currentReq?.status === RequestStatus.ERRO_FINANCEIRO) ? RequestStatus.APROVADO : RequestStatus.PENDENTE;
        await requestService.updateRequest(selectedId, { ...finalData, status: nextStatus, errorType: '', errorObservation: '' }, authState.token);
      } else {
        await requestService.createRequest(finalData, authState.token);
      }
      await syncData();
      setIsNew(false);
      setIsEditing(false);
      setFormData(initialFormData);
    } catch (e) {
      alert("Erro ao enviar: " + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedRequest) return;
    setFormData({
      title: selectedRequest.title,
      invoiceNumber: stripHtml(selectedRequest.invoiceNumber),
      orderNumbers: stripHtml(selectedRequest.orderNumbers),
      payee: selectedRequest.payee,
      paymentMethod: selectedRequest.paymentMethod,
      paymentDate: selectedRequest.paymentDate?.split('T')[0],
      generalObservation: selectedRequest.generalObservation,
      bank: selectedRequest.bank,
      agency: selectedRequest.agency,
      account: selectedRequest.account,
      accountType: selectedRequest.accountType,
      pixKey: selectedRequest.pixKey,
      branch: selectedRequest.branch
    });
    setIsEditing(true);
    setIsNew(true);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tighter">Período:</span>
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
        <button onClick={syncData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-auto">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
        </button>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-xs uppercase tracking-widest">Solicitações</h3>
              <button onClick={() => { setIsNew(true); setIsEditing(false); setSelectedId(null); setFormData({ ...initialFormData, branch: authState.user?.department || 'Matriz SP' }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-bold shadow-sm"><Plus size={16} className="mr-2" /> Nova</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredRequests.map(req => (
              <div key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); setIsEditing(false); }} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === req.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}>
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-mono font-bold text-gray-400">#{req.id.substring(0,8)}</span>
                  <Badge status={req.status} />
                </div>
                <h4 className="font-semibold text-gray-800 truncate mb-1 text-sm">{req.title}</h4>
                <div className="flex items-center text-[10px] text-gray-500 space-x-3 font-medium">
                  <span className="flex items-center tracking-tighter"><Clock size={10} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                  <span className="text-indigo-600 font-bold uppercase tracking-tight">{req.branch}</span>
                </div>
              </div>
            ))}
            {filteredRequests.length === 0 && !isLoading && (
              <div className="p-8 text-center text-gray-400 text-xs italic">Nenhuma solicitação vinculada ao seu usuário.</div>
            )}
          </div>
        </div>

        <div className={`flex-1 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all ${isNew ? 'bg-gradient-to-br from-[#0a0f2b] via-[#0d1442] to-[#121c4b] text-white' : 'bg-white border border-gray-200'}`}>
          {isNew ? (
            <div className="flex-1 overflow-y-auto p-10">
              <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic">{isEditing ? 'Corrigir Solicitação' : 'Nova Solicitação'}</h2>
                  <div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5">Escritório: {formData.branch}</div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Título da Solicitação <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 text-white" placeholder="Ex: Pagamento Fornecedor de TI" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Nota Fiscal</label>
                    <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Método de Pagamento</label>
                    <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none text-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Data de Vencimento</label>
                    <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none text-white" />
                  </div>
                  
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Pedidos Vinculados</label>
                    <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                  </div>
                </div>

                {/* Bloco Bancário Condicional para TED/DEPOSITO */}
                {formData.paymentMethod === 'TED/DEPOSITO' && (
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6 animate-in slide-in-from-top duration-300">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><Landmark size={14} className="mr-2" /> Detalhes Bancários para Depósito</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Favorecido / Beneficiário</label>
                        <input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Banco</label>
                        <input type="text" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Agência</label>
                        <input type="text" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Conta</label>
                        <input type="text" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bloco PIX Condicional */}
                {formData.paymentMethod === 'PIX' && (
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 animate-in slide-in-from-top duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Chave PIX</label>
                    <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><FileText size={14} className="mr-2" /> Nota Fiscal (PDF)</h3>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer">
                      <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                      <span className="text-[10px] font-bold">Anexar NF</span>
                    </div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><CreditCard size={14} className="mr-2" /> Boleto de Pagamento</h3>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all cursor-pointer">
                      <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                      <span className="text-[10px] font-bold">Anexar Boleto</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300 italic">Observações Adicionais</label>
                  <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none resize-none" />
                </div>

                <div className="pt-8 border-t border-white/10 flex justify-end space-x-6 items-center">
                  <button onClick={() => { setIsNew(false); setIsEditing(false); }} className="font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">Descartar</button>
                  <button onClick={handleSave} disabled={!isFormValid || isLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-2xl shadow-blue-500/20 flex items-center disabled:opacity-30 transition-all active:scale-95">
                    {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={18} className="mr-3" />}
                    {isEditing ? 'Reenviar' : 'Criar Solicitação'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedRequest ? (
            <div className="flex-1 flex flex-col overflow-hidden">
               <header className="p-8 border-b border-gray-100 flex justify-between items-center bg-white shadow-sm">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">#{selectedRequest.id.substring(0,8)} • {selectedRequest.branch}</span>
                    <Badge status={selectedRequest.status} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2>
                </div>
                {authState.user?.role === 'Solicitante' && (selectedRequest.status === 'Erro - Fiscal' || selectedRequest.status === 'Erro - Financeiro') && (
                  <button onClick={startEdit} className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-blue-700">
                    <Edit3 size={18} /><span>Corrigir</span>
                  </button>
                )}
              </header>
              <div className="flex-1 p-10 overflow-y-auto space-y-6 text-gray-700">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                   <div className="bg-gray-50 p-6 rounded-2xl border">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-1">Favorecido</h4>
                      <p className="text-lg font-black text-gray-900">{selectedRequest.payee || '---'}</p>
                   </div>
                   <div className="bg-gray-50 p-6 rounded-2xl border">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-1">Vencimento</h4>
                      <p className="text-lg font-black text-gray-900">{selectedRequest.paymentDate ? new Date(selectedRequest.paymentDate).toLocaleDateString() : '---'}</p>
                   </div>
                   <div className="bg-gray-50 p-6 rounded-2xl border">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-1">Método</h4>
                      <p className="text-lg font-black text-gray-900">{selectedRequest.paymentMethod}</p>
                   </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 space-y-2">
                   <p className="text-xs font-bold uppercase text-gray-400 tracking-widest">Observações:</p>
                   <p className="text-sm italic">"{selectedRequest.generalObservation || 'Nenhuma observação informada.'}"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <Banknote size={80} className="opacity-10 mb-6" />
              <p className="font-black uppercase text-[10px] tracking-widest text-gray-400">Via Group • Plataforma SisPag</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSolicitante;
