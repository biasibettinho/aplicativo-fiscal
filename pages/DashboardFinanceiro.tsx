
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { BRANCHES } from '../constants';
import { 
  DollarSign, Search, Banknote, FileText, ExternalLink, Paperclip, CheckCircle, MapPin, Filter, Landmark, Loader2
} from 'lucide-react';

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    const financeOnly = data.filter(r => ![RequestStatus.PENDENTE, RequestStatus.ANALISE].includes(r.status));
    setRequests(financeOnly);
  };

  useEffect(() => { loadData(); }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  useEffect(() => {
    let isMounted = true;
    const fetchAtts = async () => {
      // IMPORTANTE: Para a API REST, usamos selectedRequest.id (numérico)
      if (selectedRequest && authState.token) {
        setIsFetchingAttachments(true);
        try {
          const [main, secondary] = await Promise.all([
            sharepointService.getItemAttachments(authState.token, selectedRequest.id),
            sharepointService.getSecondaryAttachments(authState.token, selectedRequest.id)
          ]);
          if (isMounted) { setMainAttachments(main); setSecondaryAttachments(secondary); }
        } catch (e) { console.error(e); } finally { if (isMounted) setIsFetchingAttachments(false); }
      } else { setMainAttachments([]); setSecondaryAttachments([]); }
    };
    fetchAtts();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toString().includes(searchTerm) || r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      return matchesSearch && matchesBranch;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, branchFilter]);

  const handleFaturar = async () => {
    if (!selectedRequest || !authState.token) return;
    await requestService.changeStatus(selectedRequest.graphId, RequestStatus.FATURADO, authState.token, 'Pagamento liquidado e faturado.');
    loadData(); setSelectedId(null);
  };

  const handleViewFile = (url: string) => { if (url) window.open(url, '_blank'); };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between">
        <div className="flex flex-wrap items-center gap-6">
          <Filter size={18} className="text-indigo-600" />
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Filial</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-44 bg-white">
              <option value="">Todas as Filiais</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="ID ou Nota..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredRequests.map(r => (
              <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-indigo-50 border-r-4 border-indigo-500' : ''}`}>
                <div className="flex justify-between items-start mb-2"><span className="text-[10px] font-mono font-bold text-gray-400">#{r.id}</span><Badge status={r.status === RequestStatus.APROVADO ? RequestStatus.PENDENTE : r.status} request={r} currentUser={authState.user} /></div>
                <h4 className="font-bold text-gray-900 text-sm truncate">{r.title}</h4>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-2 block">{new Date(r.paymentDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {selectedRequest ? (
            <>
              <div className="p-8 border-b flex justify-between items-center bg-indigo-50/10">
                <div className="flex items-center space-x-6">
                  <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl flex-shrink-0"><Banknote size={32} /></div>
                  <div><h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic leading-none">{selectedRequest.title}</h2><p className="text-sm font-bold text-indigo-600 uppercase mt-2">ID: #{selectedRequest.id}</p></div>
                </div>
                <div className="flex space-x-3">
                  <button onClick={handleFaturar} className="px-10 py-3.5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all text-xs uppercase tracking-widest shadow-2xl flex items-center"><CheckCircle size={20} className="mr-2" /> Concluir Pagamento</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                <div className="grid grid-cols-2 gap-10">
                  <div className="bg-gray-50 p-10 rounded-[3rem] border border-gray-100 shadow-sm">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-8 italic border-b pb-4"><Landmark size={18} className="inline mr-2"/> Dados Bancários</h3>
                    <div className="space-y-6">
                      <div><span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-2">Favorecido</span><p className="text-2xl font-black text-gray-900">{selectedRequest.payee || '---'}</p></div>
                      <div><span className="text-[11px] font-black text-gray-400 uppercase tracking-widest block mb-1">Método</span><p className="text-xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod || '---'}</p></div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-4 mb-6 italic"><Paperclip size={18} className="mr-2" /> Anexos {isFetchingAttachments && <Loader2 size={16} className="ml-3 animate-spin text-indigo-600" />}</h4>
                    <div className="space-y-4">
                      {[...mainAttachments, ...secondaryAttachments].map(att => (
                        <div key={att.id} className="p-5 bg-white border border-gray-200 rounded-3xl flex items-center shadow-md group transition-all hover:border-indigo-400">
                          <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors mr-6"><FileText size={24}/></div>
                          <div className="flex-1 truncate text-sm font-black text-gray-700">{att.fileName}</div>
                          <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 flex items-center bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-colors"><ExternalLink size={14} className="mr-2" /> Ver</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><DollarSign size={100} className="opacity-10 mb-6" /><p className="font-black text-xl uppercase italic tracking-widest text-gray-400">Gestão de Liquidação</p></div>}
        </div>
      </div>
    </div>
  );
};

export default DashboardFinanceiro;
