
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import Badge from '../components/Badge';
import { 
  DollarSign, Search, Banknote, FileText, ExternalLink, Paperclip, CheckCircle, MapPin, Filter, Landmark, Loader2, Calendar, XCircle, AlertTriangle, MessageSquare, Share2, X
} from 'lucide-react';

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modais de Ação
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Dados Bancários Incorretos');
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
    
    // Regra: Exibir apenas aprovados pelo fiscal ou status financeiros subsequentes
    const financeOnly = data.filter(r => [
      RequestStatus.APROVADO, 
      RequestStatus.ANALISE, 
      RequestStatus.FATURADO, 
      RequestStatus.ERRO_FINANCEIRO
    ].includes(r.status));
    
    setRequests(financeOnly);
  };

  useEffect(() => { loadData(); }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  useEffect(() => {
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

  // Lógica de Filiais Dinâmicas
  const availableBranches = useMemo(() => {
    const branches = requests
      .map(r => r.branch)
      .filter(branch => branch && branch.trim() !== '');
    return Array.from(new Set(branches)).sort();
  }, [requests]);

  // Opções de Status Específicas
  const statusOptions = [
    { label: 'Todos', value: '' },
    { label: 'Faturado', value: RequestStatus.FATURADO },
    { label: 'Erro - Financeiro', value: RequestStatus.ERRO_FINANCEIRO },
    { label: 'Em Análise', value: RequestStatus.ANALISE },
    { label: 'Pendente', value: RequestStatus.PENDENTE },
  ];

  // Histórico de compartilhamento para o modal
  const sharedHistory = useMemo(() => {
    return requests.filter(r => 
      r.sharedWithEmail === shareEmail && 
      r.status === RequestStatus.APROVADO // Apenas pendentes conforme solicitado
    );
  }, [requests, shareEmail]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      const targetStatus = isMaster ? RequestStatus.FATURADO : RequestStatus.ANALISE;
      const comment = isMaster ? 'Concluído Faturamento pelo Financeiro Master.' : 'Encaminhado para validação Master pelo Financeiro Comum.';
      
      await requestService.changeStatus(selectedRequest.graphId, targetStatus, authState.token, comment);
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
      const fullComment = `[REPROVAÇÃO FINANCEIRA: ${rejectReason}] ${rejectComment}`;
      
      await requestService.changeStatus(selectedRequest.graphId, targetStatus, authState.token, fullComment);
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

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">
      
      {/* Barra de Filtros Superior - Padrão Fiscal */}
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
        {/* Listagem Lateral */}
        <div className="w-96 flex flex-col bg-white border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aguardando Liquidação ({filteredRequests.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {filteredRequests.map(r => {
              // Regra visual: Aprovado pelo fiscal aparece como Pendente no Financeiro
              let displayStatus: any = r.status;
              if (r.status === RequestStatus.APROVADO) displayStatus = RequestStatus.PENDENTE;
              
              // Se em análise e usuário comum, mostra como Aprovado
              if (r.status === RequestStatus.ANALISE && !isMaster) displayStatus = RequestStatus.APROVADO;

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
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] text-indigo-500 font-bold italic uppercase tracking-widest">{r.branch}</span>
                    <span className="text-[9px] text-gray-400 font-medium">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalhes do Registro */}
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
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 flex items-center"><MapPin size={14} className="mr-2 text-indigo-500"/> FILIAL: {selectedRequest.branch} • ID: {selectedRequest.id}</p>
                </div>
                <div className="flex space-x-3">
                  {/* Botão de Compartilhar Exclusivo Master */}
                  {isMaster && (
                    <button 
                      onClick={() => setIsShareModalOpen(true)}
                      className="px-6 py-3.5 bg-indigo-100 text-indigo-600 rounded-2xl font-black text-[10px] uppercase italic flex items-center hover:bg-indigo-200 transition-all shadow-sm"
                    >
                      <Share2 size={18} className="mr-2" /> Compartilhar
                    </button>
                  )}
                  
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
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <section className="bg-indigo-50/30 p-10 rounded-[3rem] border border-indigo-50 shadow-inner">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-8 border-b border-indigo-100 pb-3 italic flex items-center">
                      <Landmark size={14} className="mr-2"/> Dados p/ Liquidação
                    </h3>
                    <div className="space-y-8">
                      <div>
                        <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Favorecido / Razão Social</span>
                        <p className="text-2xl font-black text-slate-900 break-words leading-tight">{selectedRequest.payee || '---'}</p>
                      </div>
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

                      {selectedRequest.paymentMethod === 'PIX' && (
                        <div className="pt-4 border-t border-indigo-100/50">
                          <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Chave PIX</span>
                          <p className="text-lg font-bold text-indigo-900 break-all">{selectedRequest.pixKey || '---'}</p>
                        </div>
                      )}

                      {selectedRequest.paymentMethod === 'TED/DEPOSITO' && (
                        <div className="pt-4 border-t border-indigo-100/50 grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Banco</span>
                            <p className="text-sm font-bold text-slate-900">{selectedRequest.bank || '---'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-indigo-300 uppercase block mb-1">Ag/Conta</span>
                            <p className="text-sm font-bold text-slate-900">{selectedRequest.agency} / {selectedRequest.account}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-3 italic">
                      <Paperclip size={16} className="mr-2" /> Documentação Auxiliar {isFetchingAttachments && <Loader2 size={14} className="ml-2 animate-spin text-indigo-600" />}
                    </h3>
                    <div className="space-y-4">
                      {[...mainAttachments, ...secondaryAttachments].map(att => (
                        <div key={att.id} className="p-4 bg-white border border-indigo-100 rounded-2xl flex items-center shadow group hover:border-indigo-500 transition-all">
                          <div className={`p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform ${att.type === 'invoice_pdf' ? 'bg-indigo-600' : 'bg-blue-600'} text-white`}><FileText size={20}/></div>
                          <div className="flex-1 truncate"><span className="text-gray-900 font-bold text-xs block truncate">{att.fileName}</span></div>
                          <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"><ExternalLink size={16} /></button>
                        </div>
                      ))}
                      {!isFetchingAttachments && mainAttachments.length === 0 && secondaryAttachments.length === 0 && (
                        <div className="p-12 border-2 border-dashed border-gray-100 rounded-[2rem] text-center text-gray-300 font-bold italic text-sm">Nenhum documento disponível.</div>
                      )}
                    </div>
                  </section>
                </div>

                {selectedRequest.generalObservation && (
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação da Solicitação</span>
                    <p className="text-sm font-medium text-slate-600 italic">"{selectedRequest.generalObservation}"</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center p-20">
              <DollarSign size={100} className="opacity-10 mb-6" />
              <h3 className="text-2xl font-black text-gray-900 uppercase italic">Gestão Financeira</h3>
              <p className="text-sm font-bold text-gray-400 mt-4 max-w-xs">Aguardando seleção de nota aprovada pelo fiscal para processamento de liquidação.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reprovação Financeira */}
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
                  <option value="Dados Bancários Incorretos">Dados Bancários Incorretos</option>
                  <option value="Valor Divergente">Valor Divergente</option>
                  <option value="NF Sem Pedido">NF Sem Pedido</option>
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

      {/* Modal de Compartilhamento (Exclusivo Master) */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsShareModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl relative animate-in zoom-in duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="bg-indigo-600 p-6 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <Share2 size={24} />
                <h3 className="text-lg font-black uppercase italic leading-none tracking-tight">Compartilhar Fluxo</h3>
              </div>
              <button onClick={() => setIsShareModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1 text-center">Selecionar Responsável Regional</label>
                <select 
                  value={shareEmail}
                  onChange={e => setShareEmail(e.target.value)}
                  className="w-full p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm font-bold text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="financeiro.sul@viagroup.com.br">financeiro.sul@viagroup.com.br</option>
                  <option value="financeiro.norte@viagroup.com.br">financeiro.norte@viagroup.com.br</option>
                </select>
              </div>

              {/* Histórico no Pop-up */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b pb-2 italic">Histórico Pendente p/ {shareEmail}</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {sharedHistory.length > 0 ? sharedHistory.map(h => (
                    <div key={h.id} className="p-3 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-between">
                      <div className="truncate flex-1">
                        <span className="text-[10px] font-black text-indigo-600 block leading-none mb-1">#{h.id}</span>
                        <p className="text-xs font-bold text-gray-700 truncate">{h.title}</p>
                      </div>
                      <Badge status={RequestStatus.PENDENTE} className="scale-75 origin-right" />
                    </div>
                  )) : (
                    <p className="text-center py-6 text-gray-300 font-bold italic text-[10px] uppercase">Nenhuma pendência compartilhada.</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 shrink-0">
                <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors">Fechar</button>
                <button 
                  onClick={handleShare}
                  disabled={isProcessingAction}
                  className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center disabled:opacity-50"
                >
                  {isProcessingAction ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                  Confirmar Compartilhamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay de Processamento Global */}
      {isProcessingAction && (
        <div className="fixed inset-0 z-[110] bg-white/20 backdrop-blur-[2px] flex items-center justify-center cursor-wait">
          <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 flex items-center space-x-4">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <span className="text-xs font-black uppercase tracking-widest text-gray-600 italic">Processando liquidação...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
