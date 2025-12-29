
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { db } from '../services/db';
import Badge from '../components/Badge';
import { isHighPriority, BRANCHES } from '../constants';
import { 
  DollarSign, Share2, Search, Banknote, FileText, ExternalLink, Paperclip, XCircle, CheckCircle, AlertTriangle, Calendar, MapPin, Filter, MessageSquare, BarChart3, Users, X, Hash
} from 'lucide-react';

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isSharingControlOpen, setIsSharingControlOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  
  const [shareUserId, setShareUserId] = useState('');
  const [shareComment, setShareComment] = useState('');
  
  const [rejectReason, setRejectReason] = useState('');
  const [errorType, setErrorType] = useState('Nota fiscal não localizada para faturamento');

  const [financeUsers, setFinanceUsers] = useState<User[]>([]);

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    const financeOnly = data.filter(r => ![RequestStatus.PENDENTE, RequestStatus.ANALISE, RequestStatus.ANALISE_FISCAL].includes(r.status));
    setRequests(financeOnly);
    
    const allUsers = db.getUsers();
    setFinanceUsers(allUsers.filter(u => u.role === UserRole.FINANCEIRO || u.role === UserRole.FINANCEIRO_MASTER));
  };

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 10000);
    return () => clearInterval(t);
  }, [authState.user, authState.token]);

  const sharingStats = useMemo(() => {
    const allUsers = db.getUsers();
    const norteRequests = requests.filter(r => r.sharedWithUserId && allUsers.find(u => u.id === r.sharedWithUserId)?.email?.includes('norte'));
    const sulRequests = requests.filter(r => r.sharedWithUserId && allUsers.find(u => u.id === r.sharedWithUserId)?.email?.includes('sul'));

    return { norteRequests, sulRequests };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter(r => {
        const matchesSearch = 
          r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.id.toString().includes(searchTerm) ||
          r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesBranch = branchFilter === '' || r.branch === branchFilter;

        const reqDate = new Date(r.createdAt);
        reqDate.setHours(0, 0, 0, 0);
        let matchesDate = true;
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (reqDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (reqDate > end) matchesDate = false;
        }

        return matchesSearch && matchesBranch && matchesDate;
      })
      .sort((a, b) => {
        const priorityA = isHighPriority(a.paymentDate) ? 1 : 0;
        const priorityB = isHighPriority(b.paymentDate) ? 1 : 0;
        
        // Regra de Ordenação:
        // 1. Urgência (< 3 dias para vencer) sempre no topo
        if (priorityA !== priorityB) {
          return priorityB - priorityA;
        }
        
        // 2. Data de criação (mais recentes primeiro) para desempate
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [requests, searchTerm, branchFilter, startDate, endDate]);

  const selectedRequest = filteredRequests.find(r => r.id === selectedId);

  const handleFaturar = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    
    const nextStatus = authState.user.role === UserRole.FINANCEIRO_MASTER || authState.user.role === UserRole.ADMIN_MASTER 
      ? RequestStatus.FATURADO 
      : RequestStatus.ANALISE_FINANCEIRO;

    const comment = nextStatus === RequestStatus.FATURADO 
      ? 'Financeiro Admin liquidou e faturou o pagamento.' 
      : 'Financeiro Comum validou (Aguardando Faturamento Admin).';

    await requestService.changeStatus(selectedId, nextStatus, authState.token, comment);
    await loadData();
    setSelectedId(null);
  };

  const handleReject = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    await requestService.updateRequest(selectedId, {
      status: RequestStatus.ERRO_FINANCEIRO,
      errorType: errorType,
      errorObservation: rejectReason
    }, authState.token);
    await loadData();
    setIsRejectModalOpen(false);
    setRejectReason('');
    setSelectedId(null);
  };

  const handleShare = async () => {
    if (!selectedId || !authState.user || !shareUserId || !authState.token) return;
    await requestService.shareRequest(selectedId, shareUserId, shareComment, authState.token);
    setIsShareModalOpen(false);
    setShareUserId('');
    setShareComment('');
    await loadData();
  };

  const handleViewFile = (base64Data: string) => {
    try {
      const parts = base64Data.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) uInt8Array[i] = raw.charCodeAt(i);
      const blob = new Blob([uInt8Array], { type: contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      window.open(base64Data, '_blank');
    }
  };

  const showSharingButtons = authState.user?.role === UserRole.FINANCEIRO_MASTER || authState.user?.role === UserRole.ADMIN_MASTER;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center space-x-2">
            <Filter size={18} className="text-indigo-600" />
            <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">Filtros:</span>
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Início</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm hover:border-gray-300 transition-colors" />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fim</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm hover:border-gray-300 transition-colors" />
          </div>
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Filial</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500 w-44 bg-white appearance-none cursor-pointer shadow-sm">
                <option value="">Todas as Filiais</option>
                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          {(startDate || endDate || branchFilter || searchTerm) && (
            <button onClick={() => { setStartDate(''); setEndDate(''); setBranchFilter(''); setSearchTerm(''); }} className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest">Limpar Filtros</button>
          )}
        </div>

        {showSharingButtons && (
          <button 
            onClick={() => setIsSharingControlOpen(true)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
          >
            <BarChart3 size={16} />
            <span>Gerenciar compartilhamentos</span>
          </button>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Pesquisar por ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {filteredRequests.length > 0 ? filteredRequests.map(r => {
              const highPri = isHighPriority(r.paymentDate);
              return (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-indigo-50 border-r-4 border-indigo-500' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold text-gray-400">#{r.id}</span>
                      {highPri && (
                        <div className="flex items-center space-x-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded animate-pulse border border-red-200 shadow-sm">
                          <AlertTriangle size={10} strokeWidth={3} />
                          <span className="text-[8px] font-black uppercase tracking-tighter">Urgente</span>
                        </div>
                      )}
                    </div>
                    <Badge status={r.status} request={r} currentUser={authState.user} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm truncate">{r.title}</h4>
                  <div className="flex justify-between mt-3 items-center">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{new Date(r.paymentDate).toLocaleDateString()}</span>
                    <span className="text-sm font-black text-indigo-700">R$ {r.budgetValue?.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              );
            }) : (
              <div className="p-10 text-center text-gray-400 italic text-sm">Nenhuma solicitação encontrada nos filtros.</div>
            )}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {selectedRequest ? (
            <>
              <div className="p-8 border-b flex justify-between items-center bg-indigo-50/10">
                <div className="flex items-center space-x-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-100"><Banknote size={28} /></div>
                  <div><h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2><p className="text-xs font-bold text-indigo-600">Fluxo Financeiro SISPAG • ID SharePoint: #{selectedRequest.id}</p></div>
                </div>
                <div className="flex space-x-2">
                  {showSharingButtons && (
                    <button onClick={() => setIsShareModalOpen(true)} className="p-2.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Compartilhar"><Share2 size={20} /></button>
                  )}
                  <button onClick={() => setIsRejectModalOpen(true)} className="px-6 py-3 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-50 rounded-xl transition-all flex items-center">
                    <XCircle size={18} className="mr-2" /> Reprovar
                  </button>
                  <button onClick={handleFaturar} className="px-8 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 transition-all text-[10px] uppercase tracking-widest shadow-xl shadow-green-100 flex items-center">
                    <CheckCircle size={18} className="mr-2" /> {authState.user?.role === UserRole.FINANCEIRO_MASTER ? 'Faturar' : 'Aprovar'}
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                {isHighPriority(selectedRequest.paymentDate) && (
                  <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center space-x-4 animate-in slide-in-from-top-2 duration-300">
                    <div className="bg-red-600 text-white p-2 rounded-xl shadow-md"><AlertTriangle size={20} /></div>
                    <div>
                      <h4 className="text-[10px] font-black text-red-700 uppercase tracking-widest">Ação Prioritária Necessária</h4>
                      <p className="text-xs font-bold text-red-900">Esta solicitação vence em menos de 3 dias.</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                      <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Dados de Recebimento</h3>
                      <div className="space-y-3">
                        <p className="text-sm font-bold text-gray-500 uppercase">Favorecido: <span className="text-gray-900 ml-1">{selectedRequest.payee || '---'}</span></p>
                        <p className="text-sm font-bold text-gray-500 uppercase">Banco: <span className="text-gray-900 ml-1">{selectedRequest.bank || '---'}</span></p>
                        <p className="text-sm font-bold text-gray-500 uppercase">Método: <span className="text-gray-900 ml-1">{selectedRequest.paymentMethod || '---'}</span></p>
                        {selectedRequest.pixKey && <p className="text-[10px] font-mono bg-white p-2 rounded border text-blue-700 mt-2 truncate">PIX: {selectedRequest.pixKey}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Paperclip size={14} className="mr-2" /> Anexos</h4>
                    <div className="space-y-2">
                      {selectedRequest.attachments?.map(att => (
                        <div key={att.id} className="p-3 bg-white border border-gray-200 rounded-2xl flex items-center shadow-sm hover:border-indigo-300 transition-all">
                          <div className="bg-blue-50 p-2 rounded-xl text-blue-600 mr-3"><FileText size={16}/></div>
                          <div className="flex-1 truncate text-xs font-bold text-gray-700">{att.fileName}</div>
                          <button onClick={() => handleViewFile(att.storageUrl)} className="ml-2 text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center hover:bg-indigo-50 p-2 rounded-lg transition-colors"><ExternalLink size={12} className="mr-1" /> Abrir</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex items-start space-x-4">
                   <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Hash size={24} /></div>
                   <div className="flex-1">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Pedido / Nota Fiscal</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Nota Fiscal</span>
                          <p className="text-xl font-black text-gray-900 break-words">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-2xl">
                          <span className="text-[9px] font-black text-gray-400 uppercase">Pedidos</span>
                          <p className="text-xl font-black text-gray-900 break-words leading-tight">{stripHtml(selectedRequest.orderNumbers) || '---'}</p>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><DollarSign size={64} className="opacity-10" /><p className="font-bold">Selecione uma fatura para processamento</p></div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-4 mb-8">
              <div className="bg-red-50 p-3 rounded-2xl text-red-600"><AlertTriangle size={32} /></div>
              <h3 className="text-3xl font-black uppercase text-red-600 tracking-tight">Reprovar Financeiro</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Motivo da Reprovação</label>
                <select value={errorType} onChange={e => setErrorType(e.target.value)} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold text-gray-700 shadow-inner appearance-none">
                  <option value="Nota fiscal não localizada para faturamento">Nota fiscal não localizada para faturamento</option>
                  <option value="Sem método de pagamento">Sem método de pagamento</option>
                  <option value="Dados Bancários Inválidos">Dados Bancários Inválidos</option>
                  <option value="Erro de Lançamento SharePoint">Erro de Lançamento SharePoint</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Explique o motivo para o solicitante..." className="w-full p-6 bg-gray-50 rounded-3xl outline-none font-medium border-0 shadow-inner resize-none placeholder:text-gray-300" />
              </div>
            </div>
            <div className="flex space-x-4 pt-8">
              <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 font-black text-gray-500 uppercase text-xs">Cancelar</button>
              <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl shadow-red-100">Confirmar Reprovação</button>
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-8 text-indigo-600 uppercase tracking-tight">Compartilhar solicitação</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Analista Responsável</label>
                <select value={shareUserId} onChange={e => setShareUserId(e.target.value)} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold text-gray-700 mb-2">
                  <option value="">Selecione o analista...</option>
                  {financeUsers.map(u => (<option key={u.id} value={u.id}>{u.email}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center"><MessageSquare size={12} className="mr-1"/> Comentário Interno</label>
                <textarea rows={3} value={shareComment} onChange={e => setShareComment(e.target.value)} placeholder="Instruções para o analista..." className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-medium resize-none shadow-inner" />
              </div>
            </div>
            <div className="flex space-x-4 pt-8">
              <button onClick={() => setIsShareModalOpen(false)} className="flex-1 py-4 font-black text-gray-500 uppercase text-xs">Voltar</button>
              <button onClick={handleShare} disabled={!shareUserId} className="flex-1 py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl shadow-indigo-100">Compartilhar</button>
            </div>
          </div>
        </div>
      )}

      {isSharingControlOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <header className="p-8 border-b flex justify-between items-center bg-indigo-900 text-white">
              <div className="flex items-center space-x-4">
                <div className="bg-white/10 p-3 rounded-2xl"><Users size={28} /></div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Gerenciamento de compartilhamentos</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Visão consolidada dos fluxos internos delegados</p>
                </div>
              </div>
              <button onClick={() => setIsSharingControlOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors"><X size={24} /></button>
            </header>
            
            <div className="flex-1 overflow-hidden flex divide-x divide-gray-100">
              <div className="flex-1 flex flex-col p-8 space-y-6 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-gray-900 uppercase tracking-tighter flex items-center">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div> Analistas Norte
                  </h4>
                  <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">{sharingStats.norteRequests.length} solicitações</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {sharingStats.norteRequests.length > 0 ? sharingStats.norteRequests.map(r => (
                    <div key={r.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold text-gray-400">#{r.id}</span>
                        <Badge status={r.status} request={r} currentUser={authState.user} />
                      </div>
                      <p className="font-bold text-sm text-gray-900 mb-2">{r.title}</p>
                      {r.shareComment && (
                        <div className="bg-white p-2 rounded-lg border border-gray-100 text-[10px] text-gray-500 italic">
                          " {r.shareComment} "
                        </div>
                      )}
                    </div>
                  )) : <div className="text-center py-20 text-gray-300 italic text-sm">Nenhum compartilhamento ativo.</div>}
                </div>
              </div>

              <div className="flex-1 flex flex-col p-8 space-y-6 overflow-hidden">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-gray-900 uppercase tracking-tighter flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div> Analistas Sul
                  </h4>
                  <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">{sharingStats.sulRequests.length} solicitações</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {sharingStats.sulRequests.length > 0 ? sharingStats.sulRequests.map(r => (
                    <div key={r.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-green-200 transition-colors shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-mono font-bold text-gray-400">#{r.id}</span>
                        <Badge status={r.status} request={r} currentUser={authState.user} />
                      </div>
                      <p className="font-bold text-sm text-gray-900 mb-2">{r.title}</p>
                      {r.shareComment && (
                        <div className="bg-white p-2 rounded-lg border border-gray-100 text-[10px] text-gray-500 italic">
                          " {r.shareComment} "
                        </div>
                      )}
                    </div>
                  )) : <div className="text-center py-20 text-gray-300 italic text-sm">Nenhum compartilhamento ativo.</div>}
                </div>
              </div>
            </div>
            
            <footer className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={() => setIsSharingControlOpen(false)} className="px-8 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-gray-100">Fechar Controle</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
