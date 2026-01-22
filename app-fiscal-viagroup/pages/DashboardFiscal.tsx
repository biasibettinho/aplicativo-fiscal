import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  Search, CheckCircle, XCircle, FileSearch, FileText, ExternalLink, Paperclip, MapPin, Loader2, Filter, Calendar, X, AlertTriangle, MessageSquare, Edit3, Banknote, Smartphone, Info, Copy
} from 'lucide-react';

const CopyButton = ({ text }: { text: string }) => (
  <button 
    onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
    }}
    className="ml-1.5 p-1 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded transition-all"
    title="Copiar"
  >
    <Copy size={12} />
  </button>
);

const DashboardFiscal: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isReworking, setIsReworking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // ESTADO PARA DELTA POLLING
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal de Reprovação
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Erro no pedido');
  const [rejectComment, setRejectComment] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  // Função de carga com suporte a busca Delta (Incremental)
  const loadData = async (silent = false) => {
    if (!authState.user || !authState.token) return;

    if (!silent || requests.length === 0) {
        if (!silent) setIsLoading(true);
        try {
          const data = await requestService.getRequestsFiltered(authState.user, authState.token);
          setRequests(data);
          setLastUpdate(new Date());
        } catch (e) {
          console.error(e);
        } finally {
          if (!silent) setIsLoading(false);
        }
    } else {
        // POLLING INCREMENTAL (DELTA)
        try {
            const updatedItems = await sharepointService.getRequestsDelta(authState.token, lastUpdate);
            if (updatedItems.length > 0) {
                setRequests(prev => {
                    const map = new Map(prev.map(r => [r.id, r]));
                    updatedItems.forEach(item => {
                        // Fiscal vê quase tudo na fila ativa, mergimos diretamente
                        map.set(item.id, item);
                    });
                    return Array.from(map.values());
                });
                setLastUpdate(new Date());
            }
        } catch (e) {
            console.warn("Delta polling falhou no Fiscal", e);
        }
    }
  };

  useEffect(() => { loadData(false); }, [authState.user, authState.token]);

  useEffect(() => {
    const interval = setInterval(() => { loadData(true); }, 15000); // 15s operacional
    return () => clearInterval(interval);
  }, [authState.user, authState.token, lastUpdate, requests.length]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  useEffect(() => {
    setIsReworking(false);
    let isMounted = true;
    const fetchAtts = async () => {
      if (selectedRequest && authState.token) {
        setIsFetchingAttachments(true);
        try {
          const [main, secondary] = await Promise.all([
            sharepointService.getItemAttachments(authState.token, selectedRequest.id),
            sharepointService.getSecondaryAttachments(authState.token, selectedRequest.id)
          ]);
          if (isMounted) {
            setMainAttachments(main || []);
            setSecondaryAttachments(secondary || []);
          }
        } catch (e) { 
          console.error(e);
        } finally { 
          if (isMounted) setIsFetchingAttachments(false); 
        }
      } else {
        setMainAttachments([]); 
        setSecondaryAttachments([]);
      }
    };
    fetchAtts();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const availableBranches = useMemo(() => {
    const branches = requests.map(r => r.branch).filter(branch => branch && branch.trim() !== '');
    return Array.from(new Set(branches)).sort();
  }, [requests]);

  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FISCAL_ADMIN || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    const targetStatus = isMaster ? RequestStatus.APROVADO : RequestStatus.ANALISE;
    const comment = isMaster ? 'Aprovação Final realizada pelo Fiscal Master.' : 'Conferência inicial realizada pelo Fiscal Comum. Aguardando Master.';
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: targetStatus, approverObservation: comment } : r));
    setSelectedId(null);
    setIsProcessingAction(true);
    try {
      const payload: any = { status: targetStatus, approverObservation: comment, errorObservation: '', Dataenvio_fiscal: new Date().toISOString(), Dataenvio_financeiro: new Date().toISOString() };
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, payload);
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), { ATUALIZACAO: targetStatus, OBSERVACAO: comment, MSG_OBSERVACAO: comment, usuario_logado: authState.user.name });
    } catch (e) {
      loadData(true);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    const targetStatus = isMaster ? RequestStatus.ERRO_FISCAL : RequestStatus.ANALISE;
    const obs = `Reprovado Fiscal: ${rejectReason}`;
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: targetStatus, errorObservation: rejectReason, approverObservation: rejectComment } : r));
    setIsRejectModalOpen(false);
    setSelectedId(null);
    setIsProcessingAction(true);
    try {
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, { status: targetStatus, errorObservation: rejectReason, approverObservation: rejectComment });
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), { ATUALIZACAO: targetStatus, OBSERVACAO: obs, MSG_OBSERVACAO: rejectComment, usuario_logado: authState.user.name });
    } catch (e) {
      loadData(true);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.id.toString().includes(searchTerm);
      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      let matchesStatus = true;
      if (statusFilter === 'Pendente') { matchesStatus = r.status === RequestStatus.PENDENTE; } 
      else if (statusFilter === 'Em Análise') { matchesStatus = r.status === RequestStatus.ANALISE; } 
      else if (statusFilter === 'Erro - Fiscal') { matchesStatus = r.status === RequestStatus.ERRO_FISCAL; } 
      else if (statusFilter === 'Aprovado') { matchesStatus = r.status === RequestStatus.APROVADO; } 
      else if (statusFilter !== '') { matchesStatus = r.status === statusFilter; }
      let matchesDate = true;
      if (dateFilter) { matchesDate = new Date(r.createdAt).toISOString().split('T')[0] === dateFilter; }
      return matchesSearch && matchesBranch && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, dateFilter, branchFilter, statusFilter]);

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative w-64 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar ID ou NF..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><Calendar size={10} className="mr-1"/> Criação</label>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none" />
            </div>
            <div className="flex flex-col">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><Filter size={10} className="mr-1"/> Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none min-w-[140px]">
                <option value="">Todas</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Análise">Em Análise</option>
                <option value="Erro - Fiscal">Erro - Fiscal</option>
                <option value="Aprovado">Aprovado</option>
              </select>
            </div>
          </div>
        </div>
        {selectedRequest && (
          <div className="flex items-center space-x-2 animate-in slide-in-from-right duration-300">
            <button onClick={() => setIsRejectModalOpen(true)} className="px-4 py-2 text-red-600 font-black text-[10px] uppercase border border-red-100 rounded-xl hover:bg-red-50 flex items-center"><XCircle size={16} className="mr-2" /> Reprovar</button>
            <button onClick={handleApprove} className="px-6 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-green-700 flex items-center transition-all active:scale-95">{isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />} {isMaster ? 'Aprovar Lançamento' : 'Validar e Encaminhar'}</button>
          </div>
        )}
      </div>
      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {isLoading ? ( <div className="flex flex-col items-center justify-center h-40"><Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" /></div> ) : (
                filteredRequests.slice(0, 100).map(r => (
                  <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-blue-50 border-l-8 border-blue-600 shadow-inner' : 'hover:bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-gray-400">#{r.id}</span><Badge status={r.status} className="scale-90 origin-right" /></div>
                    <p className="font-black text-gray-900 text-sm uppercase truncate leading-tight">{r.title}</p>
                  </div>
                ))
            )}
          </div>
        </div>
        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex flex-col bg-gray-50/20">
                <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate mb-4">{selectedRequest.title}</h2>
                <div className="flex space-x-6">
                  <div className="flex items-center"><p className="text-sm font-black text-blue-600 uppercase italic">NF: <span className="text-slate-900">{stripHtml(selectedRequest.invoiceNumber) || '---'}</span></p><CopyButton text={stripHtml(selectedRequest.invoiceNumber)} /></div>
                  <div className="flex items-center"><p className="text-sm font-black text-blue-600 uppercase italic">Pedido: <span className="text-slate-900">{selectedRequest.orderNumber || '---'}</span></p><CopyButton text={selectedRequest.orderNumber} /></div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 <section className="bg-blue-50/30 p-10 rounded-[3rem] border border-blue-50 shadow-inner">
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-8 italic flex items-center"><FileSearch size={14} className="mr-2"/> Conferência de Dados</h3>
                    <div className="space-y-6"><div className="grid grid-cols-2 gap-4">
                       <div><span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Vencimento</span><p className="text-sm font-bold text-slate-800">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                       <div><span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Método</span><p className="text-sm font-bold text-slate-800">{selectedRequest.paymentMethod}</p></div>
                    </div></div>
                 </section>
              </div>
            </>
          ) : ( <div className="flex-1 flex flex-col items-center justify-center text-gray-300 opacity-20"><FileSearch size={100} /></div> )}
        </div>
      </div>
    </div>
  );
};

export default DashboardFiscal;