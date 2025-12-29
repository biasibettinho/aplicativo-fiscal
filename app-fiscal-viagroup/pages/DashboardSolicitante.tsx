import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, ChevronRight, Clock, Loader2, Calendar, User, CreditCard, Hash, Landmark, Info, X
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const todayStr = new Date().toISOString().split('T')[0];

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();
  
  const initialFormData: Partial<PaymentRequest> = {
    title: '',
    invoiceNumber: '',
    orderNumbers: '',
    payee: '',
    paymentMethod: 'Boleto',
    paymentDate: todayStr,
    branch: 'Matriz SP',
    generalObservation: ''
  };

  const [formData, setFormData] = useState<Partial<PaymentRequest>>(initialFormData);

  // Busca as solicitações filtradas pelo serviço e reforça o filtro por ID do usuário
  const fetchRequests = useCallback(async () => {
    if (authState.user && authState.token) {
      setIsLoading(true);
      try {
        const data = await requestService.getRequestsFiltered(authState.user, authState.token);
        
        // Ajuste principal: Filtramos no front para garantir que apenas as do usuário apareçam
        const myRequests = data.filter(r => r.createdByUserId === authState.user?.id);
        
        setRequests(myRequests);
      } catch (error) {
        console.error("Erro ao carregar solicitações:", error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [authState.user, authState.token]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState.user || !authState.token) return;

    setIsLoading(true);
    try {
      const newRequest: Partial<PaymentRequest> = {
        ...formData,
        status: RequestStatus.PENDENTE,
        createdByUserId: authState.user.id, // Vincula ao usuário atual
        createdByName: authState.user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await requestService.createRequest(newRequest, authState.token);
      setIsNew(false);
      setFormData(initialFormData);
      await fetchRequests();
    } catch (error) {
      alert("Erro ao criar solicitação.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtro de pesquisa e datas aplicado sobre a lista que já é restrita ao usuário
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const matchesSearch = 
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.payee.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = (!startDate || req.paymentDate >= startDate) && 
                          (!endDate || req.paymentDate <= endDate);
      
      return matchesSearch && matchesDate;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm, startDate, endDate]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  return (
    <div className=\"flex h-full bg-gray-50 overflow-hidden\">
      {/* Sidebar de Lista */}
      <div className=\"w-96 flex flex-col border-r border-gray-200 bg-white\">
        <div className=\"p-6 space-y-4\">
          <div className=\"flex items-center justify-between\">
            <h3 className=\"text-xl font-black text-gray-900 tracking-tight\">Minhas Notas</h3>
            <button 
              onClick={() => { setIsNew(true); setSelectedId(null); }}
              className=\"p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100\"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className=\"relative\">
            <Search className=\"absolute left-3 top-1/2 -translate-y-1/2 text-gray-400\" size={16} />
            <input 
              type=\"text\" 
              placeholder=\"Pesquisar nota ou fornecedor...\" 
              className=\"w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none\"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className=\"grid grid-cols-2 gap-2\">
            <input type=\"date\" value={startDate} onChange={e => setStartDate(e.target.value)} className=\"text-[10px] p-2 bg-gray-50 rounded-lg border-0\" />
            <input type=\"date\" value={endDate} onChange={e => setEndDate(e.target.value)} className=\"text-[10px] p-2 bg-gray-50 rounded-lg border-0\" />
          </div>
        </div>

        <div className=\"flex-1 overflow-y-auto px-4 pb-6 space-y-2\">
          {isLoading && requests.length === 0 ? (
            <div className=\"flex flex-col items-center py-20 text-gray-400\">
              <Loader2 className=\"animate-spin mb-2\" />
              <span className=\"text-xs font-bold uppercase tracking-widest\">Carregando...</span>
            </div>
          ) : filteredRequests.map(req => (
            <button
              key={req.id}
              onClick={() => { setSelectedId(req.id); setIsNew(false); }}
              className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                selectedId === req.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-white hover:border-gray-200'
              }`}
            >
              <div className=\"flex justify-between items-start mb-2\">
                <Badge status={req.status} request={req} currentUser={authState.user} />
                <span className=\"text-[10px] font-bold text-gray-400\">#{req.id.slice(-4)}</span>
              </div>
              <p className=\"font-bold text-gray-900 text-sm truncate\">{req.title}</p>
              <div className=\"flex items-center mt-2 text-gray-500 space-x-3\">
                <div className=\"flex items-center text-[10px] font-bold uppercase\">
                  <Calendar size={12} className=\"mr-1\" /> {new Date(req.paymentDate).toLocaleDateString()}
                </div>
                <div className=\"flex items-center text-[10px] font-bold uppercase\">
                  <History size={12} className=\"mr-1\" /> {new Date(req.createdAt).toLocaleDateString()}
                </div>
              </div>
            </button>
          ))}
          {!isLoading && filteredRequests.length === 0 && (
            <div className=\"text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest\">
              Nenhuma solicitação encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Área de Detalhes / Formulário */}
      <div className=\"flex-1 overflow-y-auto bg-gray-50\">
        {isNew ? (
          <div className=\"max-w-3xl mx-auto py-12 px-8\">
             <div className=\"bg-white rounded-[32px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden\">
                <header className=\"bg-gray-900 p-8 text-white flex justify-between items-center\">
                  <div>
                    <h2 className=\"text-2xl font-black tracking-tight\">Nova Solicitação</h2>
                    <p className=\"text-gray-400 text-xs font-bold uppercase tracking-widest mt-1\">Preencha os dados da nota fiscal</p>
                  </div>
                  <button onClick={() => setIsNew(false)} className=\"text-gray-400 hover:text-white transition-colors\">
                    <X size={24} />
                  </button>
                </header>

                <form onSubmit={handleSubmit} className=\"p-8 space-y-6\">
                  <div className=\"grid grid-cols-2 gap-6\">
                    <div className=\"col-span-2\">
                      <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Título / Descrição Curta</label>
                      <input required type=\"text\" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold\" placeholder=\"Ex: Pagamento de Frete - Filial SP\" />
                    </div>
                    
                    <div>
                      <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Fornecedor / Favorecido</label>
                      <input required type=\"text\" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold\" />
                    </div>

                    <div>
                      <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Número da NF</label>
                      <input required type=\"text\" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold\" />
                    </div>

                    <div>
                      <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Método de Pagamento</label>
                      <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold\">
                        {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Data Vencimento</label>
                      <input required type=\"date\" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold\" />
                    </div>
                  </div>

                  <div>
                    <label className=\"block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Observações</label>
                    <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className=\"w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-medium resize-none\" placeholder=\"Informações adicionais para o fiscal...\" />
                  </div>

                  <button 
                    type=\"submit\" 
                    disabled={isLoading}
                    className=\"w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 flex items-center justify-center\"
                  >
                    {isLoading ? <Loader2 className=\"animate-spin mr-2\" /> : 'Enviar para o Fiscal'}
                  </button>
                </form>
             </div>
          </div>
        ) : selectedRequest ? (
          <div className=\"max-w-3xl mx-auto py-12 px-8\">
            <div className=\"bg-white rounded-[40px] shadow-2xl shadow-gray-200/50 border border-gray-100 overflow-hidden\">
              <div className=\"p-10 border-b border-gray-100\">
                <div className=\"flex justify-between items-start mb-6\">
                  <Badge status={selectedRequest.status} request={selectedRequest} currentUser={authState.user} className=\"px-6 py-2 text-xs\" />
                  <span className=\"text-xs font-black text-gray-300 uppercase tracking-[0.2em]\">Detalhamento da Nota</span>
                </div>
                <h2 className=\"text-4xl font-black text-gray-900 leading-tight\">{selectedRequest.title}</h2>
                <div className=\"mt-6 flex flex-wrap gap-4\">
                  <div className=\"px-4 py-2 bg-gray-50 rounded-full text-[10px] font-black text-gray-500 uppercase flex items-center\">
                    <Hash size={12} className=\"mr-2\" /> ID: {selectedRequest.id}
                  </div>
                  <div className=\"px-4 py-2 bg-gray-50 rounded-full text-[10px] font-black text-gray-500 uppercase flex items-center\">
                    <Clock size={12} className=\"mr-2\" /> Criada em: {new Date(selectedRequest.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className=\"p-10 grid grid-cols-2 gap-10\">
                <div className=\"space-y-8\">
                  <div>
                    <h4 className=\"text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3\">Dados do Fornecedor</h4>
                    <p className=\"text-lg font-bold text-gray-800\">{selectedRequest.payee}</p>
                    <p className=\"text-xs text-gray-500 font-medium\">NF: {selectedRequest.invoiceNumber}</p>
                  </div>
                  <div>
                    <h4 className=\"text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3\">Pagamento</h4>
                    <div className=\"flex items-center space-x-3 text-gray-800 font-bold\">
                      <CreditCard size={18} className=\"text-blue-500\" />
                      <span>{selectedRequest.paymentMethod}</span>
                    </div>
                    <div className=\"flex items-center space-x-3 text-gray-800 font-bold mt-2\">
                      <Calendar size={18} className=\"text-blue-500\" />
                      <span>Vencimento: {new Date(selectedRequest.paymentDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className=\"bg-gray-50 p-8 rounded-[32px] space-y-6\">
                  <div>
                    <h4 className=\"text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Status Interno:</h4>
                    <p className=\"text-xs font-bold text-gray-600\">{selectedRequest.statusManual || 'Aguardando Processamento'}</p>
                  </div>
                  <div className=\"pt-4 border-t border-gray-200\">
                    <h4 className=\"text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2\">Observações:</h4>
                    <p className=\"text-sm text-gray-700 font-medium leading-relaxed italic\">\"{selectedRequest.generalObservation || 'Sem observações'}\"</p>
                  </div>

                  {(selectedRequest.status === RequestStatus.ERRO_FISCAL || selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) && (
                    <div className=\"bg-red-50 p-6 rounded-2xl border border-red-100\">
                      <h4 className=\"text-[10px] font-black text-red-600 uppercase tracking-widest mb-2 flex items-center\">Atenção: Correção Necessária</h4>
                      <p className=\"text-sm font-bold text-red-800 mb-1\">{selectedRequest.errorType}</p>
                      <p className=\"text-xs text-red-700 italic\">{selectedRequest.errorObservation}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className=\"h-full flex flex-col items-center justify-center text-gray-300\">
            <div className=\"w-24 h-24 bg-gray-100 rounded-[32px] flex items-center justify-center mb-6\">
              <ChevronRight size={48} className=\"text-gray-200\" />
            </div>
            <h3 className=\"text-xl font-black text-gray-900 tracking-tight\">Painel de Solicitações</h3>
            <p className=\"text-xs font-bold text-gray-400 uppercase tracking-widest mt-2\">Selecione uma nota para ver os detalhes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;