import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  Search, CheckCircle, XCircle, FileSearch, FileText, ExternalLink, Paperclip, MapPin, Loader2, Filter, Calendar, X, AlertTriangle, MessageSquare, Edit3, Banknote, Smartphone, Info
} from 'lucide-react';

const DashboardFiscal: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isReworking, setIsReworking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
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

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const data = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [authState.user, authState.token]);

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
    const branches = requests
      .map(r => r.branch)
      .filter(branch => branch && branch.trim() !== '');
    return Array.from(new Set(branches)).sort();
  }, [requests]);

  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FISCAL_ADMIN || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.APROVADO : RequestStatus.ANALISE;
      const comment = isMaster ? 'Aprovação Final realizada pelo Fiscal Master.' : 'Conferência inicial realizada pelo Fiscal Comum. Aguardando Master.';
      
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        approverObservation: comment,
        errorObservation: ''
      });
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), {
        ATUALIZACAO: targetStatus,
        OBSERVACAO: comment,
        MSG_OBSERVACAO: comment,
        usuario_logado: authState.user.name
      });
      await loadData(); 
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar aprovação.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.ERRO_FISCAL : RequestStatus.ANALISE;
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        errorObservation: rejectReason,
        approverObservation: rejectComment 
      });
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), {
        ATUALIZACAO: targetStatus,
        OBSERVACAO: `Reprovado Fiscal: ${rejectReason}`,
        MSG_OBSERVACAO: rejectComment,
        usuario_logado: authState.user.name
      });
      await loadData();
      setIsRejectModalOpen(false);
      setRejectComment('');
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar reprovação.");
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
      const matchesStatus = statusFilter === '' || r.status === statusFilter;
      let matchesDate = true;
      if (dateFilter) {
        matchesDate = new Date(r.createdAt).toISOString().split('T')[0] === dateFilter;
      }
      return matchesSearch && matchesBranch && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, dateFilter, branchFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <span className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Carregando solicitações...</span>
      </div>
    );
  }

  const isFinalized = selectedRequest && [RequestStatus.APROVADO, RequestStatus.ERRO_FISCAL, RequestStatus.FATURADO].includes(selectedRequest.status);

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-6">
        <div className="relative w-64 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar ID ou NF..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><Calendar size={10} className="mr-1"/> Data Criação</label>
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none" />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><MapPin size={10} className="mr-1"/> Filial</label>
            <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none min-w-[140px]">
              <option value="">Todas as Filiais</option>
              {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><Filter size={10} className="mr-1"/> Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none min-w-[140px]">
              <option value="">Todos</option>
              <option value={RequestStatus.APROVADO}>Aprovado</option>
              <option value={RequestStatus.ERRO_FISCAL}>Erro - Fiscal</option>
              <option value={RequestStatus.ANALISE}>Em Análise</option>
              <option value={RequestStatus.PENDENTE}>Pendente</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Listagem Lateral */}
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solicitações ({filteredRequests.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {filteredRequests.map(r => (
              <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-blue-50 border-l-8 border-blue-600 shadow-inner' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-gray-400">#{r.id}</span>
                  <Badge status={r.status} className="scale-90 origin-right" />
                </div>
                <p className="font-black text-gray-900 text-sm uppercase truncate leading-tight">{r.title}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[9px] text-blue-500 font-bold italic uppercase tracking-widest">{r.branch}</span>
                  <span className="text-[9px] text-gray-400 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex justify-between items-center bg-gray-50/20">
                <div className="max-w-[60%]">
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge status={selectedRequest.status} />
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">{isMaster ? 'Modo Master' : 'Modo Analista'}</span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate">{selectedRequest.title}</h2>
                  <div className="mt-2 flex space-x-4">
                    <p className="text-sm font-black text-blue-600 uppercase italic">NF: <span className="text-slate-900">{stripHtml(selectedRequest.invoiceNumber) || '---'}</span></p>
                    <p className="text-sm font-black text-blue-600 uppercase italic">Pedido: <span className="text-slate-900">{selectedRequest.orderNumbers || '---'}</span></p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  {isFinalized && !isReworking ? (
                    <button onClick={() => setIsReworking(true)} className="px-6 py-3.5 bg-amber-100 text-amber-700 font-black text-[10px] uppercase rounded-2xl flex items-center shadow-sm hover:bg-amber-200 transition-all">
                      <Edit3 size={18} className="mr-2" /> Editar Ações
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setIsRejectModalOpen(true)} disabled={isProcessingAction} className="px-6 py-3.5 text-red-600 font-black text-[10px] uppercase border-2 border-red-100 rounded-2xl hover:bg-red-50 flex items-center shadow-sm disabled:opacity-50">
                        <XCircle size={18} className="mr-2" /> Reprovar
                      </button>
                      <button onClick={handleApprove} disabled={isProcessingAction} className="px-10 py-3.5 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-green-700 flex items-center disabled:opacity-50">
                        {isProcessingAction ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle size={18} className="mr-2" />}
                        {isMaster ? 'Aprovar Lançamento' : 'Validar e Encaminhar'}
                      </button>
                      {isReworking && <button onClick={() => setIsReworking(false)} className="p-3.5 text-gray-400 hover:text-gray-600"><X size={20}/></button>}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <section className="bg-blue-50/30 p-10 rounded-[3rem] border border-blue-50 shadow-inner">
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-8 border-b border-blue-100 pb-3 italic flex items-center"><FileSearch size={14} className="mr-2"/> Conferência</h3>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2"><span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Favorecido / Beneficiário</span><p className="text-xl font-bold text-slate-700 uppercase">{selectedRequest.payee || '---'}</p></div>
                        <div><span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Vencimento</span><p className="text-sm font-bold text-slate-800">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                        <div><span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Método</span><p className="text-sm font-bold text-slate-800">{selectedRequest.paymentMethod}</p></div>
                        
                        {selectedRequest.paymentMethod === 'PIX' && (
                          <div className="col-span-2 pt-2 flex items-center text-blue-600"><Smartphone size={14} className="mr-2"/><p className="text-[10px] font-black uppercase tracking-tight">PIX: {selectedRequest.pixKey}</p></div>
                        )}
                        
                        {selectedRequest.paymentMethod === 'TED/DEPOSITO' && (
                          <div className="col-span-2 pt-2 text-[10px] font-bold text-slate-600 bg-white/50 p-3 rounded-xl border border-blue-100/50">
                            <p>BANCO: {selectedRequest.bank}</p>
                            <p>AGÊNCIA/CONTA: {selectedRequest.agency} / {selectedRequest.account} ({selectedRequest.accountType})</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                  
                  <section className="space-y-6">
                    <div className="bg-white p-8 rounded-[2rem] border-2 border-blue-50 shadow-sm relative">
                      <h3 className="text-xs font-black text-blue-600 uppercase italic mb-4 flex items-center border-b pb-2"><FileText size={16} className="mr-2"/> Anexos</h3>
                      <div className="space-y-3 max-h-[150px] overflow-y-auto custom-scrollbar">
                         {mainAttachments.map(att => (
                           <div key={att.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                             <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{att.fileName}</span>
                             <button onClick={() => window.open(att.storageUrl, '_blank')} className="text-blue-600"><ExternalLink size={14}/></button>
                           </div>
                         ))}
                         {secondaryAttachments.map(att => (
                           <div key={att.id} className="flex justify-between items-center p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                             <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{att.fileName}</span>
                             <button onClick={() => window.open(att.storageUrl, '_blank')} className="text-indigo-600"><ExternalLink size={14}/></button>
                           </div>
                         ))}
                         {mainAttachments.length === 0 && secondaryAttachments.length === 0 && <p className="text-center text-[10px] font-black text-gray-300 uppercase">Sem anexos</p>}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                      <span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação do Solicitante</span>
                      <p className="text-sm font-medium text-slate-600 italic leading-relaxed">"{selectedRequest.generalObservation || 'Sem observações.'}"</p>
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 opacity-20"><FileSearch size={100} /></div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative border border-gray-100 animate-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white flex justify-between items-center"><h3 className="text-lg font-black uppercase italic">Reprovar Solicitação</h3><button onClick={() => setIsRejectModalOpen(false)}><X size={20}/></button></div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Motivo Principal</label>
                <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none">
                  <option value="Erro no pedido">Erro no pedido</option>
                  <option value="Erro no anexo">Erro no anexo</option>
                  <option value="Nota fiscal não localizada">Nota fiscal não localizada</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase mb-2 block tracking-widest">Comentários (OBSERVACAO_APROVADORES)</label>
                <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400">Voltar</button>
                <button onClick={handleConfirmReject} disabled={isProcessingAction} className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-red-700 flex items-center justify-center disabled:opacity-50">
                  {isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <XCircle size={16} className="mr-2" />} Confirmar Reprovação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFiscal;