import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, ChevronRight, Clock, Loader2, Calendar, User, CreditCard, Hash, Landmark, Info
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

  // Carregar dados iniciais
  useEffect(() => {
    const load = async () => {
      if (authState.user && authState.token) {
        const data = await requestService.getRequestsFiltered(authState.user, authState.token);
        setRequests(data);
      }
    };
    load();
  }, [authState.user, authState.token]);

  // --- LÓGICA DE FILTRO E ORDENAÇÃO CORRIGIDA ---
  const filteredRequests = useMemo(() => {
    // 1. Filtragem
    const filtered = requests.filter(req => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (req.title?.toLowerCase() || '').includes(searchLower) || 
        (req.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
        (req.id?.toString() || '').includes(searchLower);
      
      const reqDate = req.paymentDate; 
      const matchesDate = (!startDate || reqDate >= startDate) && 
                          (!endDate || reqDate <= endDate);
      
      return matchesSearch && matchesDate;
    });

    // 2. Ordenação Decrescente Garantida (Maior ID primeiro)
    return [...filtered].sort((a, b) => {
      // Força a conversão para número para evitar ordenação de texto (ex: "10" vindo antes de "2")
      const idA = parseInt(String(a.id), 10) || 0;
      const idB = parseInt(String(b.id), 10) || 0;
      
      // b - a = Ordem Decrescente (Ex: 150, 149, 148...)
      return idB - idA;
    });
  }, [requests, searchTerm, startDate, endDate]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* Lista Lateral */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter italic">SISPAG</h1>
            <button 
              onClick={() => { setIsNew(true); setSelectedId(null); }}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="space-y-3">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="Buscar nota ou ID..." 
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-inner"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredRequests.length > 0 ? (
            filteredRequests.map(req => (
              <button
                key={req.id}
                onClick={() => { setSelectedId(req.id); setIsNew(false); }}
                className={`w-full p-4 rounded-3xl transition-all text-left border-2 ${
                  selectedId === req.id 
                    ? 'bg-white border-blue-600 shadow-xl shadow-blue-50/50 scale-[1.02]' 
                    : 'bg-white border-transparent hover:border-gray-100 hover:bg-gray-50 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-full">
                    ID #{req.id}
                  </span>
                  <Badge status={req.status} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{req.title}</h3>
                <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                  <Calendar size={12} className="mr-1" />
                  {new Date(req.paymentDate).toLocaleDateString('pt-BR')}
                </div>
              </button>
            ))
          ) : (
            <div className="py-20 text-center">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Nenhum resultado</p>
            </div>
          )}
        </div>
      </div>

      {/* Área de Conteúdo / Detalhes */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {selectedRequest ? (
          <div className="flex-1 overflow-y-auto p-12">
            <div className="max-w-4xl mx-auto space-y-8">
              <div className="flex justify-between items-end border-b border-gray-200 pb-8">
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tighter mb-2">{selectedRequest.title}</h2>
                  <div className="flex items-center space-x-4">
                     <Badge status={selectedRequest.status} className="px-4 py-1.5 text-xs" />
                     <span className="text-sm text-gray-400 font-medium">Lançada em {new Date(selectedRequest.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Grid de Informações */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Dados da Nota</p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">NF:</span>
                      <span className="text-sm font-bold text-gray-900">{selectedRequest.invoiceNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Favorecido:</span>
                      <span className="text-sm font-bold text-gray-900">{selectedRequest.payee}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Pagamento</p>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Método:</span>
                      <span className="text-sm font-bold text-gray-900">{selectedRequest.paymentMethod}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">Data Prevista:</span>
                      <span className="text-sm font-bold text-gray-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
             <h3 className="text-xl font-black text-gray-900 tracking-tight">Selecione uma solicitação</h3>
             <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">A nota mais recente aparecerá no topo da lista à esquerda.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;