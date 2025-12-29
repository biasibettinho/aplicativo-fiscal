
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, ChevronRight, Clock, Loader2, Calendar, User, CreditCard, Hash, Info, Edit3, Send, Landmark, Banknote, Paperclip, X, FileText
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

  // Garante que a filial seja sempre a do escritório do usuário Microsoft 365
  useEffect(() => {
    if (authState.user?.department) {
      setFormData(prev => ({ ...prev, branch: authState.user?.department }));
    }
  }, [authState.user]);

  const syncData = useCallback(async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const current = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(current);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [authState.user, authState.token]);

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 30000);
    return () => clearInterval(interval);
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
      // Força a filial correta antes de salvar
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP' };
      
      if (isEditing && selectedId) {
        const currentReq = requests.find(r => r.id === selectedId);
        let nextStatus = RequestStatus.PENDENTE;
        if (currentReq?.status === RequestStatus.ERRO_FINANCEIRO) {
          nextStatus = RequestStatus.APROVADO;
        }

        await requestService.updateRequest(selectedId, {
          ...finalData,
          status: nextStatus,
          errorType: '',
          errorObservation: ''
        }, authState.token);
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

  const hasError = (status: string) => status === RequestStatus.ERRO_FISCAL || status === RequestStatus.ERRO_FINANCEIRO;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Filtros Superiores */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tighter">Filtro Período:</span>
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" />
        <button onClick={syncData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-auto">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
        </button>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        {/* Lista Lateral */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-xs uppercase tracking-widest">Minhas Solicitações</h3>
              <button onClick={() => { setIsNew(true); setIsEditing(false); setSelectedId(null); setFormData(initialFormData); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-bold shadow-sm"><Plus size={16} className="mr-2" /> Nova</button>
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
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono font-bold text-gray-400">#{req.id.substring(0,8)}</span>
                    {hasError(req.status) && <Info size={14} className="text-blue-500 animate-pulse" />}
                  </div>
                  <Badge status={req.status} />
                </div>
                <h4 className="font-semibold text-gray-800 truncate mb-1 text-sm">{req.title}</h4>
                <div className="flex items-center text-[10px] text-gray-500 space-x-3 font-medium">
                  <span className="flex items-center tracking-tighter"><Clock size={10} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                  <span className="text-indigo-600 font-bold uppercase tracking-tight">{req.branch}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Área Principal de Conteúdo */}
        <div className={`flex-1 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all ${isNew ? 'bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white' : 'bg-white border border-gray-200'}`}>
          {isNew ? (
            <div className="flex-1 overflow-y-auto p-10">
              <div className="max-w-4xl mx-auto space-y-8">
                <header className="flex items-center justify-between border-b border-white/10 pb-4">
                  <h2 className="text-3xl font-black tracking-tighter">{isEditing ? 'Corrigir Solicitação' : 'Nova Solicitação'}</h2>
                  <div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/5">VIA GROUP • ESCRITÓRIO: {formData.branch}</div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Título Principal */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Título da Solicitação <span className="text-red-400">*</span></label>
                    <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder:text-white/20" placeholder="Ex: Pagamento Fornecedor de TI" />
                  </div>

                  {/* Nota Fiscal e Método */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Nota Fiscal</label>
                    <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Método de Pagamento</label>
                    <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none text-white">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                    </select>
                  </div>

                  {/* Vencimento e Favorecido */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Data de Vencimento</label>
                    <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Favorecido / Beneficiário</label>
                    <input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                  </div>

                  {/* Pedidos */}
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Pedidos Vinculados</label>
                    <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" placeholder="Ex: 123, 456" />
                  </div>
                </div>

                {/* Bloco Bancário Condicional (TED/DEPOSITO) */}
                {formData.paymentMethod === 'TED/DEPOSITO' && (
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6 animate-in slide-in-from-top duration-300">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300"><Landmark size={14} className="mr-2" /> Detalhes Bancários</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Banco</label>
                        <input type="text" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Agência</label>
                        <input type="text" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest mb-1 opacity-60">Conta</label>
                        <input type="text" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-lg p-3 outline-none" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bloco PIX Condicional */}
                {formData.paymentMethod === 'PIX' && (
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 animate-in slide-in-from-top duration-300">
                    <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Chave PIX</label>
                    <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" placeholder="Informe a chave PIX" />
                  </div>
                )}

                {/* Anexos de NF e Boleto */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300"><FileText size={14} className="mr-2" /> Nota Fiscal (PDF)</h3>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-all cursor-pointer">
                      <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                      <span className="text-[10px] font-bold">Anexar Nota Fiscal</span>
                    </div>
                  </div>
                  <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300"><CreditCard size={14} className="mr-2" /> Boleto de Pagamento</h3>
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/5 transition-all cursor-pointer">
                      <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                      <span className="text-[10px] font-bold">Anexar Boleto</span>
                    </div>
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest mb-2 text-blue-300">Observações Adicionais</label>
                  <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none resize-none" placeholder="Detalhes relevantes para o Fiscal ou Financeiro..." />
                </div>

                {/* Rodapé de Ações */}
                <div className="pt-8 border-t border-white/10 flex justify-end space-x-6 items-center">
                  <button onClick={() => { setIsNew(false); setIsEditing(false); }} className="font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">Descartar</button>
                  <button onClick={handleSave} disabled={!isFormValid || isLoading} className="bg-blue-500 hover:bg-blue-400 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs shadow-2xl shadow-blue-500/20 flex items-center disabled:opacity-30 transition-all active:scale-95">
                    {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={18} className="mr-3" />}
                    {isEditing ? 'Reenviar Solicitação' : 'Criar Solicitação'}
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
                {hasError(selectedRequest.status) && (
                  <button onClick={startEdit} className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-md hover:bg-blue-700 transition-all">
                    <Edit3 size={18} /><span>Corrigir Erro</span>
                  </button>
                )}
              </header>
              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                {hasError(selectedRequest.status) && (
                  <div className="bg-blue-50 border-l-8 border-blue-500 p-6 rounded-2xl shadow-sm">
                    <h4 className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Feedback do Analista</h4>
                    <p className="text-sm font-bold text-blue-900 mb-1">Motivo: {selectedRequest.errorType}</p>
                    <p className="text-sm text-blue-800 italic bg-white/50 p-4 rounded-xl">"{selectedRequest.errorObservation}"</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Vencimento</h4>
                    <p className="text-xl font-black text-gray-900">{selectedRequest.paymentDate ? new Date(selectedRequest.paymentDate).toLocaleDateString() : '---'}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Método</h4>
                    <p className="text-xl font-black text-gray-900">{selectedRequest.paymentMethod}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Nota Fiscal</h4>
                    <p className="text-xl font-black text-gray-900 truncate">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                    <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Pedidos</h4>
                    <p className="text-xl font-black text-gray-900 truncate">{stripHtml(selectedRequest.orderNumbers) || '---'}</p>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
                   <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center"><Landmark size={14} className="mr-2" /> Dados para Pagamento</h4>
                   <div className="grid grid-cols-2 gap-y-6">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Favorecido Principal</span>
                        <p className="text-gray-900 font-bold">{selectedRequest.payee || '---'}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Banco / Ag / Conta</span>
                        {selectedRequest.paymentMethod === 'TED/DEPOSITO' ? (
                          <p className="text-gray-900 font-bold">{selectedRequest.bank} • {selectedRequest.agency} / {selectedRequest.account}</p>
                        ) : (
                          <p className="text-gray-400 italic text-xs font-medium uppercase tracking-tighter">Não exigido para {selectedRequest.paymentMethod}</p>
                        )}
                      </div>
                      {selectedRequest.pixKey && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Chave PIX</span>
                          <p className="text-indigo-600 font-black">{selectedRequest.pixKey}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-[9px] font-bold text-gray-400 uppercase block mb-1">Observação do Solicitante</span>
                        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100">{selectedRequest.generalObservation || 'Sem observações detalhadas.'}</p>
                      </div>
                   </div>
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
