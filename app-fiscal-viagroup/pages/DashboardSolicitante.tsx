import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, History, Loader2, Calendar, CreditCard, Edit3, Send, Paperclip, FileText, Banknote, X
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // ESTADOS PARA CONTROLE DE ARQUIVOS
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

  // Sincronização de dados
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

  useEffect(() => {
    syncData();
  }, [syncData]);

  // Filtros de busca
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const isOwner = req.createdByUserId === authState.user?.id;
      if (!isOwner) return false;
      const matchesSearch = 
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.id.toString().includes(searchTerm) ||
        (req.invoiceNumber && req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, authState.user?.id]);

  const selectedRequest = requests.find(r => r.id === selectedId);
  const isFormValid = useMemo(() => !!formData.title && !!formData.paymentMethod, [formData]);

  // FUNÇÃO DE SALVAMENTO PRINCIPAL
  const handleSave = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    
    try {
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP' };
      let itemId = selectedId;

      // 1. Criar ou Atualizar Registro de Texto
      if (isEditing && selectedId) {
        await sharepointService.updateRequest(authState.token, selectedId, finalData);
      } else {
        const newRequest = await sharepointService.createRequest(authState.token, finalData);
        itemId = newRequest.id;
      }

      if (!itemId) throw new Error("ID do item não encontrado.");

      // 2. Upload de Notas Fiscais (Lista Principal)
      for (const file of invoiceFiles) {
        await sharepointService.uploadMainAttachment(authState.token, itemId, file);
      }

      // 3. Upload de Boletos (Lista Auxiliar)
      for (const file of ticketFiles) {
        await sharepointService.uploadAuxiliaryAttachment(authState.token, itemId, file);
      }

      alert("Solicitação processada com sucesso!");
      
      // Reset de estados após sucesso
      setIsNew(false);
      setIsEditing(false);
      setFormData(initialFormData);
      setInvoiceFiles([]);
      setTicketFiles([]);
      setSelectedId(null);
      await syncData();

    } catch (e: any) {
      console.error("Erro no salvamento:", e);
      alert(`Erro: ${e.message || "Erro ao processar solicitação"}`);
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
      {/* HEADER DE FILTROS */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-bold text-gray-700 uppercase tracking-tighter">Filtros:</span>
        </div>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-gray-200 rounded-lg px-4 py-2 text-sm outline-none" />
        <button onClick={syncData} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg ml-auto">
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
        </button>
      </div>

      <div className="flex flex-1 space-x-6 overflow-hidden">
        {/* LISTA LATERAL */}
        <div className="w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-gray-900 text-[10px] uppercase tracking-widest">Minhas Solicitações</h3>
              <button 
                onClick={() => { setIsNew(true); setIsEditing(false); setSelectedId(null); setFormData(initialFormData); setInvoiceFiles([]); setTicketFiles([]); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700"
              >
                <Plus size={16} className="mr-2 inline" /> Nova
              </button>
            </div>
            <input type="text" placeholder="Buscar por título ou ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredRequests.map(req => (
              <div key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); }} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === req.id ? 'bg-blue-50 border-r-4 border-blue-500' : ''}`}>
                <div className="flex justify-between mb-1"><span className="text-[10px] font-mono font-bold text-gray-400">#{req.id}</span><Badge status={req.status} /></div>
                <h4 className="font-semibold text-gray-800 truncate text-sm">{req.title}</h4>
                <div className="text-[10px] text-gray-500 mt-1 uppercase font-bold text-blue-600">{req.branch}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ÁREA DE CONTEÚDO (DARK MODE FORM) */}
        <div className={`flex-1 rounded-2xl shadow-xl overflow-hidden flex flex-col transition-all ${isNew ? 'bg-[#0a0f2b] text-white' : 'bg-white border border-gray-200'}`}>
          {isNew ? (
            <div className="flex-1 overflow-y-auto p-10 space-y-8">
              <header className="flex items-center justify-between border-b border-white/10 pb-4">
                <h2 className="text-3xl font-black tracking-tighter uppercase italic">{isEditing ? 'Editar Solicitação' : 'Nova Solicitação'}</h2>
                <div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-black uppercase text-blue-300 italic">Filial: {formData.branch}</div>
              </header>

              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Título / Finalidade *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Nº Nota Fiscal</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Método de Pagamento</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none text-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Data de Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Nº Pedidos / Ordens</label>
                  <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-xl p-4 outline-none" />
                </div>
              </div>

              {/* DADOS PARA TED OU PIX */}
              {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'PIX') && (
                <div className="bg-white/5 p-6 rounded-3xl border border-white/10 grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase text-blue-300 italic">Favorecido (Nome/Razão Social)</label>
                    <input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/10 border-none rounded-lg p-3 mt-1 text-white" />
                  </div>
                  {formData.paymentMethod === 'PIX' ? (
                    <div className="col-span-2">
                      <label className="text-[10px] font-black uppercase text-blue-300 italic">Chave PIX</label>
                      <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/10 border-none rounded-lg p-3 mt-1 font-mono" />
                    </div>
                  ) : (
                    <>
                      <input type="text" placeholder="Banco" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="bg-white/10 p-3 rounded-lg outline-none" />
                      <input type="text" placeholder="Agência" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="bg-white/10 p-3 rounded-lg outline-none" />
                      <input type="text" placeholder="Conta" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="bg-white/10 p-3 rounded-lg outline-none" />
                      <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="bg-white/10 p-3 rounded-lg text-white bg-slate-800">
                        <option value="Conta Corrente">C. Corrente</option>
                        <option value="Conta Poupança">C. Poupança</option>
                      </select>
                    </>
                  )}
                </div>
              )}

              {/* ANEXOS */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><FileText size={16} className="mr-2" /> Notas Fiscais (PDF)</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{invoiceFiles.length > 0 ? `${invoiceFiles.length} Selecionado(s)` : 'Adicionar NF'}</span>
                    <input type="file" multiple className="hidden" onChange={(e) => setInvoiceFiles(Array.from(e.target.files || []))} />
                  </label>
                  {invoiceFiles.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded border border-white/5">
                      <span className="truncate w-40">{f.name}</span>
                      <X size={12} className="text-red-400 cursor-pointer" onClick={() => setInvoiceFiles(invoiceFiles.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                </div>

                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><CreditCard size={16} className="mr-2" /> Boletos / Comprovantes</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-6 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={24} className="text-blue-300 mb-2 opacity-30" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{ticketFiles.length > 0 ? `${ticketFiles.length} Selecionado(s)` : 'Adicionar Boleto'}</span>
                    <input type="file" multiple className="hidden" onChange={(e) => setTicketFiles(Array.from(e.target.files || []))} />
                  </label>
                  {ticketFiles.map((f, i) => (
                    <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-2 rounded border border-white/5">
                      <span className="truncate w-40">{f.name}</span>
                      <X size={12} className="text-red-400 cursor-pointer" onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex justify-end space-x-6 items-center">
                <button type="button" onClick={() => setIsNew(false)} className="font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">Cancelar</button>
                <button 
                  onClick={handleSave} 
                  disabled={!isFormValid || isLoading} 
                  className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs flex items-center disabled:opacity-30 transition-all shadow-lg"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={18} className="mr-3" />}
                  {isEditing ? 'Atualizar Dados' : 'Enviar Solicitação'}
                </button>
              </div>
            </div>
          ) : selectedRequest ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
               <header className="p-8 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest font-mono">ID: #{selectedRequest.id}</span>
                    <Badge status={selectedRequest.status} />
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2>
                </div>
                {(selectedRequest.status === RequestStatus.ERRO_FISCAL || selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) && (
                  <button onClick={startEdit} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center hover:bg-blue-700">
                    <Edit3 size={18} className="mr-2" /> Editar e Reenviar
                  </button>
                )}
              </header>
              <div className="flex-1 p-10 overflow-y-auto space-y-6 bg-gray-50/30">
                <div className="grid grid-cols-3 gap-6">
                   <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Nota Fiscal</h4>
                      <p className="text-lg font-black text-gray-900">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                   </div>
                   <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Vencimento</h4>
                      <p className="text-lg font-black text-gray-900">{selectedRequest.paymentDate ? new Date(selectedRequest.paymentDate).toLocaleDateString() : '---'}</p>
                   </div>
                   <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                      <h4 className="text-[9px] font-black text-gray-400 uppercase mb-2">Método</h4>
                      <p className="text-lg font-black text-blue-600 uppercase italic">{selectedRequest.paymentMethod}</p>
                   </div>
                </div>
                {selectedRequest.generalObservation && (
                  <div className="bg-white p-8 rounded-3xl border border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Observações</h4>
                    <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                      {selectedRequest.generalObservation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
              <Banknote size={80} className="opacity-10 mb-6" />
              <p className="font-black uppercase text-[10px] tracking-widest text-gray-400 italic">Selecione uma solicitação para visualizar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardSolicitante;
