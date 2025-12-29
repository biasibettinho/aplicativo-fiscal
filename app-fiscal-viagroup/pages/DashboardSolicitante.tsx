
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, ChevronRight, Clock, Loader2, Calendar, User, CreditCard, Hash, Landmark, Info
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
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
    pixKey: ''
  };

  const [formData, setFormData] = useState<Partial<PaymentRequest>>(initialFormData);

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
  }, [syncData]);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.toString().includes(searchTerm) ||
        req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
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

  const handleCreate = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    try {
      await requestService.createRequest(formData, authState.token);
      await syncData();
      setIsNew(false);
      setFormData(initialFormData);
    } catch (e) {
      alert("Erro ao enviar: " + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tighter">Filtro por Período:</span>
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Início</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 w-44"
          />
        </div>
        <div className="flex items-center space-x-3">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fim</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 w-44"
          />
        </div>
        <button onClick={syncData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
        </button>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 flex items-center text-sm">
                Minhas Solicitações 
                {isLoading && <Loader2 size={14} className="ml-2 animate-spin text-blue-400" />}
              </h3>
              <button 
                onClick={() => { setIsNew(true); setSelectedId(null); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-bold"
              >
                <Plus size={16} className="mr-2" /> Nova Solicitação
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredRequests.map(req => (
              <div 
                key={req.id}
                onClick={() => { setSelectedId(req.id); setIsNew(false); }}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === req.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-mono font-bold text-gray-400">#{req.id}</span>
                  <Badge status={req.status} />
                </div>
                <h4 className="font-semibold text-gray-800 truncate mb-1 text-sm">{req.title}</h4>
                <div className="flex items-center text-[10px] text-gray-500 space-x-3">
                  <span className="flex items-center"><Clock size={10} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                  {req.invoiceNumber && <span className="flex items-center font-bold text-blue-600 tracking-tight">NF: {stripHtml(req.invoiceNumber)}</span>}
                </div>
              </div>
            ))}
            {filteredRequests.length === 0 && !isLoading && (
              <div className="p-10 text-center text-gray-400 italic text-sm">Nenhuma solicitação encontrada.</div>
            )}
          </div>
        </div>

        <div className={`flex-1 rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-500 ${isNew ? 'bg-blue-50' : 'bg-white'}`}>
          {isNew ? (
            <div className="flex-1 overflow-y-auto p-10">
              <div className="max-w-3xl mx-auto space-y-6">
                <header className="flex items-center space-x-4 mb-4 pb-2 border-b border-blue-200">
                  <h2 className="text-2xl font-black text-blue-900 tracking-tight">Nova Solicitação</h2>
                </header>
                
                <div className="space-y-4">
                  <section>
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center"><Info size={12} className="mr-2"/> Dados Básicos</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-blue-800 mb-1">Título / Favorecido <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Pagamento Consultoria Março" />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Número da NF</label>
                          <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Pedido(s)</label>
                          <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="pt-4 border-t border-blue-100">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center"><CreditCard size={12} className="mr-2"/> Dados de Pagamento</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Método</label>
                          <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none">
                            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Data Vencimento</label>
                          <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Banco</label>
                          <input type="text" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" placeholder="Ex: Itaú" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Agência</label>
                          <input type="text" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Conta</label>
                          <input type="text" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-blue-800 mb-1">Tipo de Conta</label>
                          <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none">
                            <option value="Conta Corrente">Conta Corrente</option>
                            <option value="Conta Poupança">Conta Poupança</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-blue-800 mb-1">Chave PIX (se aplicável)</label>
                        <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none" />
                      </div>
                    </div>
                  </section>

                  <div>
                    <label className="block text-xs font-bold text-blue-800 mb-1">Observação</label>
                    <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-white border border-blue-200 rounded-lg p-3 outline-none resize-none" />
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-4">
                  <button onClick={() => setIsNew(false)} className="px-6 py-3 font-bold text-gray-500 uppercase text-xs">Cancelar</button>
                  <button 
                    onClick={handleCreate} 
                    disabled={!isFormValid || isLoading} 
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Criar Solicitação'}
                  </button>
                </div>
              </div>
            </div>
          ) : selectedRequest ? (
            <div className="flex-1 flex flex-col">
              <header className="p-8 border-b border-gray-100 flex justify-between items-center bg-white">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ID SharePoint: #{selectedRequest.id}</span>
                    <Badge status={selectedRequest.status} />
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2>
                </div>
              </header>
              <div className="flex-1 overflow-y-auto p-10 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 flex items-center"><Hash size={12} className="mr-1" /> Nota Fiscal</h4>
                    <p className="text-2xl font-black text-blue-900 break-words">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 shadow-sm">
                    <h4 className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1 flex items-center"><Hash size={12} className="mr-1" /> Pedido</h4>
                    <p className="text-2xl font-black text-blue-900 break-words leading-tight">{stripHtml(selectedRequest.orderNumbers) || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center"><CreditCard size={12} className="mr-1" /> Método</h4>
                    <p className="text-lg font-bold text-slate-900">{selectedRequest.paymentMethod || '---'}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center"><Calendar size={12} className="mr-1" /> Vencimento</h4>
                    <p className="text-lg font-bold text-slate-900">{selectedRequest.paymentDate ? new Date(selectedRequest.paymentDate).toLocaleDateString() : '---'}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start space-x-4">
                   <div className="bg-blue-100 p-3 rounded-xl text-blue-600"><User size={24} /></div>
                   <div>
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Favorecido (Recebedor)</h4>
                      <p className="text-xl font-black text-gray-900">{selectedRequest.payee || selectedRequest.title}</p>
                   </div>
                </div>

                <div className="bg-indigo-50/50 p-8 rounded-3xl border border-indigo-100">
                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 flex items-center"><Landmark size={14} className="mr-2" /> Dados Bancários / PIX</h4>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <div><span className="text-[9px] font-black text-gray-400 uppercase">Banco</span><p className="text-sm font-bold text-gray-900">{selectedRequest.bank || '---'}</p></div>
                    <div><span className="text-[9px] font-black text-gray-400 uppercase">Agência</span><p className="text-sm font-bold text-gray-900">{selectedRequest.agency || '---'}</p></div>
                    <div><span className="text-[9px] font-black text-gray-400 uppercase">Conta</span><p className="text-sm font-bold text-gray-900">{selectedRequest.account || '---'}</p></div>
                    <div><span className="text-[9px] font-black text-gray-400 uppercase">Tipo</span><p className="text-sm font-bold text-gray-900">{selectedRequest.accountType || '---'}</p></div>
                    {selectedRequest.pixKey && (
                      <div className="col-span-full pt-4 border-t border-indigo-100 mt-2">
                        <span className="text-[9px] font-black text-gray-400 uppercase">Chave PIX</span>
                        <p className="text-sm font-mono font-bold text-indigo-700 break-all">{selectedRequest.pixKey}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Observação na Lista:</h4>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed italic">"{selectedRequest.generalObservation || 'Sem observações'}"</p>
                </div>

                {(selectedRequest.status === RequestStatus.ERRO_FISCAL || selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) && (
                  <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center">Atenção: Correção Necessária</h4>
                    <p className="text-sm font-bold text-red-800 mb-1">{selectedRequest.errorType}</p>
                    <p className="text-xs text-red-700 italic">{selectedRequest.errorObservation}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <ChevronRight size={80} className="text-gray-100 mb-4" />
              <h3 className="text-xl font-black text-gray-900 tracking-tight">Painel de Solicitações</h3>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione uma linha da lista para detalhes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSolicitante;
