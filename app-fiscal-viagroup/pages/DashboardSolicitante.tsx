
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, Clock, Loader2, CreditCard, Landmark, Edit3, Send, Paperclip, FileText, Banknote, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([]);

  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const todayStr = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();
  const initialFormData: Partial<PaymentRequest> = {
    title: '', invoiceNumber: '', orderNumbers: '', payee: '',
    paymentMethod: 'Boleto', paymentDate: todayStr, generalObservation: '',
    bank: '', agency: '', account: '', accountType: 'Conta Corrente',
    pixKey: '', branch: authState.user?.department || 'Matriz SP'
  };

  const [formData, setFormData] = useState<Partial<PaymentRequest>>(initialFormData);

  const syncData = async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const allAvailable = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(allAvailable.filter(r => r.createdByUserId === authState.user?.id));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { syncData(); }, [authState.user, authState.token]);

  const handleSave = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    
    try {
      const finalData = { 
        ...formData, 
        branch: authState.user?.department || 'Matriz SP',
        status: RequestStatus.PROCESSANDO 
      };
      
      let itemId = selectedId;
      if (isEditing && selectedId) {
        await sharepointService.updateRequest(authState.token, selectedId, finalData);
      } else {
        const newReq = await sharepointService.createRequest(authState.token, finalData);
        itemId = newReq.id;
      }

      if (!itemId) throw new Error("ID não gerado.");

      const reqTitle = formData.title;
      const nfNum = formData.invoiceNumber || itemId;

      // DISPARAR POWER AUTOMATE EM BACKGROUND COM ARRAYS SEPARADOS
      if (invoiceFiles.length > 0 || ticketFiles.length > 0) {
        const jobId = Math.random().toString(36).substr(2, 9);
        setBackgroundJobs(prev => [{ id: jobId, title: reqTitle, status: 'Enviando arquivos...', progress: 50 }, ...prev]);
        
        sharepointService.triggerPowerAutomateUpload(itemId, nfNum, invoiceFiles, ticketFiles)
          .then(() => {
             setBackgroundJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Processando na nuvem (2 min)...', progress: 100 } : j));
             setTimeout(() => {
                setBackgroundJobs(prev => prev.filter(j => j.id !== jobId));
                syncData();
             }, 125000); 
          })
          .catch(err => {
             console.error(err);
             alert("Erro no envio para nuvem.");
          });
      }

      setIsNew(false);
      setIsEditing(false);
      setFormData(initialFormData);
      setInvoiceFiles([]);
      setTicketFiles([]);
      syncData();

    } catch (e: any) {
      alert(`Falha: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      const s = searchTerm.toLowerCase();
      return (req.title?.toLowerCase() || '').includes(s) || (req.invoiceNumber?.toLowerCase() || '').includes(s) || (req.id?.toString() || '').includes(s);
    });
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm]);

  const selectedRequest = requests.find(r => r.id === selectedId);
  const isFormValid = useMemo(() => !!formData.title && !!formData.paymentMethod, [formData]);

  const startEdit = () => {
    if (!selectedRequest) return;
    setFormData({ ...selectedRequest, invoiceNumber: stripHtml(selectedRequest.invoiceNumber), orderNumbers: stripHtml(selectedRequest.orderNumbers), paymentDate: selectedRequest.paymentDate?.split('T')[0] });
    setIsEditing(true); setIsNew(true);
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden rounded-2xl border border-gray-200 shadow-sm relative">
      
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col space-y-3 pointer-events-none">
        {backgroundJobs.map(job => (
          <div key={job.id} className="w-80 bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl pointer-events-auto animate-in slide-in-from-right-10">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-[10px] font-black text-white uppercase truncate pr-4">{job.title}</h4>
              {job.progress === 100 ? <CheckCircle2 className="text-green-500" size={14} /> : <Loader2 className="text-blue-500 animate-spin" size={14} />}
            </div>
            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest italic mb-2">{job.status}</p>
            <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
               <div className="bg-blue-600 h-full transition-all duration-[125s] ease-linear" style={{ width: job.progress === 100 ? '100%' : '50%' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">Solicitações</h1>
            <div className="flex items-center space-x-2">
              <button onClick={syncData} className="p-2 text-gray-400 hover:text-blue-600">{isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}</button>
              <button onClick={() => { setIsNew(true); setIsEditing(false); setSelectedId(null); setFormData(initialFormData); setInvoiceFiles([]); setTicketFiles([]); }} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-md"><Plus size={20} /></button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Filtrar por nome ou NF..." className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredRequests.map(req => (
            <button key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); }} className={`w-full p-4 rounded-2xl transition-all text-left border-2 ${selectedId === req.id ? 'bg-blue-50 border-blue-600' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-md">#{req.id}</span><Badge status={req.status} /></div>
              <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{req.title}</h3>
              <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-widest space-x-3"><span className="flex items-center"><Clock size={12} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span><span className="text-blue-500 italic">{req.branch}</span></div>
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 flex flex-col transition-all ${isNew ? 'bg-slate-900 text-white' : 'bg-gray-50'}`}>
        {isNew ? (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar relative">
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-300">
              <header className="flex items-center justify-between border-b border-white/10 pb-8">
                <h2 className="text-3xl font-black uppercase italic tracking-tight">{isEditing ? 'Ajustar Cadastro' : 'Novo Lançamento'}</h2>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Título do Pagamento *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Número da NF</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Meio de Pagamento</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none text-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-800">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Data do Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Nº Pedidos / Ordens</label>
                  <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none text-white" />
                </div>
              </div>

              {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'PIX') && (
                <div className="bg-white/5 p-8 rounded-2xl border border-white/5 space-y-6 shadow-2xl">
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center italic"><Landmark size={18} className="mr-2" /> Detalhes Bancários</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-black uppercase text-white/40 mb-2 tracking-widest">Nome do Favorecido</label>
                       <input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white" />
                    </div>
                    {formData.paymentMethod === 'PIX' ? (
                       <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase text-white/40 mb-2 tracking-widest">Chave PIX</label>
                          <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 outline-none text-white font-mono" />
                       </div>
                    ) : (
                      <>
                        <input type="text" placeholder="Instituição Financeira" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="bg-white/5 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <input type="text" placeholder="Agência" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="bg-white/5 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <input type="text" placeholder="Número da Conta" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="bg-white/5 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="bg-white/5 p-3 rounded-xl border border-white/10 text-white outline-none">
                           <option value="Conta Corrente" className="bg-slate-800">C. Corrente</option>
                           <option value="Conta Poupança" className="bg-slate-800">C. Poupança</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase text-blue-400 mb-2 tracking-widest italic">Notas ou Observações</label>
                <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 outline-none text-white resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/5 p-8 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 italic flex items-center"><FileText size={18} className="mr-2" /> Notas Fiscais (PDF)</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-8 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={32} className="text-blue-400 mb-2 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Selecionar PDF</span>
                    <input type="file" multiple className="hidden" onChange={e => setInvoiceFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {invoiceFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-lg border border-white/5">
                        <span className="truncate flex-1 font-mono">{f.name}</span>
                        <button onClick={() => setInvoiceFiles(invoiceFiles.filter((_, idx) => idx !== i))} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-8 rounded-2xl border border-white/5 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 italic flex items-center"><CreditCard size={18} className="mr-2" /> Boletos / Comprovantes</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl p-8 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={32} className="text-blue-400 mb-2 opacity-20" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Selecionar Arquivos</span>
                    <input type="file" multiple className="hidden" onChange={e => setTicketFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {ticketFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-lg border border-white/5">
                        <span className="truncate flex-1 font-mono">{f.name}</span>
                        <button onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex justify-end space-x-6 items-center pb-12">
                <button onClick={() => setIsNew(false)} className="font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={!isFormValid || isLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-xl font-black uppercase text-xs flex items-center disabled:opacity-30 shadow-xl shadow-blue-900/40">
                  {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={18} className="mr-3" />}
                  {isEditing ? 'Atualizar Dados' : 'Concluir Lançamento'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <header className="p-12 border-b border-gray-200 bg-white flex justify-between items-end shadow-sm">
              <div>
                <div className="flex items-center space-x-3 mb-4"><span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] bg-gray-50 px-3 py-1 rounded-md">ID: {selectedRequest.id}</span><Badge status={selectedRequest.status} /></div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tight uppercase italic">{selectedRequest.title}</h2>
              </div>
              {selectedRequest.status.includes('Erro') && (
                <button onClick={startEdit} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs shadow-xl flex items-center hover:bg-blue-700 transition-all"><Edit3 size={18} className="mr-2" /> Corrigir Dados</button>
              )}
            </header>
            <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 italic">Faturamento</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">NF</span><p className="text-xl font-black text-gray-900 break-words">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p></div>
                    <div><span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Data Limite</span><p className="text-xl font-black text-gray-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6 italic">Pagamento</p>
                  <p className="text-xl font-black text-gray-900 uppercase italic">{selectedRequest.paymentMethod}</p>
                  <p className="text-xs font-bold text-gray-500 mt-2 uppercase tracking-tight truncate">Favorecido: {selectedRequest.payee || '---'}</p>
                </div>
              </div>
              {selectedRequest.status.includes('Erro') && selectedRequest.errorObservation && (
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-start space-x-4">
                   <AlertCircle className="text-red-600" size={24} />
                   <div><h4 className="text-xs font-black uppercase text-red-600 tracking-widest mb-1">Motivo da Reprovação</h4><p className="text-sm text-red-800 font-medium italic">"{selectedRequest.errorObservation}"</p></div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center animate-in fade-in">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-gray-50 mb-8"><Banknote size={80} className="text-blue-50" /></div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase italic">Fluxo de Notas</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2 max-w-xs">Gerencie suas solicitações no menu lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
