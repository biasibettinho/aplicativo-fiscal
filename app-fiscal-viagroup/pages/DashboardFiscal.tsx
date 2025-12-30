
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import Badge from '../components/Badge';
import { 
  Search, CheckCircle, XCircle, FileSearch, FileText, ExternalLink, Info, Paperclip, MapPin, Filter, Banknote
} from 'lucide-react';

const DashboardFiscal: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    setRequests(data);
  };

  useEffect(() => { loadData(); const t = setInterval(loadData, 20000); return () => clearInterval(t); }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  const handleApprove = async () => {
    if (!selectedId || !authState.token) return;
    await requestService.changeStatus(selectedId, RequestStatus.APROVADO, authState.token, 'Aprovado pelo Fiscal.');
    loadData(); setSelectedId(null);
  };

  const handleViewFile = (storageUrl: string) => {
    if (!storageUrl) return;
    try {
      const blob = new Blob([new Uint8Array(atob(storageUrl).split("").map(c => c.charCodeAt(0)))], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch { window.open(storageUrl, '_blank'); }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => 
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm]);

  return (
    <div className="flex h-full gap-8 overflow-hidden">
      <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
        <div className="p-6 border-b bg-gray-50/50">
          <div className="relative">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar ID ou NF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 border-0 rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filteredRequests.map(r => (
            <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-6 cursor-pointer transition-all ${selectedId === r.id ? 'bg-blue-50 border-l-8 border-blue-600' : 'hover:bg-gray-50'}`}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-black text-gray-400">#{r.id}</span>
                <Badge status={r.status} />
              </div>
              <p className="font-black text-gray-900 text-lg uppercase truncate leading-tight">{r.title}</p>
              <p className="text-[10px] text-blue-500 font-bold mt-2 italic uppercase tracking-widest">{r.branch}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl">
        {selectedRequest ? (
          <>
            <div className="p-12 border-b flex justify-between items-center bg-gray-50/20">
              <div>
                <h2 className="text-5xl font-black text-gray-900 italic uppercase leading-none">{selectedRequest.title}</h2>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-4 flex items-center"><MapPin size={16} className="mr-2"/> FILIAL: {selectedRequest.branch} • ID: {selectedRequest.id}</p>
              </div>
              <div className="flex space-x-4">
                <button onClick={() => setIsRejectModalOpen(true)} className="px-8 py-4 text-red-600 font-black text-xs uppercase border-2 border-red-100 rounded-2xl hover:bg-red-50 transition-all"><XCircle size={20} className="inline mr-2" /> Reprovar</button>
                <button onClick={handleApprove} className="px-12 py-4 bg-green-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-green-700 transition-all"><CheckCircle size={20} className="inline mr-2" /> Aprovar Lançamento</button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <section className="bg-blue-50/30 p-12 rounded-[3.5rem] border border-blue-50 shadow-inner">
                  <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-10 border-b border-blue-100 pb-4 italic">Conferência de Dados</h3>
                  <div className="space-y-10">
                    <div><span className="text-xs font-black text-blue-300 uppercase block mb-2">Número da Nota</span><p className="text-5xl font-black text-slate-900 leading-none">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p></div>
                    <div className="grid grid-cols-2 gap-8">
                       <div><span className="text-xs font-black text-blue-300 uppercase block mb-2">Data Vencimento</span><p className="text-3xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                       <div><span className="text-xs font-black text-blue-300 uppercase block mb-2">Ordens de Compra</span><p className="text-3xl font-black text-slate-900">{stripHtml(selectedRequest.orderNumbers) || '---'}</p></div>
                    </div>
                  </div>
                </section>
                <section className="space-y-6">
                  <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-4 mb-6 italic"><Paperclip size={20} className="mr-3" /> Documentos Anexados</h3>
                  <div className="space-y-4">
                    {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? selectedRequest.attachments.map(att => (
                      <div key={att.id} className="p-6 bg-white border-2 border-gray-100 rounded-[2.5rem] flex items-center shadow-lg group hover:border-blue-600 transition-all">
                        <div className="bg-blue-600 text-white p-5 rounded-3xl mr-6 group-hover:scale-110 transition-transform shadow-lg"><FileText size={28}/></div>
                        <div className="flex-1 truncate"><span className="text-gray-900 font-black text-lg block truncate">{att.fileName}</span></div>
                        <button onClick={() => handleViewFile(att.storageUrl)} className="ml-6 px-10 py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center"><ExternalLink size={18} className="mr-2" /> Abrir PDF</button>
                      </div>
                    )) : <div className="p-16 border-4 border-dashed border-gray-100 rounded-[3rem] text-center text-gray-300 font-bold italic">Sem anexos para conferir.</div>}
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center p-20"><FileSearch size={150} className="opacity-10 mb-8" /><h3 className="text-3xl font-black text-gray-900 uppercase italic">Análise Fiscal</h3><p className="text-lg font-bold text-gray-400 mt-4 max-w-xs">Selecione uma solicitação para validar as informações fiscais e anexos.</p></div>}
      </div>
    </div>
  );
};

export default DashboardFiscal;
