
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  DollarSign, Search, CheckCircle, MapPin, Filter, Landmark, Loader2, Calendar, XCircle, AlertTriangle, MessageSquare, Share2, X, Edit3, Globe, FileText, ExternalLink, Paperclip, Smartphone, Info, Eye, Clock, History, Copy,
  FileSearch, PlayCircle, ArrowDown, Save, Trash2 as TrashIcon
} from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';

// Mapeamento de Status para Ícones e Cores
const STATUS_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  'Criado': { icon: PlayCircle, color: 'text-gray-600', bgColor: 'bg-gray-100' },
  'Análise': { icon: FileSearch, color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  'Análise - Fiscal': { icon: FileSearch, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  'Aprovado': { icon: CheckCircle, color: 'text-green-600', bgColor: 'bg-green-100' },
  'Aprovado - Fiscal': { icon: CheckCircle, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  'Aprovado - Financeiro': { icon: CheckCircle, color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  'Compartilhado': { icon: Share2, color: 'text-purple-600', bgColor: 'bg-purple-100' },
  'Faturado': { icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  'Erro - Fiscal': { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
  'Erro - Financeiro': { icon: AlertTriangle, color: 'text-orange-600', bgColor: 'bg-orange-100' },
  'Rejeitado - Fiscal': { icon: XCircle, color: 'text-red-700', bgColor: 'bg-red-200' },
};

const getStatusConfig = (status: string) => {
  return STATUS_CONFIG[status] || { icon: Clock, color: 'text-gray-500', bgColor: 'bg-gray-50' };
};

const CopyButton = ({ text }: { text: string }) => (
  <button 
    onClick={(e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(text);
    }}
    className="ml-1.5 p-1 text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 rounded transition-all"
    title="Copiar"
  >
    <Copy size={12} />
  </button>
);

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isReworking, setIsReworking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewingCommentData, setViewingCommentData] = useState<{ id: string, graphId: string, comment: string } | null>(null);
  const [editedComment, setEditedComment] = useState('');
  const [isSavingComment, setIsSavingComment] = useState(false);

  // TAREFA 1: Sistema de Toast
  const [toast, setToast] = useState<{ msg: string, type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'info' | 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modais
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Sem método de pagamento');
  const [rejectComment, setRejectComment] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('financeiro.norte@viagroup.com.br');
  const [shareCommentText, setShareCommentText] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [sharedStatusFilter, setSharedStatusFilter] = useState('PENDENTE');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FINANCEIRO_MASTER || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  const isUrgent = (req: PaymentRequest) => {
    if (req.status === RequestStatus.FATURADO || req.statusFinal === 'Faturado') return false;
    if (!req.paymentDate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const deadline = new Date(today);
    deadline.setDate(today.getDate() + 3);
    const paymentDate = new Date(req.paymentDate);
    return paymentDate <= deadline;
  };

  const resolveDisplayStatus = (r: PaymentRequest): string => {
    if (r.status === RequestStatus.ERRO_FINANCEIRO) return RequestStatus.ERRO_FINANCEIRO;
    if (r.status === RequestStatus.FATURADO) return RequestStatus.FATURADO;
    if (!isMaster && r.status === RequestStatus.APROVADO) return RequestStatus.PENDENTE;
    if (r.statusFinal && r.statusFinal.trim() !== "") return r.statusFinal;
    if (r.statusManual && r.statusManual.trim() !== "" && ![RequestStatus.FATURADO, RequestStatus.ERRO_FINANCEIRO].includes(r.status as RequestStatus)) return r.statusManual;
    let fallback = r.statusEspelho && r.statusEspelho.trim() !== "" ? r.statusEspelho : r.status;
    if (fallback === RequestStatus.APROVADO) return RequestStatus.PENDENTE;
    return fallback;
  };

  const loadData = async (silent = false) => {
    if (!authState.user || !authState.token) return;
    if (!silent) setIsLoading(true);
    try {
      const data = await requestService.getRequestsFiltered(authState.user, authState.token);
      let filtered = data.filter(r => [
        RequestStatus.APROVADO, 
        RequestStatus.ANALISE, 
        RequestStatus.FATURADO, 
        RequestStatus.ERRO_FINANCEIRO, 
        RequestStatus.COMPARTILHADO
      ].includes(r.status) || (r.sharedWithEmail && stripHtml(r.sharedWithEmail).trim() !== ''));

      if (authState.user.role === UserRole.FINANCEIRO) {
        filtered = filtered.filter(r => stripHtml(r.sharedWithEmail || '').toLowerCase() === authState.user?.email.toLowerCase());
      }
      setRequests(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => { loadData(false); }, [authState.user, authState.token]);

  useEffect(() => {
    const interval = setInterval(() => { loadData(true); }, 30000);
    return () => clearInterval(interval);
  }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  useEffect(() => {
    setIsReworking(false);
    let isMounted = true;
    const fetchDetails = async () => {
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
        } catch (e) { console.error(e); } finally { if (isMounted) setIsFetchingAttachments(false); }
      } else { setMainAttachments([]); setSecondaryAttachments([]); }
    };
    fetchDetails();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const handleOpenHistory = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsHistoryModalOpen(true);
    setIsFetchingHistory(true);
    try {
      const logs = await sharepointService.getHistoryLogs(authState.token, selectedRequest.id);
      setHistoryLogs(logs);
    } catch (e) { console.error(e); } finally { setIsFetchingHistory(false); }
  };

  const availableBranches = useMemo(() => {
    const branches = requests.map(r => r.branch).filter(b => b && b.trim() !== '');
    return Array.from(new Set(branches)).sort();
  }, [requests]);

  const applySharedFilter = (reqs: PaymentRequest[]) => {
    if (sharedStatusFilter === 'TODOS') return reqs;
    return reqs.filter(r => [RequestStatus.APROVADO, RequestStatus.ANALISE, RequestStatus.PENDENTE].includes(r.status as RequestStatus) || resolveDisplayStatus(r) === 'Pendente');
  };

  const northShared = useMemo(() => 
    applySharedFilter(requests.filter(r => stripHtml(r.sharedWithEmail || '').toLowerCase() === 'financeiro.norte@viagroup.com.br')), 
  [requests, sharedStatusFilter]);
  
  const southShared = useMemo(() => 
    applySharedFilter(requests.filter(r => stripHtml(r.sharedWithEmail || '').toLowerCase() === 'financeiro.sul@viagroup.com.br')), 
  [requests, sharedStatusFilter]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    let targetStatus = isMaster ? RequestStatus.FATURADO : RequestStatus.ANALISE;
    let comment = isMaster ? 'Faturamento concluído pelo Master.' : 'Validado pelo financeiro regional. Aguardando conferência Master.';
    
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: targetStatus, approverObservation: comment } : r));
    setSelectedId(null);
    setIsProcessingAction(true);
    try {
      const payload: any = { status: targetStatus, approverObservation: comment, errorObservation: '' };
      if (isMaster) payload.sentToFinanceAt = new Date().toISOString();
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, payload);
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), { ATUALIZACAO: targetStatus, OBSERVACAO: comment, MSG_OBSERVACAO: comment, usuario_logado: authState.user.name });
      loadData(true);
    } catch (e) { alert("Erro ao aprovar no servidor. Recarregando..."); loadData(true); } finally { setIsProcessingAction(false); }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    const targetStatus = isMaster ? RequestStatus.ERRO_FINANCEIRO : RequestStatus.ANALISE;
    const logObs = `Reprovado: ${rejectReason}`;
    
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: targetStatus, errorObservation: rejectReason, approverObservation: rejectComment } : r));
    setIsRejectModalOpen(false);
    setSelectedId(null);
    setIsProcessingAction(true);
    try {
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, { status: targetStatus, errorObservation: rejectReason, approverObservation: rejectComment });
      await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), { ATUALIZACAO: targetStatus, OBSERVACAO: logObs, MSG_OBSERVACAO: rejectComment, usuario_logado: authState.user.name });
      loadData(true);
    } catch (e) { alert("Erro ao reprovar no servidor. Recarregando..."); loadData(true); } finally { setIsProcessingAction(false); }
  };

  const handleShare = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    if (!shareEmail) { showToast("Por favor, selecione uma regional de destino.", "error"); return; }
    const comment = shareCommentText.trim();
    
    // Feedback Visual Inicial
    showToast("Enviando compartilhamento...", "info");
    
    console.log("[DEBUG UI] Click Compartilhar. ID:", selectedRequest.id, "Divisão:", shareEmail, "Comentário:", comment);
    console.log("[DEBUG SHARE FLOW] Iniciando. ID:", selectedRequest.id, "Divisão Alvo:", shareEmail, "Texto Comentário:", comment);

    // TAREFA: Diagnóstico Prioritário (Executar Antes da Falha)
    if (authState.token && selectedRequest.graphId) {
      console.warn("🔎 Iniciando diagnóstico pré-update para compartilhamento...");
      await sharepointService.debugGetItemFields(authState.token, selectedRequest.graphId);
    }

    // CORREÇÃO DO PAYLOAD (O Bug): Garantindo nomes internos corretos
    const sharePayload = {
      Status: selectedRequest.status, // Mantendo status principal 'Aprovado' para visibilidade
      STATUS_ESPELHO_MANUAL: 'Compartilhado',
      PESSOA_COMPARTILHADA: shareEmail,
      COMENTARIO_COMPARTILHAMENTO: comment,
      PESSOA_COMPARTILHOU: authState.user?.email || authState.user?.name || ''
    };

    console.log("[DEBUG SHARE] Enviando Payload:", sharePayload);

    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, sharedWithEmail: shareEmail, sharedByName: authState.user?.name, statusManual: 'Compartilhado', shareComment: comment } : r));
    setIsShareModalOpen(false);
    setIsProcessingAction(true);
    try {
      // Uso de updateRequestFields para garantir o envio direto das chaves SharePoint
      const success = await sharepointService.updateRequestFields(authState.token, selectedRequest.graphId, sharePayload);

      if (success) {
        console.log("[DEBUG UI] Retorno do Service handleShare (Sucesso)");
        showToast("Compartilhado com sucesso!", "success");

        await sharepointService.addHistoryLog(authState.token, parseInt(selectedRequest.id), { 
          ATUALIZACAO: 'Compartilhado', 
          OBSERVACAO: `Compartilhado com ${shareEmail}`, 
          MSG_OBSERVACAO: comment, 
          usuario_logado: authState.user.name 
        });
        setShareCommentText('');
        loadData(true);
      } else {
        showToast("Erro ao processar no servidor.", "error");
        loadData(true);
      }
    } catch (e: any) { 
        console.error("[DEBUG UI] Erro no compartilhamento:", e);
        showToast("Erro ao compartilhar.", "error");
        loadData(true); 
    } finally { setIsProcessingAction(false); }
  };

  const handleSaveComment = async () => {
    if (!viewingCommentData || !authState.token || !authState.user) return;
    
    // TAREFA: Diagnóstico Prioritário (Executar Antes da Falha)
    if (authState.token && viewingCommentData.graphId) {
      console.warn("🔎 Iniciando diagnóstico pré-update para salvamento de comentário...");
      await sharepointService.debugGetItemFields(authState.token, viewingCommentData.graphId);
    }

    setIsSavingComment(true);
    const newComment = editedComment.trim();
    
    // Feedback Visual Inicial
    showToast("Salvando comentário...", "info");
    console.log("[DEBUG UI] Click Salvar Comentário. ID:", viewingCommentData.id, "Texto:", newComment);

    try {
      const success = await sharepointService.updateRequestFields(authState.token, viewingCommentData.graphId, {
        COMENTARIO_COMPARTILHAMENTO: newComment
      });
      if (success) {
        console.log("[DEBUG UI] Retorno do Service handleSaveComment (Sucesso)");
        showToast("Comentário salvo!", "success");
        setRequests(prev => prev.map(r => r.id === viewingCommentData.id ? { ...r, shareComment: newComment } : r));
        setViewingCommentData(null);
      } else { 
        console.error("[DEBUG UI] O serviço retornou falha no salvamento.");
        showToast("Erro ao salvar comentário.", "error");
      }
    } catch (e) { 
      console.error("[DEBUG UI] Erro crítico no handleSaveComment:", e);
      showToast("Erro crítico ao salvar.", "error");
    } finally { setIsSavingComment(false); }
  };

  const handleClearComment = async () => {
    if (!viewingCommentData || !authState.token) return;
    if (!window.confirm("Deseja realmente apagar esta observação?")) return;
    setIsSavingComment(true);
    
    showToast("Limpando observação...", "info");
    console.log("[DEBUG UI] Iniciando limpeza de comentário para ID:", viewingCommentData.id);

    try {
      const success = await sharepointService.updateRequestFields(authState.token, viewingCommentData.graphId, {
        COMENTARIO_COMPARTILHAMENTO: ''
      });
      if (success) {
        showToast("Observação removida!", "success");
        setRequests(prev => prev.map(r => r.id === viewingCommentData.id ? { ...r, shareComment: '' } : r));
        setViewingCommentData(null);
      } else {
        showToast("Erro ao limpar no servidor.", "error");
      }
    } catch (e) { 
        console.error("[DEBUG UI] Erro crítico no handleClearComment:", e);
        showToast("Erro crítico ao limpar.", "error");
    } finally { setIsSavingComment(false); }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toString().includes(searchTerm);
      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      let matchesStatus = true;
      if (statusFilter !== '') {
        const currentDisplay = resolveDisplayStatus(r);
        matchesStatus = statusFilter === 'Pendente' ? (r.status === RequestStatus.APROVADO || currentDisplay === 'Pendente') : (currentDisplay === statusFilter);
      }
      return matchesSearch && matchesBranch && matchesStatus;
    }).sort((a, b) => {
      const urgentA = isUrgent(a); const urgentB = isUrgent(b);
      if (urgentA && !urgentB) return -1; if (!urgentA && urgentB) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [requests, searchTerm, branchFilter, statusFilter, isMaster]);

  const isFinalized = selectedRequest && [RequestStatus.FATURADO, RequestStatus.ERRO_FINANCEIRO].includes(selectedRequest.status);

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden relative">
      {/* RENDERIZAÇÃO DO TOAST */}
      {toast && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-top duration-300">
          <div className={`flex items-center space-x-3 px-8 py-4 rounded-[2rem] shadow-2xl border ${
            toast.type === 'success' ? 'bg-green-600 border-green-500 text-white' :
            toast.type === 'error' ? 'bg-red-600 border-red-500 text-white' :
            'bg-slate-800 border-slate-700 text-white'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : 
             toast.type === 'error' ? <XCircle size={20} /> : 
             <Info size={20} />}
            <span className="font-black uppercase italic tracking-tight text-sm">{toast.msg}</span>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="relative w-64 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-5">
             <div className="flex flex-col">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><MapPin size={10} className="mr-1"/> Filial</label>
               <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none min-w-[140px]">
                  <option value="">Todas</option>
                  {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
             </div>
             <div className="flex flex-col">
               <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center"><Filter size={10} className="mr-1"/> Status</label>
               <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none min-w-[140px]">
                  <option value="">Todos</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Análise">Em Análise</option>
                  <option value="Faturado">Faturado</option>
                  <option value="Erro - Financeiro">Erro - Financeiro</option>
                  <option value="Compartilhado">Compartilhado</option>
                </select>
             </div>
          </div>
        </div>
        {selectedRequest && (
          <div className="flex items-center space-x-2 animate-in slide-in-from-right duration-300">
            <button onClick={handleOpenHistory} className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all border border-gray-200" title="Histórico"><History size={18}/></button>
            {isMaster && <button onClick={() => setIsShareModalOpen(true)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase border border-indigo-100 flex items-center hover:bg-indigo-100 transition-all shadow-sm"><Share2 size={16} className="mr-2" /> Divisão Regional</button>}
            {isFinalized && !isReworking ? (
              <button onClick={() => setIsReworking(true)} className="px-4 py-2 bg-amber-50 text-amber-700 font-black text-[10px] uppercase rounded-xl flex items-center border border-amber-100 shadow-sm hover:bg-amber-100 transition-all"><Edit3 size={16} className="mr-2" /> Editar Ações</button>
            ) : (
              <>
                <button onClick={() => setIsRejectModalOpen(true)} className="px-4 py-2 text-red-600 font-black text-[10px] uppercase border border-red-100 rounded-xl hover:bg-red-50 flex items-center"><XCircle size={16} className="mr-2" /> Reprovar</button>
                <button onClick={handleApprove} className="px-6 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-green-700 flex items-center transition-all active:scale-95">{isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />} {isMaster ? 'Concluir Faturamento' : 'Validar Liquidação'}</button>
                {isReworking && <button onClick={() => setIsReworking(false)} className="p-2 text-gray-400 hover:text-gray-600"><X size={18}/></button>}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest tracking-tighter">Fluxo Financeiro ({filteredRequests.length})</span></div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {isLoading ? (
                <div className="flex flex-col items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-tighter italic">Sincronizando...</span>
                </div>
            ) : (
                filteredRequests.slice(0, 100).map(r => {
                  const dStatus = resolveDisplayStatus(r);
                  const urgent = isUrgent(r);
                  const hasComment = r.shareComment && r.shareComment.trim() !== '';
                  const isSharedRequest = dStatus === 'Compartilhado' || r.status === RequestStatus.COMPARTILHADO || r.statusManual === 'Compartilhado' || (r.sharedWithEmail && stripHtml(r.sharedWithEmail).trim() !== '');

                  return (
                    <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-indigo-50 border-l-8 border-indigo-600 shadow-inner' : 'hover:bg-gray-50'} ${urgent ? 'border-r-4 border-red-500' : ''}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-gray-400">#{r.id}</span>
                        <div className="flex items-center space-x-2">
                          {urgent && <AlertTriangle size={14} className="text-red-500 animate-pulse" />}
                          
                          {isSharedRequest && (
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setViewingCommentData({ id: r.id, graphId: r.graphId, comment: r.shareComment || '' }); 
                                setEditedComment(r.shareComment || '');
                              }}
                              className={`p-1.5 rounded-lg transition-all hover:scale-110 flex items-center ${hasComment ? 'text-purple-600 bg-purple-50 shadow-sm' : 'text-gray-300 hover:text-indigo-400'}`}
                              title={hasComment ? "Ler observação" : "Adicionar observação"}
                            >
                              <MessageSquare size={14} strokeWidth={hasComment ? 2.5 : 2} />
                            </button>
                          )}

                          <Badge status={dStatus} className="scale-90 origin-right" />
                        </div>
                      </div>
                      <p className="font-black text-gray-900 text-sm uppercase truncate leading-tight">{r.title}</p>
                      {r.sharedWithEmail && (
                          <div className="flex items-center gap-1 mt-2">
                              <Share2 size={10} className="text-purple-600" />
                              <span className="text-[9px] font-black text-purple-600 uppercase truncate max-w-[150px] tracking-tighter italic">Divisão: {r.sharedWithEmail}</span>
                          </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex flex-col bg-gray-50/20">
                <div className="flex items-center space-x-3 mb-4">
                  <Badge status={resolveDisplayStatus(selectedRequest)} />
                  {isUrgent(selectedRequest) && <span className="text-[9px] font-black bg-red-100 text-red-600 px-2 py-0.5 rounded flex items-center"><AlertTriangle size={10} className="mr-1"/> URGENTE</span>}
                </div>
                <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate mb-4">{selectedRequest.title}</h2>
                <div className="flex space-x-6">
                   <div className="flex items-center">
                    <p className="text-sm font-black text-indigo-600 uppercase italic">NF: <span className="text-slate-900">{selectedRequest.invoiceNumber}</span></p>
                    {selectedRequest.invoiceNumber && <CopyButton text={selectedRequest.invoiceNumber} />}
                   </div>
                   <div className="flex items-center">
                    <p className="text-sm font-black text-indigo-600 uppercase italic">Pedido: <span className="text-slate-900">{selectedRequest.orderNumbers || '---'}</span></p>
                    {selectedRequest.orderNumbers && <CopyButton text={selectedRequest.orderNumbers} />}
                   </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <section className="bg-indigo-50/30 p-10 rounded-[3rem] border border-indigo-50 shadow-inner">
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8 border-b border-indigo-100 pb-3 italic flex items-center"><Landmark size={14} className="mr-2"/> Detalhes de Pagamento</h3>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6">
                           <div>
                            <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Favorecido / Razão Social</span>
                            <div className="flex items-center">
                              <p className="text-xl font-black text-slate-900 break-words leading-tight uppercase">{selectedRequest.payee || '---'}</p>
                              {selectedRequest.payee && <CopyButton text={selectedRequest.payee} />}
                            </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div><span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Vencimento</span><p className="text-sm font-black text-indigo-700 uppercase italic">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                              <div><span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Método</span><p className="text-sm font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod}</p></div>
                           </div>
                           {selectedRequest.paymentMethod === 'PIX' && (
                             <div className="pt-2"><span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Chave PIX</span><div className="flex items-center"><p className="text-xs font-bold text-slate-800 flex items-center"><Smartphone size={14} className="mr-1 text-indigo-400"/> {selectedRequest.pixKey}</p>{selectedRequest.pixKey && <CopyButton text={selectedRequest.pixKey} />}</div></div>
                           )}
                           {selectedRequest.paymentMethod === 'TED/DEPOSITO' && (
                             <div className="pt-2 text-[10px] font-bold text-slate-600 bg-white/50 p-4 rounded-2xl border border-indigo-100/50"><div className="flex items-center mb-1"><p>BANCO: <span className="text-indigo-600">{selectedRequest.bank}</span></p>{selectedRequest.bank && <CopyButton text={selectedRequest.bank} />}</div><div className="flex items-center"><p>AGÊNCIA/CONTA: <span className="text-indigo-600">{selectedRequest.agency} / {selectedRequest.account}</span></p>{selectedRequest.account && <CopyButton text={`${selectedRequest.agency} / ${selectedRequest.account}`} />}</div></div>
                           )}
                        </div>
                      </div>
                   </section>
                   <section className="space-y-6">
                      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-50 shadow-sm space-y-6">
                        <div>
                          <h3 className="text-[10px] font-black text-blue-600 uppercase italic mb-3 flex items-center border-b border-blue-50 pb-2"><FileText size={14} className="mr-2"/> Nota Fiscal (NF)</h3>
                          <div className="space-y-2">
                             {mainAttachments.length > 0 ? mainAttachments.map(att => (
                               <div key={att.id} className="flex justify-between items-center p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                 <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{att.fileName}</span>
                                 <button onClick={() => window.open(att.storageUrl, '_blank')} className="text-blue-600 hover:scale-110 transition-transform"><ExternalLink size={14}/></button>
                               </div>
                             )) : <p className="text-[9px] text-gray-400 font-bold uppercase italic text-center py-2">Sem NF anexada</p>}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-[10px] font-black text-indigo-600 uppercase italic mb-3 flex items-center border-b border-indigo-50 pb-2"><Paperclip size={14} className="mr-2"/> Boletos / Outros</h3>
                          <div className="space-y-2">
                             {secondaryAttachments.length > 0 ? secondaryAttachments.map(att => (
                               <div key={att.id} className="flex justify-between items-center p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl flex items-center justify-between transition-all hover:bg-indigo-100/50 min-w-0">
                                 <span className="text-[10px] font-bold text-slate-700 truncate mr-2">{att.fileName}</span>
                                 <button onClick={() => window.open(att.storageUrl, '_blank')} className="text-blue-600 hover:scale-110 transition-transform"><ExternalLink size={14}/></button>
                               </div>
                             )) : <p className="text-[9px] text-gray-400 font-bold uppercase italic text-center py-2">Sem boletos auxiliares</p>}
                          </div>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner"><span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação Solicitante</span><p className="text-sm font-medium text-slate-600 italic">"{selectedRequest.generalObservation || 'Sem obs.'}"</p></div>
                   </section>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-10"><DollarSign size={100} /></div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative border border-gray-100 animate-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white flex justify-between items-center"><h3 className="text-lg font-black uppercase italic tracking-tight">Reprovar Financeiro</h3><button onClick={() => setIsRejectModalOpen(false)}><X size={20}/></button></div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Motivo</label>
                <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-slate-800 outline-none">
                  <option value="Sem método de pagamento">Sem método de pagamento</option>
                  <option value="Nota fiscal não localizada para faturamento">Nota fiscal não localizada para faturamento</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Comentários</label>
                <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-slate-800 outline-none resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button onClick={handleConfirmReject} className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-red-700">Confirmar Reprovação</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsHistoryModalOpen(false)}></div>
          <div className="bg-white rounded-2.5rem w-full max-w-3xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-center shrink-0"><div className="flex items-center space-x-3 text-white"><History size={24} /><h3 className="text-lg font-black uppercase italic tracking-tight">Histórico de Alterações</h3></div><button onClick={() => setIsHistoryModalOpen(false)}><X size={20} /></button></div>
            <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
              {isFetchingHistory ? <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-indigo-600" size={40} /></div> : historyLogs.length > 0 ? (
                <div className="relative"><div className="absolute left-[20px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-300 via-purple-300 to-gray-200"></div><div className="space-y-8 relative">
                    {historyLogs.map((log: any, idx: number) => {
                      const config = getStatusConfig(log.status); const IconComponent = config.icon; const isFirst = idx === 0;
                      return (
                        <div key={log.id} className="relative pl-16 animate-in fade-in slide-in-from-left duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className={`absolute left-0 w-[40px] h-[40px] rounded-full ${config.bgColor} ${config.color} flex items-center justify-center shadow-md border-4 border-white z-10`}><IconComponent size={18} strokeWidth={2.5} /></div>
                          {!isFirst && <div className="absolute left-[17px] -top-4 text-indigo-300"><ArrowDown size={16} /></div>}
                          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                            <div className="flex justify-between items-start mb-4"><div><span className={`inline-block px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wide ${config.bgColor} ${config.color}`}>{log.status}</span>{isFirst && <span className="ml-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Mais Recente</span>}</div><span className="text-[10px] font-black text-gray-400 uppercase flex items-center"><Clock size={12} className="mr-1" />{new Date(log.createdAt).toLocaleString('pt-BR')}</span></div>
                            {log.obs && <p className="text-sm font-bold text-slate-800 mb-3 uppercase leading-relaxed">{log.obs}</p>}
                            {log.msg && <p className="text-xs font-medium text-slate-600 italic bg-white p-3 rounded-xl border border-gray-100 mb-4">{log.msg}</p>}
                            {log.user && <div className="flex items-center pt-3 border-t border-gray-200"><div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-[8px] font-black text-indigo-600 mr-2 uppercase">{log.user?.[0]}</div><span className="text-[10px] font-black text-indigo-600 uppercase">{log.user}</span></div>}
                          </div>
                        </div>
                      );
                    })}
                  </div></div>
              ) : <div className="flex flex-col items-center justify-center py-20 text-gray-300"><History size={64} className="mb-4 opacity-20" /><p className="font-black uppercase text-sm">Nenhum registro encontrado</p></div>}
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center shrink-0"><div className="flex items-center space-x-3 text-white"><Share2 size={24} /><h3 className="text-lg font-black uppercase italic tracking-tight">Divisão Regional</h3></div><button onClick={() => setIsShareModalOpen(false)}><X size={20}/></button></div>
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 space-y-4">
                <label className="text-[10px] font-black text-indigo-400 uppercase block text-center tracking-widest">Configurações de Compartilhamento</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-indigo-300 uppercase block mb-1">Regional de Destino</label>
                    <select value={shareEmail} onChange={e => setShareEmail(e.target.value)} className="w-full p-4 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="financeiro.sul@viagroup.com.br">financeiro.sul@viagroup.com.br</option>
                      <option value="financeiro.norte@viagroup.com.br">financeiro.norte@viagroup.com.br</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-indigo-300 uppercase block mb-1">Observação / Comentário</label>
                    <textarea value={shareCommentText} onChange={e => setShareCommentText(e.target.value)} placeholder="Ex: Instruções para processamento regional..." className="w-full p-4 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 h-[52px] resize-none" />
                  </div>
                </div>
                <div className="flex justify-center pt-2"><button onClick={handleShare} className="px-10 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-700 flex items-center transition-all active:scale-95"><Globe size={16} className="mr-2" /> Confirmar Compartilhamento</button></div>
              </div>
              <div className="flex items-center justify-between border-b pb-4"><h4 className="text-sm font-black text-slate-800 uppercase italic">Histórico de Regionais</h4><div className="flex bg-gray-100 p-1 rounded-xl"><button onClick={() => setSharedStatusFilter('PENDENTE')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${sharedStatusFilter === 'PENDENTE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Pendentes</button><button onClick={() => setSharedStatusFilter('TODOS')} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${sharedStatusFilter === 'TODOS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>Ver Todos</button></div></div>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2 italic flex items-center"><Globe size={14} className="mr-2" /> Regional Norte</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {northShared.length > 0 ? northShared.map(h => (
                      <div key={h.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between truncate"><div className="truncate flex-1"><span className="text-[10px] font-black text-indigo-600 block mb-1 leading-none">#{h.id}</span><p className="text-[11px] font-bold text-gray-700 truncate">{h.title}</p></div><Badge status={resolveDisplayStatus(h)} className="scale-75 origin-right" /></div>
                    )) : <p className="text-center py-6 text-gray-300 font-bold italic text-[9px] uppercase">Vazio</p>}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b pb-2 italic flex items-center"><Globe size={14} className="mr-2" /> Regional Sul</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {southShared.length > 0 ? southShared.map(h => (
                      <div key={h.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between truncate"><div className="truncate flex-1"><span className="text-[10px] font-black text-indigo-600 block mb-1 leading-none">#{h.id}</span><p className="text-[11px] font-bold text-gray-700 truncate">{h.title}</p></div><Badge status={resolveDisplayStatus(h)} className="scale-75 origin-right" /></div>
                    )) : <p className="text-center py-6 text-gray-300 font-bold italic text-[9px] uppercase">Vazio</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingCommentData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative border border-gray-100 animate-in zoom-in duration-200">
            <header className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <MessageSquare size={20} />
                <h3 className="text-lg font-black uppercase italic tracking-tight">Observação do Compartilhamento</h3>
              </div>
              <button onClick={() => setViewingCommentData(null)} className="hover:rotate-90 transition-transform"><X size={20}/></button>
            </header>
            <div className="p-8">
              {isMaster ? (
                <div className="space-y-6">
                  <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100 relative"><textarea value={editedComment} onChange={(e) => setEditedComment(e.target.value)} placeholder="Adicione uma observação interna para este faturamento..." className="w-full h-40 bg-transparent border-none outline-none text-sm font-bold text-slate-800 italic resize-none placeholder:text-purple-300" /></div>
                  <div className="flex gap-4"><button onClick={handleClearComment} className="flex-1 py-4 text-red-500 font-black text-[10px] uppercase border border-red-50 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center"><TrashIcon size={16} className="mr-2" /> Limpar</button><button disabled={isSavingComment} onClick={handleSaveComment} className="flex-[2] py-4 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center">{isSavingComment ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}Salvar Alterações</button></div>
                </div>
              ) : (
                <div className="space-y-6 text-center"><div className="bg-purple-50 p-8 rounded-3xl border border-purple-100"><p className="text-sm text-slate-800 font-medium italic leading-relaxed">{viewingCommentData.comment ? `"${viewingCommentData.comment}"` : "Nenhuma observação registrada para este item."}</p></div><button onClick={() => setViewingCommentData(null)} className="px-10 py-4 bg-purple-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-purple-700 transition-all active:scale-95">Fechar Visualização</button></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
