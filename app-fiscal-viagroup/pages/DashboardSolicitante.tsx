
// ... (mantenha os imports iguais)
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
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([]);
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const selectedRequest = requests.find(r => r.id === selectedId);

  const syncData = async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const allAvailable = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(allAvailable.filter(r => r.createdByUserId === authState.user?.id));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { syncData(); }, [authState.user, authState.token]);

  useEffect(() => {
    let isMounted = true;
    const fetchAllAttachments = async () => {
      if (selectedRequest && authState.token) {
        setIsFetchingAttachments(true);
        try {
          const [main, secondary] = await Promise.all([
            sharepointService.getItemAttachments(authState.token, selectedRequest.graphId),
            sharepointService.getSecondaryAttachments(authState.token, selectedRequest.id)
          ]);
          
          if (isMounted) {
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

  // ... (restante do componente igual, apenas garanta que o useMemo e os botões usem r.id como chave de seleção)
  const filteredRequests = useMemo(() => {
    return requests.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.id.toString().includes(searchTerm)
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm]);

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
            <button onClick={() => setSelectedId(null)} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl transition-all active:scale-95"><Plus size={24} /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Pesquisar..." className="w-full pl-11 pr-4 py-4 bg-gray-50 border-0 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {filteredRequests.map(req => (
            <button key={req.id} onClick={() => { setSelectedId(req.id); }} className={`w-full p-5 rounded-[2rem] transition-all text-left border-2 ${selectedId === req.id ? 'bg-blue-50 border-blue-600 shadow-lg scale-[1.02]' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-3"><span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-lg">#{req.id}</span><Badge status={req.status} /></div>
              <h3 className="font-black text-gray-900 text-lg mb-2 leading-tight uppercase">{req.title}</h3>
              <div className="flex items-center text-[11px] font-black text-gray-400 uppercase tracking-widest space-x-4">
                <span className="flex items-center"><Clock size={14} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                <span className="text-blue-500 italic">{req.branch}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={`flex-1 flex flex-col bg-gray-50`}>
        {selectedRequest ? (
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
                      <p className="text-5xl font-black text-slate-900 leading-none">{selectedRequest.invoiceNumber || '---'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Vencimento</span><p className="text-3xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Pedidos</span><p className="text-3xl font-black text-slate-900">{selectedRequest.orderNumbers || '---'}</p></div>
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
                  {isFetchingAttachments && <div className="flex items-center text-blue-600 font-bold uppercase text-xs animate-pulse"><Loader2 className="animate-spin mr-2" /> Sincronizando arquivos...</div>}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-12">
                     <div>
                       <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 italic">Nota Fiscal Principal:</p>
                       {mainAttachments.map(att => (
                         <div key={att.id} className="p-6 bg-blue-50/40 border border-blue-100 rounded-[2rem] flex items-center justify-between mb-3 group">
                           <div className="flex items-center space-x-6">
                             <div className="bg-blue-600 text-white p-4 rounded-2xl"><FileText size={24} /></div>
                             <span className="text-lg font-black text-slate-800 max-w-[200px] truncate">{att.fileName}</span>
                           </div>
                           <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase"><ExternalLink size={16} /></button>
                         </div>
                       ))}
                       {mainAttachments.length === 0 && !isFetchingAttachments && <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 italic">Nenhuma NF encontrada.</div>}
                     </div>
                     <div>
                       <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 italic">Boletos e Comprovantes:</p>
                       {secondaryAttachments.map(att => (
                         <div key={att.id} className="p-6 bg-indigo-50/40 border border-indigo-100 rounded-[2rem] flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-6">
                             <div className="bg-indigo-600 text-white p-4 rounded-2xl"><Paperclip size={24} /></div>
                             <span className="text-lg font-black text-slate-800 max-w-[200px] truncate">{att.fileName}</span>
                           </div>
                           <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase"><ExternalLink size={16} /></button>
                         </div>
                       ))}
                       {secondaryAttachments.length === 0 && !isFetchingAttachments && <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 italic">Sem boletos vinculados.</div>}
                     </div>
                   </div>
                   <div className="bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100">
                      <span className="text-xs font-black text-gray-400 uppercase block mb-4 italic">Observações Internas</span>
                      <p className="text-2xl font-medium text-slate-600 leading-relaxed italic">"{selectedRequest.generalObservation || 'Sem observações.'}"</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-30">
            <Banknote size={120} className="mb-6" />
            <h3 className="text-2xl font-black uppercase italic tracking-widest">Painel de Notas</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
