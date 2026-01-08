
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  DollarSign, Search, Banknote, FileText, ExternalLink, Paperclip, CheckCircle, MapPin, Filter, Landmark, Loader2, Calendar, XCircle, AlertTriangle, MessageSquare, Share2, X, Edit3, Globe
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

  // Modais de Ação
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Sem método de pagamento');
  const [rejectComment, setRejectComment] = useState('');
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('financeiro.norte@viagroup.com.br');
  
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FINANCEIRO_MASTER || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    
    let filtered = data.filter(r => [
      RequestStatus.APROVADO, 
      RequestStatus.ANALISE, 
      RequestStatus.FATURADO, 
      RequestStatus.ERRO_FINANCEIRO,
      RequestStatus.COMPARTILHADO
    ].includes(r.status) || (r.sharedWithEmail && r.sharedWithEmail !== ''));

    // Regra de Visibilidade Financeiro Comum: Apenas o que foi compartilhado com ele
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
            setMainAttachments(main); 
            setSecondaryAttachments(secondary); 
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

  const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Faturado', value: RequestStatus.FATURADO },
    { label: 'Erro - Financeiro', value: RequestStatus.ERRO_FINANCEIRO },
    { label: 'Em Análise', value: RequestStatus.ANALISE },
    { label: 'Pendente', value: RequestStatus.PENDENTE },
  ];

  // Listagem dividida regionalmente para o pop-up de compartilhamento
  const northShared = useMemo(() => requests.filter(r => r.sharedWithEmail === 'financeiro.norte@viagroup.com.br'), [requests]);
  const southShared = useMemo(() => requests.filter(r => r.sharedWithEmail === 'financeiro.sul@viagroup.com.br'), [requests]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.FATURADO : RequestStatus.ANALISE;
      const comment = isMaster ? 'Concluído Faturamento pelo Financeiro Master.' : 'Encaminhado para validação Master pelo Financeiro Comum.';
      
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        approverObservation: comment, // Salvo na nova coluna
        errorObservation: ''
      });
      await loadData(); 
      setSelectedId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao processar faturamento.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.ERRO_FINANCEIRO : RequestStatus.ANALISE;
      
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        status: targetStatus,
        errorObservation: rejectReason, 
        approverObservation: rejectComment // Salvo na nova coluna
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

  const handleShare = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      await sharepointService.updateRequest(authState.token, selectedRequest.graphId, {
        sharedWithEmail: shareEmail,
        statusManual: 'Compartilhado'
      });
      await loadData();
      setIsShareModalOpen(false);
      alert(`Solicitação compartilhada com ${shareEmail}`);
    } catch (e) {
      console.error(e);
      alert("Erro ao compartilhar solicitação.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleViewFile = (url: string) => { if (url) window.open(url, '_blank'); };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.id.toString().includes(searchTerm) || 
                           r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      const matchesStatus = statusFilter === '' || r.status === statusFilter;
      
      let matchesDate = true;
      if (dateFilter) {
        const itemDate = new Date(r.createdAt).toISOString().split('T')[0];
        matchesDate = itemDate === dateFilter;
      }

      return matchesSearch && matchesBranch && matchesStatus && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, dateFilter, branchFilter, statusFilter]);

  const isFinalized = selectedRequest && [RequestStatus.FATURADO, RequestStatus.ERRO_FINANCEIRO].includes(selectedRequest.status);

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-6">
        <div className="relative w-64 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar ID ou NF..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500" 
          />
        </div>
        
        <div className="flex items-center gap-5">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <Calendar size={10} className="mr-1"/> Data Criação
            </label>
            <input 
              type="date" 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <MapPin size={10} className="mr-1"/> Filial
            </label>
            <select 
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
            >
              <option value="">Todas as Filiais</option>
              {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <Filter size={10} className="mr-1"/> Status
            </label>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px]"
            >
              {statusOptions.map(opt => (
                <option key={opt.label} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financeiro ({filteredRequests.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {filteredRequests.map(r => {
              // Regra Master: Se compartilhado, status 'Compartilhado'
              // Regra Comum: Sempre 'Pendente' (visto que só veem o compartilhado)
              let displayStatus: any = r.status;
              if (isMaster && r.sharedWithEmail) {
                displayStatus = RequestStatus.COMPARTILHADO;
              } else if (!isMaster) {
                displayStatus = RequestStatus.PENDENTE;
              } else if (r.status === RequestStatus.APROVADO) {
                displayStatus = RequestStatus.PENDENTE;
              }

              return (
                <div 
                  key={r.id} 
                  onClick={() => setSelectedId(r.id)} 
                  className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-indigo-50 border-l-8 border-indigo-600 shadow-inner' : 'hover:bg-gray-50'}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-black text-gray-400">#{r.id}</span>
                    <Badge status={displayStatus} className="scale-90 origin-right" />
                  </div>
                  <p className="font-black text-gray-900 text-sm uppercase truncate leading-tight">{r.title}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex justify-between items-center bg-gray-50/20">
                <div className="max-w-[50%]">
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge status={selectedRequest.status === RequestStatus.APROVADO ? RequestStatus.PENDENTE : selectedRequest.status} />
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                      {isMaster ? 'Modo Master' : 'Modo Analista'}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate">{selectedRequest.title}</h2>
                </div>
                <div className="flex space-x-3">
                  {isMaster && (
                    <button onClick={() => setIsShareModalOpen(true)} className="px-6 py-3.5 bg-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase italic flex items-center hover:bg-indigo-200 transition-all shadow-sm">
                      <Share2 size={18} className="mr-2" /> Compartilhar
                    </button>
                  )}
                  
                  {isFinalized && !isReworking ? (
                    <button 
                      onClick={() => setIsReworking(true)}
                      className="px-6 py-3.5 bg-amber-100 text-amber-700 font-black text-[10px] uppercase rounded-2xl hover:bg-amber-200 transition-all flex items-center shadow-sm"
                    >
                      <Edit3 size={18} className="mr-2" /> Editar Ações
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsRejectModalOpen(true)} 
                        disabled={isProcessingAction}
                        className="px-6 py-3.5 text-red-600 font-black text-[10px] uppercase border-2 border-red-100 rounded-2xl hover:bg-red-50 transition-all flex items-center shadow-sm disabled:opacity-50"
                      >
                        <XCircle size={18} className="mr-2" /> Reprovar
                      </button>
                      <button 
                        onClick={handleApprove} 
                        disabled={isProcessingAction}
                        className="px-10 py-3.5 bg-green-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-green-700 transition-all flex items-center disabled:opacity-50"
                      >
                        {isProcessingAction ? <Loader2 size={18} className="animate-spin mr-2" /> : <CheckCircle size={18} className="mr-2" />}
                        {isMaster ? 'Concluir Faturamento' : 'Validar Liquidação'}
                      </button>
                      {isReworking && (
                         <button onClick={() => setIsReworking(false)} className="p-3.5 text-gray-400 hover:text-gray-600"><X size={20}/></button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <section className="bg-indigo-50/30 p-10 rounded-[3rem] border border-indigo-50 shadow-inner">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8 border-b border-indigo-100 pb-3 italic flex items-center">
                      <Landmark size={14} className="mr-2"/> Dados p/ Liquidação
                    </h3>
                    <div className="space-y-8">
                      {selectedRequest.payee && selectedRequest.payee.trim() !== '' && (
                        <div>
                          <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Favorecido / Razão Social</span>
                          <p className="text-2xl font-black text-slate-900 break-words leading-tight">{selectedRequest.payee}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Método</span>
                            <p className="text-xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod || '---'}</p>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Data Vencimento</span>
                            <p className="text-xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p>
                         </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6 flex flex-col gap-6">
                    <div>
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-3 italic">
                        <Paperclip size={16} className="mr-2" /> Documentação
                      </h3>
                      <div className="space-y-4 pt-4">
                        {[...mainAttachments, ...secondaryAttachments].map(att => (
                          <div key={att.id} className="p-4 bg-white border border-indigo-100 rounded-2xl flex items-center shadow group hover:border-indigo-500 transition-all">
                            <div className={`p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform bg-indigo-600 text-white`}><FileText size={20}/></div>
                            <div className="flex-1 truncate"><span className="text-gray-900 font-bold text-xs block truncate">{att.fileName}</span></div>
                            <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"><ExternalLink size={16} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                        <span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação do Solicitante</span>
                        <p className="text-sm font-medium text-slate-600 italic">
                          {selectedRequest.generalObservation ? `"${selectedRequest.generalObservation}"` : 'Sem observações.'}
                        </p>
                      </div>

                      {selectedRequest.approverObservation && (
                        <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                          <span className="text-[9px] font-black text-indigo-400 uppercase block mb-2 italic flex items-center"><CheckCircle size={12} className="mr-2"/> Histórico de Aprovação</span>
                          <p className="text-sm font-bold text-indigo-900 italic">
                            "{selectedRequest.approverObservation}"
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center p-20">
              <DollarSign size={100} className="opacity-10 mb-6" />
              <h3 className="text-2xl font-black text-gray-900 uppercase italic">Gestão Financeira</h3>
            </div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-red-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-black uppercase italic leading-none tracking-tight">Reprovar Financeiro</h3>
              </div>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Motivo Financeiro</label>
                <select 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Sem método de pagamento">Sem método de pagamento</option>
                  <option value="Nota fiscal não localizada para faturamento">Nota fiscal não localizada para faturamento</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Comentários</label>
                <textarea 
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Informe os ajustes necessários..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors">Voltar</button>
                <button 
                  onClick={handleConfirmReject}
                  disabled={isProcessingAction}
                  className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-red-700 transition-all flex items-center justify-center disabled:opacity-50"
                >
                  {isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <XCircle size={16} className="mr-2" />}
                  Confirmar Reprovação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Compartilhamento Regionalizado */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <Share2 size={24} />
                <h3 className="text-lg font-black uppercase italic leading-none tracking-tight">Divisão Regional de Fluxo</h3>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-3 ml-1 text-center">Selecionar Responsável p/ {selectedRequest?.title}</label>
                <div className="flex gap-4">
                  <select 
                    value={shareEmail}
                    onChange={e => setShareEmail(e.target.value)}
                    className="flex-1 p-4 bg-white border border-indigo-200 rounded-xl text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="financeiro.sul@viagroup.com.br">financeiro.sul@viagroup.com.br</option>
                    <option value="financeiro.norte@viagroup.com.br">financeiro.norte@viagroup.com.br</option>
                  </select>
                  <button 
                    onClick={handleShare}
                    disabled={isProcessingAction}
                    className="px-6 py-4 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all flex items-center shrink-0 disabled:opacity-50"
                  >
                    {isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                    Compartilhar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                {/* Coluna Norte */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2 italic flex items-center">
                    <Globe size={14} className="mr-2" /> Regional Norte
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {northShared.length > 0 ? northShared.map(h => (
                      <div key={h.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                        <div className="truncate flex-1">
                          <span className="text-[10px] font-black text-indigo-600 block leading-none mb-1">#{h.id}</span>
                          <p className="text-xs font-bold text-gray-700 truncate">{h.title}</p>
                        </div>
                        <Badge status={h.status === RequestStatus.APROVADO ? RequestStatus.PENDENTE : h.status} className="scale-75 origin-right" />
                      </div>
                    )) : (
                      <p className="text-center py-6 text-gray-300 font-bold italic text-[9px] uppercase">Vazio</p>
                    )}
                  </div>
                </div>

                {/* Coluna Sul */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b pb-2 italic flex items-center">
                    <Globe size={14} className="mr-2" /> Regional Sul
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {southShared.length > 0 ? southShared.map(h => (
                      <div key={h.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                        <div className="truncate flex-1">
                          <span className="text-[10px] font-black text-indigo-600 block leading-none mb-1">#{h.id}</span>
                          <p className="text-xs font-bold text-gray-700 truncate">{h.title}</p>
                        </div>
                        <Badge status={h.status === RequestStatus.APROVADO ? RequestStatus.PENDENTE : h.status} className="scale-75 origin-right" />
                      </div>
                    )) : (
                      <p className="text-center py-6 text-gray-300 font-bold italic text-[9px] uppercase">Vazio</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4 border-t border-gray-100">
                <button onClick={() => setIsShareModalOpen(false)} className="px-10 py-3 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors">Fechar Painel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
