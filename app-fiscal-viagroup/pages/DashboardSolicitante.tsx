import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, Clock, Loader2, CreditCard, Landmark, Send, Paperclip, FileText, Banknote, X, AlertCircle, CheckCircle2, ExternalLink, ChevronLeft, Calendar, Info, Smartphone, Filter, Trash2, Edit3, MessageSquare, PanelLeftClose, PanelLeft, AlertTriangle
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState('');
  
  // Filtros de Lista
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados para Upload de Arquivos
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [ticketFile, setTicketFile] = useState<File | null>(null);

  // Estados do Formulário
  const [formData, setFormData] = useState({
    title: '',
    invoiceNumber: '',
    orderNumbers: '',
    paymentMethod: PAYMENT_METHODS[0],
    paymentDate: '',
    payee: '',
    pixKey: '',
    bank: '',
    agency: '',
    account: '',
    accountType: 'Corrente',
    generalObservation: ''
  });

  const selectedRequest = requests.find(r => r.id === selectedId);

  const canEdit = useMemo(() => {
    if (!selectedRequest) return false;
    const status = selectedRequest.status;
    return status === RequestStatus.ERRO_FISCAL || status === RequestStatus.ERRO_FINANCEIRO;
  }, [selectedRequest]);

  // Função de sincronização com suporte a atualização silenciosa
  const syncData = async (silent = false) => {
    if (!authState.user || !authState.token) return;
    if (!silent) setIsLoading(true);
    try {
      const allAvailable = await requestService.getRequestsFiltered(authState.user, authState.token);
      // Filtra apenas solicitações criadas pelo próprio usuário logado
      setRequests(allAvailable.filter(r => r.createdByUserId === authState.user?.id || r.createdByName === authState.user?.name));
    } catch (e) { 
      console.error(e); 
    } finally { 
      if (!silent) setIsLoading(false); 
    }
  };

  useEffect(() => { syncData(false); }, [authState.user, authState.token]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncData(true);
    }, 30000); // Polling a cada 30 segundos
    return () => clearInterval(interval);
  }, [authState.user, authState.token]);

  const fetchAllAttachments = async () => {
    if (selectedId && authState.token) {
      setIsFetchingAttachments(true);
      try {
        const [main, secondary] = await Promise.all([
          sharepointService.getItemAttachments(authState.token, selectedId),
          sharepointService.getSecondaryAttachments(authState.token, selectedId)
        ]);
        setMainAttachments(main || []);
        setSecondaryAttachments(secondary || []);
      } catch (e) {
        console.error(e);
      } finally {
        setIsFetchingAttachments(false);
      }
    } else {
      setMainAttachments([]);
      setSecondaryAttachments([]);
    }
  };

  useEffect(() => {
    fetchAllAttachments();
  }, [selectedId, authState.token]);

  const handleStartEdit = () => {
    if (!selectedRequest) return;
    setFormData({
      title: selectedRequest.title,
      invoiceNumber: selectedRequest.invoiceNumber,
      orderNumbers: selectedRequest.orderNumbers,
      paymentMethod: selectedRequest.paymentMethod || PAYMENT_METHODS[0],
      paymentDate: selectedRequest.paymentDate ? selectedRequest.paymentDate.split('T')[0] : '',
      payee: selectedRequest.payee || '',
      pixKey: selectedRequest.pixKey || '',
      bank: selectedRequest.bank || '',
      agency: selectedRequest.agency || '',
      account: selectedRequest.account || '',
      accountType: selectedRequest.accountType || 'Corrente',
      generalObservation: selectedRequest.generalObservation || ''
    });
    setInvoiceFile(null);
    setTicketFile(null);
    setIsEditing(true);
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    setIsEditing(false);
    setFormData({
      title: '',
      invoiceNumber: '',
      orderNumbers: '',
      paymentMethod: PAYMENT_METHODS[0],
      paymentDate: '',
      payee: '',
      pixKey: '',
      bank: '',
      agency: '',
      account: '',
      accountType: 'Corrente',
      generalObservation: ''
    });
    setInvoiceFile(null);
    setTicketFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !authState.user) return;
    
    if (!invoiceFile && !isEditing) {
      alert("A Nota Fiscal é obrigatória para prosseguir.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && selectedRequest) {
        // Regra de transição de status pós-correção
        let targetStatus = RequestStatus.PENDENTE;
        let shouldResetShare = false;

        if (selectedRequest.status === RequestStatus.ERRO_FISCAL) {
          targetStatus = RequestStatus.PENDENTE;
          shouldResetShare = true;
        } else if (selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) {
          targetStatus = RequestStatus.APROVADO;
          shouldResetShare = true;
        }

        const updatePayload: any = {
          ...formData,
          status: targetStatus,
          approverObservation: 'Correção realizada pelo solicitante.',
          // Mantém autoria consistente na correção
          createdByUserId: authState.user.id,
          createdByName: authState.user.name,
          AuthorEmail: authState.user.email
        };

        // Resetar campos de compartilhamento se necessário
        if (shouldResetShare) {
          updatePayload.sharedWithEmail = '';
          updatePayload.sharedByName = '';
          updatePayload.statusManual = '';
          updatePayload.shareComment = '';
          updatePayload.sharedWithUserId = '';
        }

        setSubmissionStep('Atualizando dados da solicitação...');
        await sharepointService.updateRequest(authState.token, selectedRequest.graphId, updatePayload);

        if (invoiceFile) {
          setSubmissionStep('Substituindo Nota Fiscal...');
          const currentMainAtts = await sharepointService.getItemAttachments(authState.token, selectedRequest.id);
          for (const att of currentMainAtts) {
            await sharepointService.deleteAttachment('51e89570-51be-41d0-98c9-d57a5686e13b', selectedRequest.id, att.fileName);
          }
          await sharepointService.uploadAttachment('51e89570-51be-41d0-98c9-d57a5686e13b', selectedRequest.id, invoiceFile);
        }

        if (ticketFile) {
          setSubmissionStep('Substituindo Boletos auxiliares...');
          await sharepointService.deleteSecondaryItemsByRequestId(selectedRequest.id);
          await sharepointService.createSecondaryItemWithAttachment(selectedRequest.id, ticketFile);
        }

        // Atualização Otimista Local
        const updatedRequest = { ...selectedRequest, ...updatePayload };
        setRequests(prev => prev.map(r => r.id === selectedRequest.id ? updatedRequest : r));

        setSubmissionStep('Finalizando...');
        handleCancelCreate();
        alert("Solicitação corrigida com sucesso!");
      } else {
        // FLUXO DE CRIAÇÃO
        setSubmissionStep('Enviando para o SharePoint...');
        const submissionData: any = {
          ...formData,
          // ⚠️ CAMPOS OBRIGATÓRIOS PARA CORREÇÃO DE AUTORIA NO SHAREPOINT
          createdByUserId: authState.user.id,
          createdByName: authState.user.name,
          AuthorEmail: authState.user.email,
          branch: authState.user.branchDefault || 'Matriz SP', // Envia a filial do perfil do usuário
          status: RequestStatus.PROCESSANDO,
          createdAt: new Date().toISOString()
        };

        const success = await requestService.createRequest(authState.token, submissionData, { 
          invoice: invoiceFile, 
          ticket: ticketFile 
        });

        if (success) {
          const tempRequest: PaymentRequest = {
            ...submissionData,
            id: 'PROCESSANDO-' + Date.now(),
            graphId: '',
            mirrorId: 0,
            updatedAt: new Date().toISOString(),
          };
          setRequests(prev => [tempRequest, ...prev]);
          handleCancelCreate();
        } else {
          alert("Não foi possível processar a criação. Tente novamente em instantes.");
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(`Erro no processamento: ${e.message}`);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.id.toString().includes(searchTerm);
      const matchesStatus = statusFilter === '' || r.status === statusFilter;
      
      const requestDate = new Date(r.createdAt);
      requestDate.setHours(0, 0, 0, 0);
      
      let matchesStartDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        matchesStartDate = requestDate.getTime() >= start.getTime();
      }

      let matchesEndDate = true;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesEndDate = requestDate.getTime() <= end.getTime();
      }

      return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, statusFilter, startDate, endDate]);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden rounded-2xl border border-gray-200 relative">
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="absolute left-6 top-6 z-20 p-3 bg-white border border-gray-200 text-blue-600 rounded-2xl shadow-xl hover:bg-gray-50 transition-all active:scale-95"
          title="Abrir Lista"
        >
          <PanelLeft size={22} />
        </button>
      )}

      {isSubmitting && (
        <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center text-white">
          <div className="bg-white/10 p-8 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col items-center max-w-sm">
            <Loader2 className="animate-spin text-blue-400 mb-6" size={60} />
            <h2 className="text-2xl font-black uppercase italic mb-4">
              {isEditing ? 'Salvando Alterações' : 'Criando Solicitação...'}
            </h2>
            <p className="text-blue-300 font-bold text-sm uppercase leading-relaxed tracking-widest mb-4">
              {submissionStep || 'Gerenciando arquivos no SharePoint...'}
            </p>
          </div>
        </div>
      )}

      <div className={`bg-white border-r border-gray-200 flex flex-col shadow-sm transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-full lg:w-[450px]' : 'w-0'}`}>
        <div className="p-6 border-b border-gray-100 bg-white z-10 space-y-4 min-w-[300px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Esconder Lista"
              >
                <PanelLeftClose size={20} />
              </button>
              <h1 className="text-lg font-black text-gray-800 uppercase italic">Minhas Notas</h1>
            </div>
            <button 
              onClick={() => { handleCancelCreate(); setIsCreating(true); }} 
              className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 shadow-xl transition-all active:scale-95"
            >
              <Plus size={24} />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar..." 
              className="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Status</label>
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border-0 rounded-xl text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Status</option>
                <option value={RequestStatus.PROCESSANDO}>Processamento</option>
                <option value={RequestStatus.ANALISE}>Análise</option>
                <option value={RequestStatus.FATURADO}>Faturado</option>
                <option value={RequestStatus.PENDENTE}>Pendente</option>
                <option value={RequestStatus.APROVADO}>Aprovado</option>
                <option value={RequestStatus.ERRO_FISCAL}>Erro - Fiscal</option>
                <option value={RequestStatus.ERRO_FINANCEIRO}>Erro - Financeiro</option>
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">De</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-2 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Até</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="w-full p-2 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar min-w-[300px]">
          {isLoading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
          {!isLoading && filteredRequests.length === 0 && <div className="text-center py-10 text-gray-400 font-bold text-xs uppercase italic">Nenhuma nota encontrada.</div>}
          {!isLoading && filteredRequests.map(req => (
            <button 
              key={req.id} 
              onClick={() => { setSelectedId(req.id); setIsCreating(false); setIsEditing(false); }} 
              className={`w-full p-5 rounded-[2rem] transition-all text-left border-2 group relative ${selectedId === req.id ? 'bg-blue-50 border-blue-600 shadow-lg scale-[1.02]' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-lg">#{req.id.includes('PROCESSANDO') ? '...' : req.id}</span>
                <div className="flex items-center space-x-2">
                  {(req.status === RequestStatus.ERRO_FISCAL || req.status === RequestStatus.ERRO_FINANCEIRO) && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        alert(`REPROVADA\n\nMotivo: ${req.errorObservation || 'N/A'}\nComentário: ${req.approverObservation || 'N/A'}`);
                      }}
                      className="p-1.5 text-red-600 bg-red-100 rounded-full animate-pulse cursor-help"
                    >
                      <AlertTriangle size={14} />
                    </div>
                  )}
                  <Badge status={req.status} />
                </div>
              </div>
              <h3 className="font-black text-gray-900 text-sm mb-2 leading-tight uppercase truncate">{req.title}</h3>
              <div className="flex items-center text-[9px] font-black text-gray-400 uppercase tracking-widest space-x-4">
                <span className="flex items-center"><Clock size={12} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                <span className="text-blue-500 italic truncate max-w-[150px]">{req.branch}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-50 relative overflow-hidden">
        {isCreating ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <header className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-sm shrink-0">
              <div className="flex items-center space-x-6">
                <button onClick={handleCancelCreate} className="p-2.5 bg-white/10 text-white border border-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <ChevronLeft size={18} />
                </button>
                <h2 className="text-xl lg:text-2xl font-black text-white uppercase italic leading-none tracking-tighter">
                  {isEditing ? 'Corrigir Solicitação' : 'Nova Solicitação'}
                </h2>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-10 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest mb-2 block italic">Título / Descrição Curta</label>
                    <input required type="text" className="w-full p-5 bg-white/10 border-2 border-transparent rounded-[1.2rem] focus:border-blue-400 outline-none text-lg font-bold text-white" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Número da NF</label>
                    <input required type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} />
                  </div>
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-2 block">Pedido (OC)</label>
                    <input type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} />
                  </div>
                </div>

                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2 flex items-center mb-1"><CreditCard className="text-blue-400 mr-3" size={20} /><h3 className="text-lg font-black text-white uppercase italic tracking-tight">Financeiro</h3></div>
                  {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'TED' || formData.paymentMethod === 'DEPOSITO') && (
                    <div className="col-span-2">
                      <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Nome do Favorecido / Razão Social</label>
                      <input required type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Método</label>
                    <select className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold uppercase" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                      {PAYMENT_METHODS.map(m => <option key={m} value={m} className="text-slate-900">{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Vencimento</label>
                    <input required type="date" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} />
                  </div>

                  {formData.paymentMethod === 'PIX' && (
                    <div className="col-span-2">
                      <label className="text-xs font-black text-blue-400 uppercase mb-2 block tracking-widest flex items-center"><Smartphone size={14} className="mr-2"/> Chave PIX</label>
                      <input required type="text" className="w-full p-4 bg-white/10 border border-blue-400/30 rounded-xl text-white font-bold" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} />
                    </div>
                  )}

                  {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'TED' || formData.paymentMethod === 'DEPOSITO') && (
                    <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="col-span-2 md:col-span-1">
                        <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Banco</label>
                        <input required type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Agência</label>
                        <input required type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Conta</label>
                        <input required type="text" className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-black text-white/50 uppercase mb-2 block tracking-widest">Tipo</label>
                        <select className="w-full p-4 bg-white/10 border border-white/10 rounded-xl text-white font-bold uppercase" value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})}>
                          <option value="Corrente" className="text-slate-900">Corrente</option>
                          <option value="Poupança" className="text-slate-900">Poupança</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className={`p-6 rounded-[2rem] border border-dashed transition-all relative group ${invoiceFile ? 'bg-blue-600/20 border-blue-400' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                      <input id="invoice-upload" type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
                      <label htmlFor="invoice-upload" className="flex flex-col items-center text-center cursor-pointer">
                         <div className={`p-3 rounded-xl text-white mb-3 shadow-lg ${invoiceFile ? 'bg-blue-500' : 'bg-blue-600'}`}><FileText size={20} /></div>
                         <p className="text-xs font-black text-white uppercase italic truncate max-w-full px-2">{invoiceFile ? invoiceFile.name : (isEditing ? 'Substituir Nota Fiscal' : 'Nota Fiscal (Obrigatório)')}</p>
                      </label>
                   </div>
                   <div className={`p-6 rounded-[2rem] border border-dashed transition-all relative group ${ticketFile ? 'bg-indigo-600/20 border-indigo-400' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                      <input id="ticket-upload" type="file" className="hidden" accept=".pdf,image/*" onChange={(e) => setTicketFile(e.target.files?.[0] || null)} />
                      <label htmlFor="ticket-upload" className="flex flex-col items-center text-center cursor-pointer">
                         <div className={`p-3 rounded-xl text-white mb-3 shadow-lg ${ticketFile ? 'bg-indigo-500' : 'bg-indigo-600'}`}><Paperclip size={20} /></div>
                         <p className="text-xs font-black text-white uppercase italic truncate max-w-full px-2">{ticketFile ? ticketFile.name : (isEditing ? 'Substituir Boleto' : 'Boleto / Comprovante')}</p>
                      </label>
                   </div>
                </div>

                <div className="col-span-2 bg-white/5 p-6 rounded-[1.5rem] border border-white/10">
                  <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-3 block italic flex items-center"><MessageSquare size={14} className="mr-2"/> Observações / Instruções Adicionais</label>
                  <textarea 
                    className="w-full p-4 bg-white/5 border border-white/10 rounded-xl outline-none text-sm font-bold text-white h-24 resize-none focus:border-blue-400 transition-colors" 
                    value={formData.generalObservation} 
                    onChange={e => setFormData({...formData, generalObservation: e.target.value})} 
                    placeholder="Ex: Urgente, pagamento parcial, detalhes da conta..."
                  />
                </div>

                <div className="flex items-center justify-end space-x-4 pt-6 border-t border-white/5">
                  <button type="button" onClick={handleCancelCreate} className="px-6 py-4 text-white/40 font-black text-xs uppercase hover:text-white transition-colors">Cancelar</button>
                  <button disabled={isSubmitting} className="px-12 py-4 bg-blue-600 text-white rounded-[1.5rem] font-black text-xs uppercase italic shadow-2xl hover:bg-blue-700 transition-all flex items-center shadow-blue-900/40 active:scale-95 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="animate-spin mr-3" size={16} /> : <Send className="mr-3" size={16} />}
                    {isEditing ? 'Confirmar Correção' : 'Submeter p/ Fluxo'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : selectedRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
            <header className="p-6 lg:p-8 bg-white border-b flex flex-col lg:flex-row lg:justify-between lg:items-end shadow-sm gap-4 shrink-0">
              <div className="flex items-center space-x-4">
                {!isSidebarOpen && (
                  <button 
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-2.5 bg-gray-50 border border-gray-200 text-gray-400 hover:text-blue-600 rounded-xl transition-all"
                  >
                    <PanelLeft size={20} />
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border">ID: {selectedRequest.id.includes('PROCESSANDO') ? '...' : selectedRequest.id}</span>
                    <Badge status={selectedRequest.status} className="scale-90" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-tight truncate max-w-full">{selectedRequest.title}</h2>
                </div>
              </div>
              {canEdit && (
                <button 
                  onClick={handleStartEdit}
                  className="w-full lg:w-auto px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase italic flex items-center justify-center shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                  <Edit3 size={16} className="mr-2" /> Corrigir Solicitação
                </button>
              )}
            </header>
            
            <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8 custom-scrollbar">
              {(selectedRequest.status === RequestStatus.ERRO_FISCAL || selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) && (
                <div className="bg-red-50 border-2 border-red-100 p-6 lg:p-8 rounded-[2rem] lg:rounded-[2.5rem] flex flex-col lg:flex-row items-start gap-6 shadow-sm">
                  <div className="bg-red-600 p-4 rounded-2xl text-white shadow-lg shrink-0">
                    <AlertTriangle size={32} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-black text-red-700 uppercase italic mb-2 tracking-tight">Reprovada para Ajustes</h4>
                    <p className="text-sm font-bold text-red-600 uppercase mb-4 opacity-80">Motivo: {selectedRequest.errorObservation || 'Não informado'}</p>
                    <div className="bg-white/60 p-5 rounded-2xl border border-red-100">
                      <span className="text-[10px] font-black text-red-400 uppercase block mb-2 italic">Análise do Aprovador:</span>
                      <p className="text-sm font-medium text-slate-700 italic">"{selectedRequest.approverObservation || 'Sem detalhes.'}"</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-gray-100 shadow-lg">
                  <p className="text-xs font-black text-blue-600 uppercase mb-4 border-b pb-2 flex items-center italic"><Banknote size={16} className="mr-3"/> Dados Fiscais</p>
                  <div className="space-y-6">
                    <div><span className="text-[10px] font-black text-gray-400 uppercase block mb-1">NF</span><p className="text-xl lg:text-2xl font-black text-slate-900 leading-none truncate">{selectedRequest.invoiceNumber || '---'}</p></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Vencimento</span><p className="text-sm lg:text-base font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      <div><span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Filial</span><p className="text-sm lg:text-base font-black text-slate-900 uppercase truncate">{selectedRequest.branch}</p></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border border-gray-100 shadow-lg">
                  <p className="text-xs font-black text-blue-600 uppercase mb-4 border-b pb-2 flex items-center italic"><CreditCard size={16} className="mr-3"/> Pagamento</p>
                  <div className="space-y-6">
                    <div><span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Favorecido</span><p className="text-sm lg:text-base font-bold text-slate-800 leading-tight uppercase truncate">{selectedRequest.payee || '---'}</p></div>
                    <div><span className="text-[10px] font-black text-gray-400 uppercase block mb-1">Método</span><p className="text-xs lg:text-sm font-black text-blue-600 uppercase italic">{selectedRequest.paymentMethod}</p></div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border-2 border-blue-100 shadow-xl relative">
                  <div className="flex items-center justify-between mb-6 border-b border-blue-50 pb-3">
                    <h3 className="text-base lg:text-lg font-black text-blue-600 uppercase italic flex items-center"><FileText size={20} className="mr-3"/> Nota Fiscal</h3>
                    {isFetchingAttachments && <Loader2 className="animate-spin text-blue-600" size={16} />}
                  </div>
                  <div className="space-y-3">
                    {mainAttachments.length > 0 ? mainAttachments.map(att => (
                      <div key={att.id} className="p-3 bg-blue-50/40 border border-blue-100 rounded-2xl flex items-center justify-between transition-all hover:bg-blue-100/50 min-w-0">
                        <div className="flex items-center space-x-3 overflow-hidden flex-1">
                          <FileText size={16} className="text-blue-500 shrink-0" />
                          <span className="text-[11px] font-black text-slate-800 truncate">{att.fileName}</span>
                        </div>
                        <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-[9px] uppercase font-bold flex items-center shadow-md ml-2 shrink-0"><ExternalLink size={10} className="mr-1" /> Abrir</button>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-gray-300 font-bold italic border-2 border-dashed border-gray-100 rounded-3xl text-[11px] uppercase">Nenhuma NF</div>
                    )}
                  </div>
                </div>

                <div className="bg-white p-6 lg:p-8 rounded-[2rem] border-2 border-indigo-100 shadow-xl relative">
                  <div className="flex items-center justify-between mb-6 border-b border-indigo-50 pb-3">
                    <h3 className="text-base lg:text-lg font-black text-indigo-600 uppercase italic flex items-center"><Paperclip size={20} className="mr-3"/> Boletos / Auxiliares</h3>
                  </div>
                  <div className="space-y-3">
                    {secondaryAttachments.length > 0 ? secondaryAttachments.map(att => (
                      <div key={att.id} className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-2xl flex items-center justify-between transition-all hover:bg-indigo-100/50 min-w-0">
                        <div className="flex items-center space-x-3 overflow-hidden flex-1">
                          <Paperclip size={16} className="text-indigo-500 shrink-0" />
                          <span className="text-[11px] font-black text-slate-800 truncate">{att.fileName}</span>
                        </div>
                        <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-[9px] uppercase font-bold flex items-center shadow-md ml-2 shrink-0"><ExternalLink size={10} className="mr-1" /> Abrir</button>
                      </div>
                    )) : (
                      <div className="py-8 text-center text-gray-300 font-bold italic border-2 border-dashed border-gray-100 rounded-3xl text-[11px] uppercase">Nenhum Boleto</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-6 lg:p-8 rounded-[2rem] border border-gray-100 shadow-inner">
                <span className="text-[10px] font-black text-gray-400 uppercase block mb-3 italic flex items-center"><MessageSquare size={14} className="mr-2"/> Observações do Solicitante</span>
                <p className="text-sm lg:text-base font-medium text-slate-600 leading-relaxed bg-white p-6 rounded-2xl border border-gray-100">
                  {selectedRequest.generalObservation ? `"${selectedRequest.generalObservation}"` : 'Sem observações.'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 lg:p-20 opacity-40">
            <Banknote size={48} className="text-blue-600 mb-6" />
            <h3 className="text-xl font-black uppercase italic tracking-widest text-slate-800 mb-3">Fluxo de Notas</h3>
            <button onClick={() => { handleCancelCreate(); setIsCreating(true); }} className="px-8 py-3.5 bg-blue-600 text-white rounded-xl font-black uppercase italic tracking-widest flex items-center shadow-lg active:scale-95 transition-transform"><Plus size={18} className="mr-2" /> Novo Chamado</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;