
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, Attachment } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, Clock, Loader2, CreditCard, Landmark, Send, Paperclip, FileText, Banknote, X, AlertCircle, CheckCircle2, ExternalLink, ChevronLeft, Calendar, Info, Smartphone, Filter
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [mainAttachments, setMainAttachments] = useState<Attachment[]>([]);
  const [secondaryAttachments, setSecondaryAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAttachments, setIsFetchingAttachments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filtros de Lista
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados do Formulário Refinados (Filial removida para automação via Graph)
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

  const syncData = async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const allAvailable = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(allAvailable.filter(r => r.createdByUserId === authState.user?.id));
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { syncData(); }, [authState.user, authState.token]);

  useEffect(() => {
    let isMounted = true;
    const fetchAllAttachments = async () => {
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
          console.error("Erro crítico ao carregar anexos:", e);
        } finally {
          if (isMounted) setIsFetchingAttachments(false);
        }
      } else {
        setMainAttachments([]);
        setSecondaryAttachments([]);
      }
    };
    
    if (selectedId) fetchAllAttachments();
    return () => { isMounted = false; };
  }, [selectedId, authState.token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.token || !authState.user) return;
    
    setIsSubmitting(true);
    try {
      const newRequest: Partial<PaymentRequest> = {
        ...formData,
        status: RequestStatus.PROCESSANDO,
        createdByUserId: authState.user.id,
        createdByName: authState.user.name
      };
      
      const result = await requestService.createRequest(newRequest, authState.token);
      if (result) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await syncData();
        setIsCreating(false);
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
      }
    } catch (e) {
      console.error("Erro ao criar solicitação:", e);
      alert("Falha ao criar solicitação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           r.id.toString().includes(searchTerm);
      
      const matchesStatus = statusFilter === '' || r.status === statusFilter;
      
      const requestDate = new Date(r.createdAt).getTime();
      const matchesStartDate = startDate === '' || requestDate >= new Date(startDate).getTime();
      const matchesEndDate = endDate === '' || requestDate <= new Date(endDate).setHours(23, 59, 59, 999);

      return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, statusFilter, startDate, endDate]);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden rounded-2xl border border-gray-200 relative">
      {/* Overlay de Submissão / Processamento */}
      {isSubmitting && (
        <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-10 text-center">
          <div className="bg-white/10 p-8 rounded-[3rem] border border-white/10 shadow-2xl flex flex-col items-center max-w-sm">
            <Loader2 className="animate-spin text-blue-400 mb-6" size={60} />
            <h2 className="text-2xl font-black text-white uppercase italic mb-4">Processando Requisição</h2>
            <p className="text-blue-300 font-bold text-sm uppercase leading-relaxed tracking-widest">
              Isso pode levar aproximadamente 1 minuto enquanto o fluxo automatizado valida os dados.
            </p>
          </div>
        </div>
      )}

      {/* Sidebar de Listagem com Filtros Avançados */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100 bg-white z-10 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-black text-gray-800 uppercase italic">Minhas Notas</h1>
            <button 
              onClick={() => { setIsCreating(true); setSelectedId(null); }} 
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

          <div className="grid grid-cols-1 gap-3 pt-2">
            <div>
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 ml-1">Filtrar por Status</label>
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
            
            <div className="grid grid-cols-2 gap-2">
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
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {isLoading && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>}
          {!isLoading && filteredRequests.map(req => (
            <button 
              key={req.id} 
              onClick={() => { setSelectedId(req.id); setIsCreating(false); }} 
              className={`w-full p-5 rounded-[2rem] transition-all text-left border-2 ${selectedId === req.id ? 'bg-blue-50 border-blue-600 shadow-lg scale-[1.02]' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-3 py-1 rounded-lg">#{req.id}</span>
                <Badge status={req.status} />
              </div>
              <h3 className="font-black text-gray-900 text-sm mb-2 leading-tight uppercase truncate">{req.title}</h3>
              <div className="flex items-center text-[9px] font-black text-gray-400 uppercase tracking-widest space-x-4">
                <span className="flex items-center"><Clock size={12} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                <span className="text-blue-500 italic truncate max-w-[100px]">{req.branch}</span>
              </div>
            </button>
          ))}
          {!isLoading && filteredRequests.length === 0 && (
            <div className="text-center py-20 text-gray-400 font-bold italic">Nenhum resultado para os filtros.</div>
          )}
        </div>
      </div>

      {/* Área Principal de Conteúdo */}
      <div className="flex-1 flex flex-col bg-gray-50 relative overflow-hidden">
        
        {/* Caso: Criando Nova Solicitação com Estilização Gradiente Profissional */}
        {isCreating ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
            <header className="p-10 border-b border-white/5 flex justify-between items-center bg-white/5 backdrop-blur-sm">
              <div className="flex items-center space-x-6">
                <button onClick={() => setIsCreating(false)} className="p-3 bg-white/10 text-white border border-white/10 rounded-xl hover:bg-white/20 transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-4xl font-black text-white uppercase italic leading-none tracking-tighter">Nova Solicitação</h2>
              </div>
              <div className="flex items-center space-x-2 text-blue-400 font-black text-[10px] uppercase tracking-widest">
                <Info size={14} />
                <span>Preenchimento Obrigatório</span>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-12 custom-scrollbar">
              <div className="max-w-4xl mx-auto space-y-12 pb-20">
                
                {/* Seção 1: Identificação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="col-span-2">
                    <label className="text-xs font-black text-blue-400 uppercase tracking-widest mb-3 block italic">Título / Descrição Curta</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Pagamento de Frete - NF 123..."
                      className="w-full p-6 bg-white/10 border-2 border-transparent rounded-[1.5rem] focus:border-blue-400 focus:bg-white/20 outline-none text-xl font-bold transition-all text-white placeholder:text-blue-300/30"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  
                  {/* Reorganização NF e Pedido lado a lado */}
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-3 block">Número da NF / Documento</label>
                    <input 
                      required
                      type="text" 
                      placeholder="000.000.000"
                      className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white placeholder:text-white/20"
                      value={formData.invoiceNumber}
                      onChange={e => setFormData({...formData, invoiceNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase tracking-widest mb-3 block">Número de Pedido (OC)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: 4567, 8910..."
                      className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white placeholder:text-white/20"
                      value={formData.orderNumbers}
                      onChange={e => setFormData({...formData, orderNumbers: e.target.value})}
                    />
                  </div>
                </div>

                {/* Seção 2: Detalhes de Pagamento Dinâmicos */}
                <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-8 shadow-2xl">
                  <div className="col-span-2 flex items-center mb-2">
                    <CreditCard className="text-blue-400 mr-3" size={24} />
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tight">Dados Financeiros</h3>
                  </div>
                  
                  <div>
                    <label className="text-xs font-black text-white/50 uppercase mb-3 block">Método de Pagamento</label>
                    <select 
                      className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold uppercase text-white appearance-none"
                      value={formData.paymentMethod}
                      onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                    >
                      {PAYMENT_METHODS.map(m => <option key={m} value={m} className="text-slate-900">{m}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-black text-white/50 uppercase mb-3 block">Data de Vencimento</label>
                    <input 
                      required
                      type="date" 
                      className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold uppercase text-white"
                      value={formData.paymentDate}
                      onChange={e => setFormData({...formData, paymentDate: e.target.value})}
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-xs font-black text-white/50 uppercase mb-3 block">Favorecido (Pessoa/Empresa)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Nome completo ou Razão Social"
                      className="w-full p-5 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold uppercase text-white placeholder:text-white/20"
                      value={formData.payee}
                      onChange={e => setFormData({...formData, payee: e.target.value})}
                    />
                  </div>

                  {/* Campos Condicionais: PIX e A Vista seguem a mesma regra */}
                  {(formData.paymentMethod === 'PIX' || formData.paymentMethod === 'A Vista') && (
                    <div className="col-span-2 animate-in fade-in slide-in-from-top-4 duration-300">
                      <label className="text-xs font-black text-blue-400 uppercase mb-3 block flex items-center">
                        <Smartphone size={14} className="mr-2" /> Chave PIX / Referência
                      </label>
                      <input 
                        required
                        type="text" 
                        placeholder="E-mail, CPF, CNPJ ou Chave Aleatória"
                        className="w-full p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white placeholder:text-blue-300/30"
                        value={formData.pixKey}
                        onChange={e => setFormData({...formData, pixKey: e.target.value})}
                      />
                    </div>
                  )}

                  {formData.paymentMethod === 'TED/DEPOSITO' && (
                    <div className="col-span-2 grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                      <div className="col-span-2">
                        <label className="text-xs font-black text-blue-400 uppercase mb-3 block">Banco</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ex: Itaú, Bradesco..."
                          className="w-full p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white placeholder:text-blue-300/30"
                          value={formData.bank}
                          onChange={e => setFormData({...formData, bank: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-blue-400 uppercase mb-3 block">Agência</label>
                        <input 
                          required
                          type="text" 
                          placeholder="0000"
                          className="w-full p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white"
                          value={formData.agency}
                          onChange={e => setFormData({...formData, agency: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-blue-400 uppercase mb-3 block">Conta</label>
                        <input 
                          required
                          type="text" 
                          placeholder="00000-0"
                          className="w-full p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl outline-none focus:ring-2 focus:ring-blue-400 font-bold text-white"
                          value={formData.account}
                          onChange={e => setFormData({...formData, account: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Seção 3: Upload de Arquivos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 border-dashed relative group hover:bg-white/10 transition-all">
                      <label className="absolute inset-0 cursor-pointer"></label>
                      <div className="flex flex-col items-center text-center">
                         <div className="bg-blue-600 p-4 rounded-2xl text-white mb-4"><FileText size={24} /></div>
                         <p className="text-sm font-black text-white uppercase italic">Nota Fiscal (PDF/JPG)</p>
                         <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-widest">Clique ou arraste o arquivo</p>
                         <input type="file" className="hidden" accept=".pdf,image/*" />
                      </div>
                   </div>
                   <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 border-dashed relative group hover:bg-white/10 transition-all">
                      <label className="absolute inset-0 cursor-pointer"></label>
                      <div className="flex flex-col items-center text-center">
                         <div className="bg-indigo-600 p-4 rounded-2xl text-white mb-4"><Paperclip size={24} /></div>
                         <p className="text-sm font-black text-white uppercase italic">Boleto / Comprovante</p>
                         <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-widest">Apenas se houver anexo</p>
                         <input type="file" className="hidden" accept=".pdf,image/*" />
                      </div>
                   </div>
                </div>

                {/* Seção 4: Observações */}
                <div>
                  <label className="text-xs font-black text-white/50 uppercase mb-3 block italic">Observações Internas</label>
                  <textarea 
                    rows={4}
                    className="w-full p-6 bg-white/5 border-0 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-blue-400 font-medium italic text-white placeholder:text-white/20"
                    placeholder="Informações adicionais para o faturamento..."
                    value={formData.generalObservation}
                    onChange={e => setFormData({...formData, generalObservation: e.target.value})}
                  />
                </div>

                {/* Rodapé de Ações */}
                <div className="flex items-center justify-end space-x-6 pt-10 border-t border-white/5">
                  <button 
                    type="button" 
                    onClick={() => setIsCreating(false)}
                    className="px-8 py-5 text-white/40 font-black text-xs uppercase hover:text-white transition-colors tracking-widest"
                  >
                    Descartar
                  </button>
                  <button 
                    disabled={isSubmitting}
                    className="px-16 py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase italic shadow-2xl hover:bg-blue-700 transition-all flex items-center shadow-blue-900/40 active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin mr-3" /> : <Send className="mr-3" />}
                    Submeter p/ Fluxo
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : selectedRequest ? (
          /* Visualização de Solicitação Existente - Mantida Intacta */
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
            <header className="p-12 bg-white border-b flex justify-between items-end shadow-sm">
              <div>
                <div className="flex items-center space-x-6 mb-6">
                  <span className="text-lg font-black text-gray-400 bg-gray-50 px-6 py-2 rounded-xl border">ID: {selectedRequest.id}</span>
                  <Badge status={selectedRequest.status} className="scale-125 ml-4" />
                </div>
                <h2 className="text-6xl font-black text-slate-900 uppercase italic tracking-tighter leading-none truncate max-w-[800px]">{selectedRequest.title}</h2>
              </div>
            </header>
            
            <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-600 uppercase mb-8 border-b pb-4 flex items-center italic"><Banknote size={20} className="mr-3"/> Dados Fiscais</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Número da Nota Fiscal</span>
                      <p className="text-5xl font-black text-slate-900 leading-none">{selectedRequest.invoiceNumber || '---'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Vencimento</span><p className="text-3xl font-black text-slate-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                      <div><span className="text-xs font-black text-gray-400 uppercase block mb-2">Pedidos</span><p className="text-3xl font-black text-slate-900">{selectedRequest.orderNumbers || '---'}</p></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-xl">
                  <p className="text-sm font-black text-blue-600 uppercase mb-8 border-b pb-4 flex items-center italic"><CreditCard size={20} className="mr-3"/> Pagamento</p>
                  <div className="space-y-10">
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Modalidade</span>
                      <p className="text-4xl font-black text-indigo-700 uppercase italic">{selectedRequest.paymentMethod}</p>
                    </div>
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">Favorecido</span>
                      <p className="text-2xl font-bold text-slate-800 break-words leading-tight uppercase">{selectedRequest.payee || '---'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção de Anexos - Lógica Mantida conforme restrição */}
              <div className="bg-white p-12 rounded-[3.5rem] border-2 border-gray-100 shadow-2xl relative">
                <div className="flex items-center justify-between mb-10 border-b pb-6">
                  <h3 className="text-2xl font-black text-slate-900 uppercase italic flex items-center"><FileText size={28} className="mr-4 text-blue-600"/> Documentação e Anexos</h3>
                  {isFetchingAttachments && <div className="flex items-center text-blue-600 font-bold uppercase text-xs animate-pulse"><Loader2 className="animate-spin mr-2" /> Sincronizando arquivos...</div>}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-12">
                     <div>
                       <p className="text-xs font-black text-blue-600 uppercase tracking-widest mb-4 italic">Nota Fiscal Principal:</p>
                       {mainAttachments.map(att => (
                         <div key={att.id} className="p-6 bg-blue-50/40 border border-blue-100 rounded-[2rem] flex items-center justify-between mb-3 group">
                           <div className="flex items-center space-x-6">
                             <div className="bg-blue-600 text-white p-4 rounded-2xl"><FileText size={24} /></div>
                             <span className="text-lg font-black text-slate-800 max-w-[200px] truncate">{att.fileName}</span>
                           </div>
                           <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase active:scale-95"><ExternalLink size={16} /></button>
                         </div>
                       ))}
                       {mainAttachments.length === 0 && !isFetchingAttachments && <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 italic">Nenhuma NF anexada diretamente no SharePoint.</div>}
                     </div>
                     <div>
                       <p className="text-xs font-black text-indigo-500 uppercase tracking-widest mb-4 italic">Boletos e Comprovantes:</p>
                       {secondaryAttachments.map(att => (
                         <div key={att.id} className="p-6 bg-indigo-50/40 border border-indigo-100 rounded-[2rem] flex items-center justify-between mb-3">
                           <div className="flex items-center space-x-6">
                             <div className="bg-indigo-600 text-white p-4 rounded-2xl"><Paperclip size={24} /></div>
                             <span className="text-lg font-black text-slate-800 max-w-[200px] truncate">{att.fileName}</span>
                           </div>
                           <button onClick={() => window.open(att.storageUrl, '_blank')} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase active:scale-95"><ExternalLink size={16} /></button>
                         </div>
                       ))}
                       {secondaryAttachments.length === 0 && !isFetchingAttachments && <div className="p-10 border-2 border-dashed border-gray-200 rounded-3xl text-center text-gray-400 italic font-medium">Sem boletos vinculados na lista secundária.</div>}
                     </div>
                   </div>
                   <div className="bg-gray-50/50 p-10 rounded-[3rem] border border-gray-100">
                      <span className="text-xs font-black text-gray-400 uppercase block mb-4 italic">Observações Internas</span>
                      <p className="text-2xl font-medium text-slate-600 leading-relaxed italic">"{selectedRequest.generalObservation || 'Sem observações.'}"</p>
                   </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Estado Vazio - Painel Inicial */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-40">
            <div className="w-40 h-40 bg-blue-50 rounded-full flex items-center justify-center mb-8">
              <Banknote size={80} className="text-blue-600" />
            </div>
            <h3 className="text-3xl font-black uppercase italic tracking-widest text-slate-800 mb-4">Painel de Notas</h3>
            <p className="text-gray-400 font-bold uppercase text-xs tracking-[0.3em] mb-10 max-w-xs leading-loose">Selecione uma solicitação ao lado para ver os detalhes ou crie uma nova nota agora mesmo.</p>
            <button 
              onClick={() => setIsCreating(true)}
              className="px-12 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase italic tracking-widest flex items-center shadow-2xl hover:bg-blue-700 transition-all active:scale-95"
            >
              <Plus size={24} className="mr-3" /> Abrir Chamado
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
