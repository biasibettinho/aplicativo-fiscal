
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
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
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
      if (!itemId) throw new Error("Erro ao gerar ID.");

      if (invoiceFiles.length > 0 || ticketFiles.length > 0) {
        const jobId = Math.random().toString(36).substr(2, 9);
        setBackgroundJobs(prev => [{ id: jobId, title: formData.title, status: 'Transmitindo arquivos...', progress: 50 }, ...prev]);
        sharepointService.triggerPowerAutomateUpload(itemId, formData.invoiceNumber || itemId, invoiceFiles, ticketFiles)
          .then(() => {
             setBackgroundJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'Processando na nuvem (2 min)...', progress: 100 } : j));
             setTimeout(() => { setBackgroundJobs(prev => prev.filter(j => j.id !== jobId)); syncData(); }, 125000);
          });
      }
      setIsNew(false); setIsEditing(false); setFormData(initialFormData); setInvoiceFiles([]); setTicketFiles([]); syncData();
    } catch (e: any) { alert(e.message); } finally { setIsLoading(false); }
  };

  const handleViewFile = (storageUrl: string) => {
    if (!storageUrl) return;
    // O SharePoint retorna os bytes do arquivo em storageUrl (base64)
    try {
      const blob = new Blob([new Uint8Array(atob(storageUrl).split("").map(c => c.charCodeAt(0)))], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // Fallback para URL direta se não for base64 puro
      window.open(storageUrl, '_blank');
    }
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
      {/* Notificações de Processamento */}
      <div className="fixed bottom-6 right-6 z-[60] flex flex-col space-y-3 pointer-events-none">
        {backgroundJobs.map(job => (
          <div key={job.id} className="w-80 bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-2xl pointer-events-auto">
            <div className="flex justify-between items-start mb-2">
              <h4 className="text-[11px] font-black text-white uppercase truncate pr-4">{job.title}</h4>
              {job.progress === 100 ? <CheckCircle2 className="text-green-500" size={16} /> : <Loader2 className="text-blue-500 animate-spin" size={16} />}
            </div>
            <p className="text-[10px] text-blue-400 font-bold uppercase italic mb-2">{job.status}</p>
            <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
               <div className="bg-blue-600 h-full transition-all duration-[125s] ease-linear" style={{ width: job.progress === 100 ? '100%' : '50%' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Menu Lateral */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-100 bg-white z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black text-gray-800 uppercase italic">Solicitações</h1>
            <button onClick={() => { setIsNew(true); setSelectedId(null); setFormData(initialFormData); }} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl"><Plus size={24} /></button>
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
        </div>
      </div>

      {/* Área de Conteúdo */}
      <div className={`flex-1 flex flex-col transition-all ${isNew ? 'bg-slate-900 text-white' : 'bg-gray-50'}`}>
        {isNew ? (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-12">
              <header className="border-b border-white/10 pb-8"><h2 className="text-4xl font-black uppercase italic tracking-tighter">{isEditing ? 'Editar Registro' : 'Novo Lançamento'}</h2></header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="md:col-span-2">
                  <label className="text-sm font-black uppercase text-blue-400 mb-3 block italic">Descrição do Pagamento *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-blue-500 text-white text-2xl font-bold" />
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-400 mb-3 block italic">Número da NF</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none text-white text-xl font-bold" />
                </div>
                <div>
                  <label className="text-sm font-black uppercase text-blue-400 mb-3 block italic">Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none text-white text-xl font-bold" />
                </div>
              </div>
              <div className="pt-10 flex justify-end space-x-8 items-center border-t border-white/10">
                <button onClick={() => setIsNew(false)} className="font-black uppercase text-sm text-white/40 hover:text-white">Cancelar</button>
                <button onClick={handleSave} disabled={isLoading || !formData.title} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-6 rounded-2xl font-black uppercase text-lg flex items-center shadow-2xl shadow-blue-900/40">
                  {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={24} className="mr-3" />} Finalizar
                </button>
              </div>
            </div>
          </div>
        ) : selectedRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in">
            <header className="p-12 bg-white border-b flex justify-between items-end shadow-sm">
              <div>
                <div className="flex items-center space-x-6 mb-6">
                  <span className="text-lg font-black text-gray-400 bg-gray-50 px-6 py-2 rounded-xl border">ID: {selectedRequest.id}</span>
                  <Badge status={selectedRequest.status} className="scale-125 ml-4" />
                </div>
                <h2 className="text-6xl font-black text-gray-900 uppercase italic tracking-tighter leading-none">{selectedRequest.title}</h2>
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Card Informativo 1 */}
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-500 uppercase mb-8 border-b pb-4 flex items-center italic"><Banknote size={20} className="mr-3"/> Dados Fiscais</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Número da Nota Fiscal</span>
                      <p className="text-5xl font-black text-gray-900 leading-none">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Data Limite</span><p className="text-3xl font-black text-gray-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Pedidos</span><p className="text-3xl font-black text-gray-900">{stripHtml(selectedRequest.orderNumbers) || '---'}</p></div>
                    </div>
                  </div>
                </div>

                {/* Card Informativo 2 */}
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-500 uppercase mb-8 border-b pb-4 flex items-center italic"><CreditCard size={20} className="mr-3"/> Informações de Pagamento</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Modalidade</span>
                      <p className="text-4xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod}</p>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Favorecido Principal</span>
                      <p className="text-2xl font-bold text-gray-800 break-words leading-tight uppercase">{selectedRequest.payee || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção de Anexos - Destaque */}
              <div className="bg-white p-12 rounded-[3.5rem] border-2 border-gray-100 shadow-2xl">
                <div className="flex items-center justify-between mb-10 border-b pb-6">
                  <h3 className="text-2xl font-black text-gray-900 uppercase italic flex items-center"><FileText size={28} className="mr-4 text-blue-600"/> Documentação do Processo</h3>
                  <span className="text-xs font-black text-gray-400 uppercase bg-gray-50 px-4 py-2 rounded-xl">Arquivos em Nuvem</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                   <div className="space-y-4">
                     <p className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Clique para Visualizar:</p>
                     {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                       <div className="space-y-4">
                         {selectedRequest.attachments.map(att => (
                           <div key={att.id} className="p-6 bg-gray-50 border border-gray-100 rounded-[2rem] flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group shadow-sm">
                             <div className="flex items-center space-x-6">
                               <div className="bg-blue-600 text-white p-4 rounded-2xl shadow-lg group-hover:scale-110 transition-transform"><FileText size={24} /></div>
                               <div className="flex flex-col">
                                 <span className="text-lg font-black text-gray-800 max-w-[250px] truncate leading-tight">{att.fileName}</span>
                                 <span className="text-[10px] font-black text-gray-400 uppercase">Documento Digital</span>
                               </div>
                             </div>
                             <button onClick={() => handleViewFile(att.storageUrl)} className="bg-white border-2 border-blue-600 text-blue-600 px-8 py-3 rounded-2xl font-black uppercase text-xs hover:bg-blue-600 hover:text-white transition-all shadow-md flex items-center">
                               <ExternalLink size={16} className="mr-2" /> Visualizar PDF
                             </button>
                           </div>
                         ))}
                       </div>
                     ) : (
                       <div className="p-16 border-4 border-dashed border-gray-50 rounded-[3rem] text-center text-gray-300 italic font-bold">Nenhum anexo disponível para este ID.</div>
                     )}
                   </div>
                   <div className="bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100">
                      <span className="text-xs font-black text-gray-400 uppercase block mb-4 italic">Notas e Instruções Internas</span>
                      <p className="text-2xl font-medium text-gray-600 leading-relaxed italic">"{selectedRequest.generalObservation || 'Nenhuma observação informada pelo solicitante.'}"</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
            <div className="bg-white p-16 rounded-[4rem] shadow-2xl border border-gray-50 mb-10"><Banknote size={120} className="text-blue-50" /></div>
            <h3 className="text-4xl font-black text-gray-900 uppercase italic tracking-tighter">Fluxo de Notas</h3>
            <p className="text-lg font-bold text-gray-400 uppercase tracking-widest mt-6 max-w-sm leading-relaxed">Selecione uma solicitação no menu lateral para visualizar todos os detalhes em tela cheia.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
