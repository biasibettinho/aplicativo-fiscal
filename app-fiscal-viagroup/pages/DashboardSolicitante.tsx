import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS, BRANCHES } from '../constants';
import { 
  Plus, Search, History, ChevronRight, Clock, Loader2, Calendar, User, CreditCard, Hash, Info, X, AlertCircle
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

  // Função para carregar as solicitações via API
  const fetchRequests = useCallback(async () => {
    if (!authState.user || !authState.token) return;
    
    setIsLoading(true);
    try {
      // O serviço agora já retorna ordenado, mas o useMemo abaixo garante a ordem após filtros
      const data = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(data);
    } catch (error) {
      console.error("Erro ao carregar solicitações:", error);
    } finally {
      setIsLoading(false);
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
      const payload: Partial<PaymentRequest> = {
        ...formData,
        status: RequestStatus.PENDENTE,
        createdByUserId: authState.user.id,
        createdByName: authState.user.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await requestService.createRequest(payload, authState.token);
      setIsNew(false);
      setFormData(initialFormData);
      await fetchRequests(); // Atualiza a lista e re-aplica a ordenação
    } catch (error) {
      console.error("Erro ao criar:", error);
      alert("Erro ao criar solicitação. Verifique sua conexão.");
    } finally {
      setIsLoading(false);
    }
  };

  // Filtros de interface e Ordenação Reforçada
  const filteredRequests = useMemo(() => {
    return requests
      .filter(req => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          (req.title?.toLowerCase() || '').includes(searchLower) || 
          (req.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
          (req.payee?.toLowerCase() || '').includes(searchLower) ||
          (req.id?.toString() || '').includes(searchLower);
        
        const matchesDate = (!startDate || req.paymentDate >= startDate) && 
                            (!endDate || req.paymentDate <= endDate);
        
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => {
        // Ordenação Decrescente: IDs maiores primeiro
        const idA = Number(a.id) || 0;
        const idB = Number(b.id) || 0;
        return idB - idA;
      });
  }, [requests, searchTerm, startDate, endDate]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* Lista Lateral */}
      <div className="w-96 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-gray-900">Minhas Notas</h3>
            <button 
              onClick={() => { setIsNew(true); setSelectedId(null); }}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-shadow shadow-lg shadow-blue-100"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar nota, ID ou fornecedor..." 
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border-0 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
          {isLoading && requests.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <Loader2 className="animate-spin mb-2" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizando...</span>
            </div>
          ) : filteredRequests.map(req => (
            <button
              key={req.id}
              onClick={() => { setSelectedId(req.id); setIsNew(false); }}
              className={`w-full text-left p-4 rounded-2xl transition-all border-2 ${
                selectedId === req.id ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-gray-50 hover:bg-white hover:border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <Badge status={req.status} request={req} currentUser={authState.user} />
                <span className="text-[10px] font-bold text-gray-400">ID: {req.id}</span>
              </div>
              <p className="font-bold text-gray-900 text-sm truncate">{req.title}</p>
              <div className="flex items-center mt-2 text-gray-400 space-x-3 text-[10px] font-bold uppercase">
                <Calendar size={12} /> 
                <span>{req.paymentDate ? new Date(req.paymentDate).toLocaleDateString('pt-BR') : 'Sem data'}</span>
              </div>
            </button>
          ))}
          {!isLoading && filteredRequests.length === 0 && (
            <div className="text-center py-20 text-gray-400 text-[10px] font-bold uppercase tracking-widest">
              Nenhuma nota encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Área Principal */}
      <div className="flex-1 overflow-y-auto">
        {isNew ? (
          <div className="max-w-3xl mx-auto py-12 px-8">
            <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
              <header className="bg-gray-900 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black tracking-tight">Nova Solicitação</h2>
                  <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Envio de documentos para o Fiscal</p>
                </div>
                <button onClick={() => setIsNew(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </header>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Título da Solicitação</label>
                    <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="Ex: Pagamento Frete Mensal" />
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Fornecedor / Favorecido</label>
                    <input required type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Número da NF</label>
                    <input required type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Filial</label>
                    <select value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold">
                      {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Vencimento</label>
                    <input required type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold" />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-200"
                >
                  {isLoading ? <Loader2 className="animate-spin mr-2" /> : 'Protocolar Nota'}
                </button>
              </form>
            </div>
          </div>
        ) : selectedRequest ? (
          <div className="max-w-3xl mx-auto py-12 px-8">
            <div className="bg-white rounded-[40px] shadow-2xl border border-gray-100 overflow-hidden">
              <div className="p-10 border-b border-gray-100">
                <div className="flex justify-between items-start mb-6">
                  <Badge status={selectedRequest.status} request={selectedRequest} currentUser={authState.user} className="px-6 py-2" />
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Detalhes do Protocolo #{selectedRequest.id}</span>
                </div>
                <h2 className="text-3xl font-black text-gray-900 leading-tight">{selectedRequest.title}</h2>
              </div>

              <div className="p-10 grid grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fornecedor</h4>
                    <p className="font-bold text-gray-800">{selectedRequest.payee}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Nota Fiscal</h4>
                    <p className="font-bold text-gray-800">{selectedRequest.invoiceNumber}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 text-blue-600">Status no Fluxo</h4>
                    <p className="text-sm font-bold text-gray-600 italic">
                      {selectedRequest.statusManual || 'Em triagem fiscal'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 p-8 rounded-[32px] space-y-4">
                  {(selectedRequest.status === RequestStatus.ERRO_FISCAL || selectedRequest.status === RequestStatus.ERRO_FINANCEIRO) && (
                    <div className="bg-red-100 p-4 rounded-2xl border border-red-200">
                      <div className="flex items-center text-red-700 mb-2">
                        <AlertCircle size={16} className="mr-2" />
                        <span className="text-[10px] font-black uppercase">Correção Solicitada</span>
                      </div>
                      <p className="text-xs font-bold text-red-800">{selectedRequest.errorType}</p>
                      <p className="text-[11px] text-red-700 mt-1 italic">{selectedRequest.errorObservation}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Suas Observações:</h4>
                    <p className="text-xs text-gray-600 leading-relaxed italic">
                      "{selectedRequest.generalObservation || 'Nenhuma observação enviada.'}"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-300">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <ChevronRight size={40} className="text-gray-200" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest">Selecione uma nota para detalhes</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;