import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { requestService } from '../services/requestService';
import { PaymentRequest } from '../types';
import Layout from '../components/Layout';
import Badge from '../components/Badge';
import { Plus, Search, Paperclip, FileText, Calendar, MapPin, Loader2 } from 'lucide-react';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const loadRequests = async () => {
    if (!authState.user || !authState.token) return;
    
    try {
      setLoading(true);
      const data = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(data);
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [authState.user, authState.token]);

  const filteredRequests = requests.filter(req => 
    req.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Meus Pedidos</h1>
            <p className="text-sm font-medium text-gray-500">Acompanhe o status das suas solicitações enviadas.</p>
          </div>
          
          <button
            onClick={() => alert('Abrir modal de criação')}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={20} />
            <span>Novo Pedido</span>
          </button>
        </div>

        {/* Busca */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder="Pesquisar por Título ou NF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Tabela Clássica */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocolo</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Informações da NF</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Filial</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Documentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center">
                        <Loader2 className="animate-spin text-blue-600 mb-2" size={32} />
                        <span className="text-xs font-black text-gray-400 uppercase">Sincronizando...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-bold uppercase text-xs">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="text-xs font-mono font-bold text-blue-600">#{req.id}</div>
                        <div className="flex items-center text-[10px] text-gray-400 mt-1 font-bold">
                          <Calendar size={12} className="mr-1" />
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString() : '---'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                          {req.title || 'Sem título'}
                        </div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <FileText size={12} className="mr-1 text-gray-300" />
                          NF: {req.invoiceNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg w-fit">
                          <MapPin size={12} className="mr-1 text-gray-400" />
                          {req.branch}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge status={req.status} />
                      </td>
                      <td className="px-6 py-5">
                        <div className={`flex items-center space-x-1 px-3 py-1 rounded-full w-fit border ${req.hasAttachments ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                          <Paperclip size={14} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {req.hasAttachments ? 'Anexado' : 'Pendente'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardSolicitante;
