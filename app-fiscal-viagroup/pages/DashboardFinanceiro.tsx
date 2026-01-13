
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  DollarSign, Search, CheckCircle, MapPin, Filter, Landmark, Loader2, Calendar, XCircle, AlertTriangle, MessageSquare, Share2, X, Edit3, Globe, FileText, ExternalLink, Paperclip
} from 'lucide-react';

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isReworking, setIsReworking] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
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

  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FINANCEIRO_MASTER || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  // Função centralizada para resolver o status visual conforme hierarquia solicitada
  const resolveDisplayStatus = (r: PaymentRequest): string => {
    // Prioridade 1: Erro - Financeiro
    if (r.status === RequestStatus.ERRO_FINANCEIRO) return RequestStatus.ERRO_FINANCEIRO;

    // Prioridade Especial: Para usuário comum, APROVADO (vindo do fiscal) aparece como PENDENTE
    if (!isMaster && r.status === RequestStatus.APROVADO) return RequestStatus.PENDENTE;

    // Prioridade 2: Status Final preenchido
    if (r.statusFinal && r.statusFinal.trim() !== '') return r.statusFinal;

    // Prioridade 3: Se o usuário for sofia.ferneda, exibe Status Manual
    if (authState.user?.email.toLowerCase() === 'sofia.ferneda@viagroup.com.br') {
      if (r.statusManual && r.statusManual.trim() !== '') return r.statusManual;
    }

    // Prioridade 4: Se Status Manual for 'Compartilhado'
    if (r.statusManual === 'Compartilhado') return 'Compartilhado';

    // Prioridade 5: Fallback para Status Espelho ou Status Original
    let fallback = r.statusEspelho && r.statusEspelho.trim() !== '' ? r.statusEspelho : r.status;
    
    // Tratamento adicional de nome para visualização
    if (fallback === RequestStatus.APROVADO) return RequestStatus.PENDENTE;
    
    return fallback;
  };

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    
    // Filtro base para a tela Financeira
    let filtered = data.filter(r => [
      RequestStatus.APROVADO, 
      RequestStatus.ANALISE, 
      RequestStatus.FATURADO, 
      RequestStatus.ERRO_FINANCEIRO, 
      RequestStatus.COMPARTILHADO
    ].includes(r.status) || (r.sharedWithEmail && r.sharedWithEmail.trim() !== ''));

    if (authState.user.role === UserRole.FINANCEIRO) {
      filtered = filtered.filter(r => r.sharedWithEmail?.toLowerCase() === authState.user?.email.toLowerCase());
    }
    setRequests(filtered);
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
        } catch (e) { console.error(e); } finally { if (isMounted) setIsFetchingAttachments(false); }
      } else { setMainAttachments([]); setSecondaryAttachments([]); }
    };
    fetchAtts();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const availableBranches = useMemo(() => {
    const branches = requests.map(r => r.branch).filter(b => b && b.trim() !== '');
    return Array.from(new Set(branches)).sort();
  }, [requests]);

  /**
   * CORREÇÃO: Removida restrição de status para exibir histórico completo de compartilhamento.
   * Adicionado trim() para garantir robustez na comparação de e-mails.
   */
  const northShared = useMemo(() => 
    requests.filter(r => 
      r.sharedWithEmail?.trim().toLowerCase() === 'financeiro.norte@viagroup.com.br'
    ), 
  [requests]);
  
  /**
   * CORREÇÃO: Removida restrição de status para exibir histórico completo de compartilhamento.
   * Adicionado trim() para garantir robustez na comparação de e-mails.
   */
  const southShared = useMemo(() => 
    requests.filter(r => 
      r.sharedWithEmail?.trim().toLowerCase() === 'financeiro.sul@viagroup.com.br'
    ), 
  [requests]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    setIsProcessingAction(true);
    try {
      let targetStatus: RequestStatus;
      let comment: string;

      if (isMaster) {
        targetStatus = RequestStatus.FATURADO;
        comment = 'Faturamento concluído pelo Master.';
      } else {
        targetStatus = RequestStatus.ANALISE;
        comment = 'Validado pelo financeiro regional. Aguardando conferência Master.';
      }
      
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        approverObservation: comment,
        errorObservation: ''
      });
      await loadData(); setSelectedId(null);
    } catch (e) { alert("Erro ao aprovar."); } finally { setIsProcessingAction(false); }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.ERRO_FINANCEIRO : RequestStatus.ANALISE;
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        errorObservation: rejectReason, 
        approverObservation: rejectComment
      });
      await loadData(); setIsRejectModalOpen(false); setSelectedId(null);
    } catch (e) { alert("Erro ao reprovar."); } finally { setIsProcessingAction(false); }
  };

  /**
   * FUNÇÃO AJUSTADA: Realiza a gravação completa de compartilhamento no SharePoint.
   * Utiliza exatamente os nomes técnicos: PESSOA_COMPARTILHADA, STATUS_ESPELHO_MANUAL, 
   * PESSOA_COMPARTILHOU e COMENTARIO_COMPARTILHAMENTO via updateRequest (PATCH).
   */
  const handleShare = async () => {
    if (!selectedRequest || !authState.token || !authState.user) return;
    
    if (!shareEmail) {
      alert("Por favor, selecione uma regional de destino.");
      return;
    }

    setIsProcessingAction(true);
    try {
      // Patch enviando apenas os campos de compartilhamento, preservando o restante do item
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        sharedWithEmail: shareEmail,            // Mapeia para PESSOA_COMPARTILHADA
        statusManual: 'Compartilhado',          // Mapeia para STATUS_ESPELHO_MANUAL
        sharedByName: authState.user.name,      // Mapeia para PESSOA_COMPARTILHOU
        shareComment: shareCommentText.trim()  // Mapeia para COMENTARIO_COMPARTILHAMENTO
      });

      // Recarrega os dados para atualizar a interface e o status visual (Prioridade 4)
      await loadData(); 
      
      // Fecha o modal e limpa o estado de comentário
      setIsShareModalOpen(false);
      setShareCommentText('');
    } catch (e) { 
      console.error("Erro no compartilhamento SharePoint:", e);
      alert("Erro ao salvar informações de compartilhamento no SharePoint."); 
    } finally { 
      setIsProcessingAction(false); 
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toString().includes(searchTerm);
      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      
      // Lógica de filtro de status alinhada com resolveDisplayStatus
      let matchesStatus = true;
      if (statusFilter !== '') {
        const currentDisplay = resolveDisplayStatus(r);
        if (statusFilter === 'Pendente') {
          matchesStatus = r.status === RequestStatus.APROVADO || currentDisplay === 'Pendente';
        } else {
          matchesStatus = currentDisplay === statusFilter;
        }
      }

      return matchesSearch && matchesBranch && matchesStatus;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, branchFilter, statusFilter, isMaster, authState.user]);

  const isFinalized = selectedRequest && [RequestStatus.FATURADO, RequestStatus.ERRO_FINANCEIRO].includes(selectedRequest.status);

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      {/* Toolbar Atualizada com Filtro de Status */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-6">
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

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Lista Lateral */}
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest tracking-tighter">Fluxo Financeiro ({filteredRequests.length})</span></div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {filteredRequests.map(r => {
              const dStatus = resolveDisplayStatus(r);
              return (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-indigo-50 border-l-8 border-indigo-600 shadow-inner' : 'hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-gray-400">#{r.id}</span><Badge status={dStatus} className="scale-90 origin-right" /></div>
                  <p className="font-black text-gray-900 text-sm uppercase truncate leading-tight">{r.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes */}
        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex justify-between items-center bg-gray-50/20">
                <div className="max-w-[50%]">
                   <div className="flex items-center space-x-3 mb-2">
                     <Badge status={resolveDisplayStatus(selectedRequest)} />
                   </div>
                   <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate">{selectedRequest.title}</h2>
                </div>
                <div className="flex space-x-3">
                  {isMaster && <button onClick={() => setIsShareModalOpen(true)} className="px-6 py-3.5 bg-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase italic flex items-center hover:bg-indigo-200 transition-all shadow-sm"><Share2 size={18} className="mr-2" /> Compartilhar</button>}
                  {isFinalized && !isReworking ? (
                    <button onClick={() => setIsReworking(true)} className="px-6 py-3.5 bg-amber-100 text-amber-700 font-black text-[10px] uppercase rounded-2xl flex items-center shadow-sm hover:bg-amber-200 transition-all"><Edit3 size={18} className="mr-2" /> Editar Ações</button>
                  ) : (
                    <>
                      <button onClick={() => setIsRejectModalOpen(true)} disabled={isProcessingAction} className="px-6 py-3.5 text-red-600 font-black text-[10px] uppercase border-2 border-red-100 rounded-2xl hover:bg-red-50 flex items-center shadow-sm disabled:opacity-50"><XCircle size={18} className="mr-2" /> Reprovar</button>
                      <button onClick={handleApprove} disabled={isProcessingAction} className="px-10 py-3.5 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-green-700 flex items-center disabled:opacity-50 transition-all active:scale-95">
                        {isProcessingAction ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle size={18} className="mr-2" />} {isMaster ? 'Concluir Faturamento' : 'Validar Liquidação'}
                      </button>
                      {isReworking && <button onClick={() => setIsReworking(false)} className="p-3.5 text-gray-400 hover:text-gray-600"><X size={20}/></button>}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <section className="bg-indigo-50/30 p-10 rounded-[3rem] border border-indigo-50 shadow-inner">
                      <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8 border-b border-indigo-100 pb-3 italic flex items-center"><Landmark size={14} className="mr-2"/> Pagamento</h3>
                      <div className="space-y-6">
                        {selectedRequest.payee && selectedRequest.payee.trim() !== '' && (<div><span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Favorecido</span><p className="text-2xl font-black text-slate-900 break-words leading-tight">{selectedRequest.payee}</p></div>)}
                        <div><span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Método / Vencimento</span><p className="text-xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod} • {new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      </div>
                   </section>
                   <section className="space-y-4">
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner"><span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação Solicitante</span><p className="text-sm font-medium text-slate-600 italic">"{selectedRequest.generalObservation || 'Sem obs.'}"</p></div>
                      {selectedRequest.approverObservation && (
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100"><span className="text-[9px] font-black text-indigo-400 uppercase block mb-2 italic flex items-center"><CheckCircle size={12} className="mr-2"/> Histórico de Aprovação</span><p className="text-sm font-bold text-indigo-900 italic">"{selectedRequest.approverObservation}"</p></div>
                      )}
                      {selectedRequest.shareComment && (
                        <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100"><span className="text-[9px] font-black text-purple-400 uppercase block mb-2 italic flex items-center"><Share2 size={12} className="mr-2"/> Obs. Compartilhamento (por {selectedRequest.sharedByName})</span><p className="text-sm font-bold text-purple-900 italic">"{selectedRequest.shareComment}"</p></div>
                      )}
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
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative border border-gray-100 flex flex-col animate-in zoom-in duration-200">
            <div className="bg-red-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-lg font-black uppercase italic tracking-tight">Reprovar Financeiro</h3>
              <button onClick={() => setIsRejectModalOpen(false)}><X size={20}/></button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Motivo</label>
                <select value={rejectReason} onChange={e => setRejectReason(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none">
                  <option value="Sem método de pagamento">Sem método de pagamento</option>
                  <option value="Nota fiscal não localizada para faturamento">Nota fiscal não localizada para faturamento</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Comentários (OBSERVACAO_APROVADORES)</label>
                <textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none resize-none" />
              </div>
              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400">Voltar</button>
                <button onClick={handleConfirmReject} disabled