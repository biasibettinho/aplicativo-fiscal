import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, Clock, Loader2, Calendar, CreditCard, Landmark, Edit3, Send, Paperclip, FileText, Banknote, X
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // ESTADOS PARA ANEXOS
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  
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

  useEffect(() => {
    if (isNew && !isEditing && authState.user?.department) {
      setFormData(prev => ({ ...prev, branch: authState.user?.department }));
    }
  }, [isNew, isEditing, authState.user]);

  const syncData = useCallback(async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const current = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(current);
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setIsLoading(false);
    }
  }, [authState.user, authState.token]);

  useEffect(() => { syncData(); }, [syncData]);

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      const isOwner = req.createdByUserId === authState.user?.id;
      if (!isOwner) return false;
      const matchesSearch = req.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            req.id.toString().includes(searchTerm) ||
                            (req.invoiceNumber && req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, authState.user?.id]);

  const selectedRequest = requests.find(r => r.id === selectedId);
  const isFormValid = useMemo(() => !!formData.title && !!formData.paymentMethod, [formData]);

  const handleSave = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    try {
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP' };
      let itemId = selectedId;

      if (isEditing && selectedId) {
        await sharepointService.updateRequest(authState.token, selectedId, finalData);
      } else {
        const newRequest = await sharepointService.createRequest(authState.token, finalData);
        itemId = newRequest.id;
      }

      if (itemId) {
        // Envio de Notas Fiscais
        for (const file of invoiceFiles) {
          await sharepointService.uploadMainAttachment(authState.token, itemId, file);
        }
        // Envio de Boletos
        for (const file of ticketFiles) {
          await sharepointService.uploadAuxiliaryAttachment(authState.token, itemId, file);
        }
      }

      await syncData();
      setIsNew(false);
      setIsEditing(false);
      setFormData(initialFormData);
      setInvoiceFiles([]);
      setTicketFiles([]);
      alert("Sucesso!");
    } catch (e: any) {
      alert("Erro: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedRequest) return;
    setFormData({
      ...selectedRequest,
      invoiceNumber: stripHtml(selectedRequest.invoiceNumber),
      orderNumbers: stripHtml(selectedRequest.orderNumbers),
      paymentDate: selectedRequest.paymentDate?.split('T')[0]
    });
    setIsEditing(true);
    setIsNew(true);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Barra de Filtros */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tighter">Período:</span>
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none text-gray-700" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm outline-none text-gray-700" />
        <button onClick={syncData} className="p-2 text-blue-600 ml-auto">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
        </button>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        {/* Lista Lateral */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-xs uppercase tracking-widest">Solicitações</h3>
              <button onClick={() => { setIsNew(true); setIsEditing(false); setFormData(initialFormData); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center text-sm font-bold"><Plus size={16} className="mr-2" /> Nova</button>
            </div>
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredRequests.map(req => (
              <div key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); }} className={`p-4 border-b cursor-pointer ${selectedId === req.id ? 'bg-blue-50' : ''}`}>
                <div className="flex justify-between"><span className="text-[10px] font-bold text-gray-400">#{req.id}</span><Badge status={req.status} /></div>
                <h4 className="font-semibold text-gray-800 text-sm truncate">{req.title}</h4>
              </div>
            ))}
          </div>
        </div>

        {/* Formulário Principal */}
        <div className={`flex-1 rounded-2xl shadow-xl overflow-hidden flex flex-col ${isNew ? 'bg-slate-900 text-white' : 'bg-white border'}`}>
          {isNew ? (
            <div className="flex-1 overflow-y-auto p-10 space-y-8">
              <header className="flex justify-between items-center border-b border-white/10 pb-4">
                <h2 className="text-3xl font-black uppercase italic">Nova Solicitação</h2>
                <div className="text-[10px] font-black text-blue-300">FILIAL: {formData.branch}</div>
              </header>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic">Título / Finalidade *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic">NF</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic">Método</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 text-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic">Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic">Pedidos</label>
                  <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4" />
                </div>
              </div>

              {/* CAMPOS DINÂMICOS RESTAURADOS */}
              {formData.paymentMethod === 'TED/DEPOSITO' && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10 grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className="text-[10px] uppercase opacity-50">Favorecido</label><input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/5 border border-white/10 p-2 rounded" /></div>
                  <div><label className="text-[10px] uppercase opacity-50">Banco</label><input type="text" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="w-full bg-white/5 border border-white/10 p-2 rounded" /></div>
                  <div><label className="text-[10px] uppercase opacity-50">Agência</label><input type="text" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="w-full bg-white/5 border border-white/10 p-2 rounded" /></div>
                  <div><label className="text-[10px] uppercase opacity-50">Conta</label><input type="text" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="w-full bg-white/5 border border-white/10 p-2 rounded" /></div>
                  <div><label className="text-[10px] uppercase opacity-50">Tipo</label><select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="w-full bg-white/5 border border-white/10 p-2 rounded text-white bg-slate-900"><option value="Conta Corrente">Conta Corrente</option><option value="Conta Poupança">Conta Poupança</option></select></div>
                </div>
              )}

              {formData.paymentMethod === 'PIX' && (
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <label className="text-[10px] uppercase opacity-50">Chave PIX</label>
                  <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/5 border border-white/20 p-4 rounded-xl" />
                </div>
              )}

              {/* ANEXOS */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <h3 className="text-[10px] font-black uppercase text-blue-300 mb-4 flex items-center"><FileText size={14} className="mr-2" /> Notas Fiscais</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 p-4 rounded-xl cursor-pointer">
                    <Paperclip size={20} className="mb-2 opacity-30" />
                    <span className="text-[9px] uppercase font-bold">{invoiceFiles.length} selecionadas</span>
                    <input type="file" multiple className="hidden" onChange={(e) => setInvoiceFiles(Array.from(e.target.files || []))} />
                  </label>
                </div>
                <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                  <h3 className="text-[10px] font-black uppercase text-blue-300 mb-4 flex items-center"><CreditCard size={14} className="mr-2" /> Boletos</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 p-4 rounded-xl cursor-pointer">
                    <Paperclip size={20} className="mb-2 opacity-30" />
                    <span className="text-[9px] uppercase font-bold">{ticketFiles.length} selecionadas</span>
                    <input type="file" multiple className="hidden" onChange={(e) => setTicketFiles(Array.from(e.target.files || []))} />
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6 border-t border-white/10">
                <button onClick={() => setIsNew(false)} className="text-[10px] font-bold uppercase opacity-50">Cancelar</button>
                <button onClick={handleSave} disabled={isLoading || !isFormValid} className="bg-blue-600 px-8 py-3 rounded-xl font-bold uppercase text-xs flex items-center">
                  {isLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Send size={16} className="mr-2" />} Enviar Solicitação
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 italic">
               <Banknote size={60} className="opacity-10 mb-4" />
               <p className="text-[10px] uppercase font-black">Selecione uma solicitação</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSolicitante;
