
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, Clock, Loader2, CreditCard, Landmark, Edit3, Send, Paperclip, FileText, Banknote, X, AlertCircle, CheckCircle2, ExternalLink
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
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

  // Busca robusta de todos os anexos ao selecionar um item
  useEffect(() => {
    let isMounted = true;
    const fetchAllAttachments = async () => {
      if (selectedId && authState.token) {
        setIsFetchingAttachments(true);
        try {
          // Chamadas em paralelo para otimizar tempo
          const [main, secondary] = await Promise.all([
            sharepointService.getItemAttachments(authState.token, selectedId),
            sharepointService.getSecondaryAttachments(authState.token, selectedId)
          ]);
          
          if (isMounted) {
            console.log(`Anexos carregados para ${selectedId}:`, { main, secondary });
            setMainAttachments(main || []);
            setSecondaryAttachments(secondary || []);
          }
        } catch (e) {
          console.error("Erro crítico ao carregar anexos:", e);
        } finally {
          if (isMounted) setIsFetchingAttachments(false);
        }
      } else {
        setMainAttachments([]);
        setSecondaryAttachments([]);
      }
    };
    
    fetchAllAttachments();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const handleSave = async () => {
    if (!authState.user || !authState.token || !formData.title) return;
    setIsLoading(true);
    try {
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP', status: RequestStatus.PROCESSANDO };
      let itemId = selectedId;
      if (isEditing && selectedId) {
        await sharepointService.updateRequest(authState.token, selectedId, finalData);
      } else {
        const newReq = await sharepointService.createRequest(authState.token, finalData);
        itemId = newReq.id;
      }
      if (!itemId) throw new Error("Erro ao gerar ID no SharePoint.");

      if (invoiceFiles.length > 0 || ticketFiles.length > 0) {
        const jobId = Math.random().toString(36).substr(2, 9);
        setBackgroundJobs(prev => [{ id: jobId, title: formData.title, status: 'Enviando arquivos...', progress: 50 }, ...prev]);
        
        sharepointService.triggerPowerAutomateUpload(itemId, formData.invoiceNumber || itemId, invoiceFiles, ticketFiles)
          .then(() => {
             setBackgroundJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Integrando ao SharePoint (1 min)...', progress: 100 } : j));
             setTimeout(() => { 
                setBackgroundJobs(prev => prev.filter(j => j.id !== jobId)); 
                syncData(); 
                // Se o item enviado for o selecionado, recarrega anexos
                if (selectedId === itemId) {
                   setSelectedId(null);
                   setTimeout(() => setSelectedId(itemId), 500);
                }
             }, 62000); 
          });
      }
      setIsNew(false); setIsEditing(false); setFormData(initialFormData); setInvoiceFiles([]); setTicketFiles([]); syncData();
    } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
  };

  const handleViewFile = (url: string) => {
    if (!url) {
      alert("URL do anexo não disponível.");
      return;
    }
    window.open(url, '_blank');
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toString().includes(searchTerm)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden rounded-2xl border border-gray-200 relative">
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col space-y-3 pointer-events-none">
        {backgroundJobs.map(job => (
          <div key={job.id} className="w-80 bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl pointer-events-auto">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-[11px] font-black text-white uppercase truncate pr-4">{job.title}</h4>
              {job.progress === 100 ? <CheckCircle2 className="text-green-500" size={16} /> : <Loader2 className="text-blue-500 animate-spin" size={16} />}
            </div>
            <p className="text-[10px] text-blue-400 font-bold uppercase italic mb-2">{job.status}</p>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
               <div className="bg-blue-600 h-full transition-all duration-[60s] ease-linear" style={{ width: job.progress === 100 ? '100%' : '50%' }} />
            </div>
          </div>
        ))}
      </div>

      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100 bg-white z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black text-gray-800 uppercase italic">Solicitações</h1>
            <button onClick={() => { setIsNew(true); setSelectedId(null); setFormData(initialFormData); }} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl transition-all active:scale-95"><Plus size={24} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Pesquisar..." className="w-full pl-11 pr-4 py-4 bg-gray-50 border-0 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {filteredRequests.map(req => (
            <button key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); }} className={`w-full p-5 rounded-[2rem] transition-all text-left border-2 ${selectedId === req.id ? 'bg-blue-50 border-blue-600 shadow-lg scale-[1.02]' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-3"><span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-lg">#{req.id}</span><Badge status={req.status} /></div>
              <h3 className="font-black text-gray-900 text-lg mb-2 leading-tight uppercase">{req.title}</h3>
              <div className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-widest space-x-4">
                <span className="flex items-center"><Clock size={14} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                <span className="text-blue-500 italic">{req.branch}</span>
              </div>
            </button>
          ))}
          {filteredRequests.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center opacity-20">
              <History size={48} className="mb-4" />
              <p className="text-xs font-black uppercase tracking-widest">Nenhuma solicitação</p>
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col transition-all ${isNew ? 'bg-white' : 'bg-gray-50'}`}>
        {isNew ? (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <header className="border-b border-gray-100 pb-8"><h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900">{isEditing ? 'Editar Registro' : 'Novo Lançamento'}</h2></header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="md:col-span-2">
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Descrição do Pagamento *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 text-2xl font-bold" />
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Número da NF</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none text-slate-900 text-xl font-bold" />
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Meio de Pagamento</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none text-slate-900 text-xl font-bold">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none text-slate-900 text-xl font-bold" />
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Pedidos / Ordens de Compra</label>
                  <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none text-slate-900 text-xl font-bold" />
                </div>

                {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'PIX') && (
                  <div className="md:col-span-2 bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100 space-y-6">
                    <h3 className="text-lg font-black uppercase tracking-widest text-blue-600 flex items-center italic"><Landmark size={24} className="mr-3" /> Detalhes do Favorecido</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <input type="text" placeholder="Nome do Favorecido" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-slate-900 text-lg font-bold" />
                      </div>
                      {formData.paymentMethod === 'PIX' ? (
                        <div className="md:col-span-2">
                          <input type="text" placeholder="Chave PIX" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-slate-900 font-mono text-lg" />
                        </div>
                      ) : (
                        <>
                          <input type="text" placeholder="Banco" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="bg-white p-4 rounded-xl border border-gray-200 text-slate-900 font-bold" />
                          <input type="text" placeholder="Agência" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="bg-white p-4 rounded-xl border border-gray-200 text-slate-900 font-bold" />
                          <input type="text" placeholder="Conta" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="bg-white p-4 rounded-xl border border-gray-200 text-slate-900 font-bold" />
                          <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="bg-white p-4 rounded-xl border border-gray-200 text-slate-900 font-bold">
                            <option value="Conta Corrente">C. Corrente</option>
                            <option value="Conta Poupança">C. Poupança</option>
                          </select>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="text-sm font-black uppercase text-blue-600 mb-3 block italic">Observações</label>
                  <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 outline-none text-slate-900 text-lg resize-none" />
                </div>

                <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-4">
                  <h3 className="text-xs font-black uppercase text-blue-600 italic flex items-center"><FileText size={18} className="mr-2" /> Nota Fiscal (PDF)</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:bg-white cursor-pointer transition-all active:scale-95">
                    <Paperclip size={32} className="text-blue-600 mb-2 opacity-40" />
                    <span className="text-[10px] font-black uppercase text-slate-500">Selecionar NF</span>
                    <input type="file" multiple className="hidden" onChange={e => setInvoiceFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {invoiceFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 text-xs">
                        <span className="truncate flex-1 font-mono font-bold text-slate-700">{f.name}</span>
                        <button onClick={() => setInvoiceFiles(invoiceFiles.filter((_, idx) => idx !== i))} className="text-red-500 ml-2 hover:bg-red-50 p-1 rounded"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-4">
                  <h3 className="text-xs font-black uppercase text-blue-600 italic flex items-center"><CreditCard size={18} className="mr-2" /> Boletos / Comprovantes</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-10 hover:bg-white cursor-pointer transition-all active:scale-95">
                    <Paperclip size={32} className="text-blue-600 mb-2 opacity-40" />
                    <span className="text-[10px] font-black uppercase text-slate-500">Selecionar Boletos</span>
                    <input type="file" multiple className="hidden" onChange={e => setTicketFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {ticketFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-100 text-xs">
                        <span className="truncate flex-1 font-mono font-bold text-slate-700">{f.name}</span>
                        <button onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} className="text-red-500 ml-2 hover:bg-red-50 p-1 rounded"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-10 flex justify-end space-x-8 items-center border-t border-gray-100 mb-12">
                <button onClick={() => setIsNew(false)} className="font-black uppercase text-sm text-gray-400 hover:text-slate-900 transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={isLoading || !formData.title} className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-6 rounded-2xl font-black uppercase text-lg flex items-center shadow-2xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                  {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={24} className="mr-3" />} Finalizar Lançamento
                </button>
              </div>
            </div>
          </div>
        ) : selectedRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
            <header className="p-12 bg-white border-b flex justify-between items-end shadow-sm">
              <div>
                <div className="flex items-center space-x-6 mb-6">
                  <span className="text-lg font-black text-gray-400 bg-gray-50 px-6 py-2 rounded-xl border">ID: {selectedRequest.id}</span>
                  <Badge status={selectedRequest.status} className="scale-125 ml-4" />
                </div>
                <h2 className="text-6xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedRequest.title}</h2>
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-600 uppercase mb-8 border-b pb-4 flex items-center italic"><Banknote size={20} className="mr-3"/> Dados Fiscais</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Número da Nota Fiscal</span>
                      <p className="text-5xl font-black text-slate-900 leading-none">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Vencimento</span><p className="text-3xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Pedidos</span><p className="text-3xl font-black text-slate-900">{stripHtml(selectedRequest.orderNumbers) || '---'}</p></div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-600 uppercase mb-8 border-b pb-4 flex items-center italic"><CreditCard size={20} className="mr-3"/> Pagamento</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Modalidade</span>
                      <p className="text-4xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod}</p>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Favorecido</span>
                      <p className="text-2xl font-bold text-slate-800 break-words leading-tight uppercase">{selectedRequest.payee || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] border-2 border-gray-100 shadow-2xl relative">
                <div className="flex items-center justify-between mb-10 border-b pb-6">
                  <h3 className="text-2xl font-black text-slate-900 uppercase italic flex items-center"><FileText size={28} className="mr-4 text-blue-600"/> Documentação e Anexos</h3>
                  {isFetchingAttachments && <div className="flex items-center text-blue-600 font-bold uppercase text-xs animate-pulse"><Loader2 className="animate-spin mr-2" /> Carregando arquivos...</div>}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-12">
                     <div>
                       <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 italic">Nota Fiscal Principal (SharePoint):</p>
                       {mainAttachments.length > 0 ? (
                         <div className="space-y-3">
                           {mainAttachments.map(att => (
                             <div key={att.id} className="p-6 bg-blue-50/40 border border-blue-100 rounded-[2rem] flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                               <div className="flex items-center space-x-6">
                                 <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform"><FileText size={24} /></div>
                                 <span className="text-lg font-black text-slate-800 max-w-[200px] truncate leading-tight">{att.fileName}</span>
                               </div>
                               <button onClick={() => handleViewFile(att.storageUrl)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-md flex items-center"><ExternalLink size={16} className="mr-2" /> Abrir</button>
                             </div>
                           ))}
                         </div>
                       ) : !isFetchingAttachments ? <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 font-bold italic uppercase text-[10px]">Nenhuma NF vinculada no SharePoint</div> : null}
                     </div>

                     <div>
                       <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 italic">Boletos e Comprovantes (Lookup ID_SOL):</p>
                       {secondaryAttachments.length > 0 ? (
                         <div className="space-y-3">
                           {secondaryAttachments.map(att => (
                             <div key={att.id} className="p-6 bg-indigo-50/40 border border-indigo-100 rounded-[2rem] flex items-center justify-between group shadow-sm hover:shadow-md transition-all">
                               <div className="flex items-center space-x-6">
                                 <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform"><Paperclip size={24} /></div>
                                 <span className="text-lg font-black text-slate-800 max-w-[200px] truncate leading-tight">{att.fileName}</span>
                               </div>
                               <button onClick={() => handleViewFile(att.storageUrl)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 transition-all shadow-md flex items-center"><ExternalLink size={16} className="mr-2" /> Abrir</button>
                             </div>
                           ))}
                         </div>
                       ) : !isFetchingAttachments ? <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 font-bold italic uppercase text-[10px]">Sem boletos pendentes via lookup</div> : null}
                     </div>
                   </div>
                   <div className="bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100 shadow-inner">
                      <span className="text-xs font-black text-gray-400 uppercase block mb-4 italic">Observações Internas</span>
                      <p className="text-2xl font-medium text-slate-600 leading-relaxed italic">"{selectedRequest.generalObservation || 'Nenhuma instrução adicional.'}"</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 animate-pulse">
            <div className="bg-white p-16 rounded-[4.5rem] shadow-2xl border border-gray-50 mb-10"><Banknote size={120} className="text-blue-100" /></div>
            <h3 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">Fluxo de Notas</h3>
            <p className="text-lg font-bold text-gray-400 uppercase tracking-widest mt-6 max-w-sm leading-relaxed">Acesse o menu lateral para conferir o status e os documentos das suas solicitações.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
