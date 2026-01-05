
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { BRANCHES } from '../constants';
import Badge from '../components/Badge';
import { 
  Search, CheckCircle, XCircle, FileSearch, FileText, ExternalLink, Paperclip, MapPin, Loader2, Filter, Calendar, X, AlertTriangle, MessageSquare
} from 'lucide-react';

const DashboardFiscal: React.FC = () => {
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

  // Modal de Reprovação
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('Falta de NF');
  const [rejectComment, setRejectComment] = useState('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    setRequests(data);
  };

  useEffect(() => { loadData(); }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  useEffect(() => {
    let isMounted = true;
    const fetchAtts = async () => {
      if (selectedRequest && authState.token) {
        setIsFetchingAttachments(true);
        setMainAttachments([]);
        setSecondaryAttachments([]);
        
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
          console.error("Dashboard Fiscal - Falha ao carregar anexos:", e);
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

  // Lógica de Workflow (Hierarquia)
  const isMaster = useMemo(() => {
    return authState.user?.role === UserRole.FISCAL_ADMIN || authState.user?.role === UserRole.ADMIN_MASTER;
  }, [authState.user]);

  const handleApprove = async () => {
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      // Se Comum -> Em Análise | Se Master -> Aprovado
      const targetStatus = isMaster ? RequestStatus.APROVADO : RequestStatus.ANALISE;
      const comment = isMaster ? 'Aprovação Final realizada pelo Fiscal Master.' : 'Conferência inicial realizada pelo Fiscal Comum. Aguardando Master.';
      
      await requestService.changeStatus(selectedRequest.graphId, targetStatus, authState.token, comment);
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
    if (!selectedRequest || !authState.token) return;
    setIsProcessingAction(true);
    try {
      // Se Comum -> Em Análise | Se Master -> Erro - Fiscal
      const targetStatus = isMaster ? RequestStatus.ERRO_FISCAL : RequestStatus.ANALISE;
      const fullComment = `[${rejectReason}] ${rejectComment}`;
      
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

  const handleViewFile = (url: string) => { if (url) window.open(url, '_blank'); };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.id.toString().includes(searchTerm);
      
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
      
      {/* Barra de Filtros Superior */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="Buscar ID ou NF..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <Calendar size={10} className="mr-1"/> Data Criação
            </label>
            <input 
              type="date" 
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <MapPin size={10} className="mr-1"/> Filial
            </label>
            <select 
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
              <option value="">Todas</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center">
              <Filter size={10} className="mr-1"/> Status
            </label>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
            >
              <option value="">Todos</option>
              {Object.values(RequestStatus).map(s => <option key={s} value={s}>{s}</option>)}
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
              <div 
                key={r.id} 
                onClick={() => setSelectedId(r.id)} 
                className={`p-4 cursor-pointer transition-all ${selectedId === r.id ? 'bg-blue-50 border-l-8 border-blue-600 shadow-inner' : 'hover:bg-gray-50'}`}
              >
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
            {filteredRequests.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-xs font-bold uppercase italic opacity-50">Nenhum registro encontrado</div>
            )}
          </div>
        </div>

        {/* Detalhes do Registro */}
        <div className="flex-1 bg-white border rounded-[3rem] overflow-hidden flex flex-col shadow-2xl relative">
          {selectedRequest ? (
            <>
              <div className="p-10 border-b flex justify-between items-center bg-gray-50/20">
                <div className="max-w-[60%]">
                  <div className="flex items-center space-x-3 mb-2">
                    <Badge status={selectedRequest.status} />
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase">
                      {isMaster ? 'Modo Master' : 'Modo Analista'}
                    </span>
                  </div>
                  <h2 className="text-4xl font-black text-gray-900 italic uppercase leading-tight truncate">{selectedRequest.title}</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 flex items-center"><MapPin size={14} className="mr-2 text-blue-500"/> FILIAL: {selectedRequest.branch} • ID: {selectedRequest.id}</p>
                </div>
                <div className="flex space-x-3">
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
                    {isMaster ? 'Aprovar Lançamento' : 'Validar e Encaminhar'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <section className="bg-blue-50/30 p-10 rounded-[3rem] border border-blue-50 shadow-inner">
                    <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-8 border-b border-blue-100 pb-3 italic flex items-center">
                      <FileSearch size={14} className="mr-2"/> Conferência de Dados
                    </h3>
                    <div className="space-y-8">
                      <div>
                        <span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Número da Nota</span>
                        <p className="text-4xl font-black text-slate-900 leading-none">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Vencimento</span>
                            <p className="text-xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Pedido (OC)</span>
                            <p className="text-xl font-black text-slate-900 truncate">{stripHtml(selectedRequest.orderNumbers) || '---'}</p>
                         </div>
                      </div>
                      <div className="pt-4 border-t border-blue-100/50">
                        <span className="text-[10px] font-black text-blue-300 uppercase block mb-1">Favorecido</span>
                        <p className="text-lg font-bold text-slate-700 truncate">{selectedRequest.payee || '---'}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-3 italic">
                      <Paperclip size={16} className="mr-2" /> Documentos Anexados {isFetchingAttachments && <Loader2 size={14} className="ml-2 animate-spin text-blue-600" />}
                    </h3>
                    <div className="space-y-4">
                      {mainAttachments.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest ml-1">Nota Fiscal Principal</p>
                          {mainAttachments.map(att => (
                            <div key={att.id} className="p-4 bg-white border border-blue-100 rounded-2xl flex items-center shadow group hover:border-blue-500 transition-all">
                              <div className="bg-blue-600 text-white p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform"><FileText size={20}/></div>
                              <div className="flex-1 truncate"><span className="text-gray-900 font-bold text-xs block truncate">{att.fileName}</span></div>
                              <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"><ExternalLink size={16} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {secondaryAttachments.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest ml-1">Boletos e Auxiliares</p>
                          {secondaryAttachments.map(att => (
                            <div key={att.id} className="p-4 bg-white border border-indigo-100 rounded-2xl flex items-center shadow group hover:border-indigo-500 transition-all">
                              <div className="bg-indigo-600 text-white p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform"><Paperclip size={20}/></div>
                              <div className="flex-1 truncate"><span className="text-gray-900 font-bold text-xs block truncate">{att.fileName}</span></div>
                              <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-colors"><ExternalLink size={16} /></button>
                            </div>
                          ))}
                        </div>
                      )}

                      {!isFetchingAttachments && mainAttachments.length === 0 && secondaryAttachments.length === 0 && (
                        <div className="p-12 border-2 border-dashed border-gray-100 rounded-[2rem] text-center text-gray-300 font-bold italic text-sm">Nenhum documento anexado.</div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Observações Solicitante */}
                {selectedRequest.generalObservation && (
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                    <span className="text-[9px] font-black text-gray-400 uppercase block mb-2 italic flex items-center"><MessageSquare size={12} className="mr-2"/> Observação do Solicitante</span>
                    <p className="text-sm font-medium text-slate-600 italic">"{selectedRequest.generalObservation}"</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center p-20">
              <FileSearch size={100} className="opacity-10 mb-6" />
              <h3 className="text-2xl font-black text-gray-900 uppercase italic">Análise Fiscal</h3>
              <p className="text-sm font-bold text-gray-400 mt-4 max-w-xs">Selecione um registro na lateral para iniciar a conferência documental e financeira.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Reprovação */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRejectModalOpen(false)}></div>
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in duration-200 border border-gray-100">
            <div className="bg-red-600 p-6 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle size={24} />
                <h3 className="text-lg font-black uppercase italic leading-none tracking-tight">Reprovar Solicitação</h3>
              </div>
              <button onClick={() => setIsRejectModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Motivo Principal</label>
                <select 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="Falta de NF">Falta de NF</option>
                  <option value="Pedido Errado">Pedido Errado</option>
                  <option value="Dados Divergentes">Dados Divergentes</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 ml-1">Comentários Adicionais</label>
                <textarea 
                  value={rejectComment}
                  onChange={e => setRejectComment(e.target.value)}
                  className="w-full h-32 p-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  placeholder="Explique detalhadamente o motivo da reprovação para o solicitante..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsRejectModalOpen(false)}
                  className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Voltar
                </button>
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

      {/* Overlay de Processamento Global (Aprovação Direta) */}
      {isProcessingAction && !isRejectModalOpen && (
        <div className="fixed inset-0 z-[110] bg-white/20 backdrop-blur-[2px] flex items-center justify-center cursor-wait">
          <div className="bg-white p-6 rounded-3xl shadow-2xl border border-gray-100 flex items-center space-x-4">
            <Loader2 className="animate-spin text-blue-600" size={32} />
            <span className="text-xs font-black uppercase tracking-widest text-gray-600 italic">Atualizando Fluxo...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFiscal;
