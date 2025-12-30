import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { requestService } from '../services/requestService';
import { PaymentRequest } from '../types';
import { Layout } from '../components/Layout';
import Badge from '../components/Badge';
import { Plus, Search, Paperclip, FileText, Calendar, MapPin } from 'lucide-react';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        if (authState.user && authState.token) {
          // Utiliza o serviço filtrado para trazer apenas os pedidos do usuário
          const data = await requestService.getRequestsFiltered(authState.user, authState.token);
          setRequests(data);
        }
      } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRequests();
  }, [authState.user, authState.token]);

  const filteredRequests = requests.filter(req => 
    req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Minhas Solicitações</h1>
            <p className="text-sm font-medium text-gray-500">Gerencie seus pedidos de pagamento enviados ao fiscal.</p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={20} />
            <span>Novo Pedido</span>
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
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
          <div className="text-sm font-bold text-gray-400 px-4">
            {filteredRequests.length} itens
          </div>
        </div>

        {/* Tabela de Pedidos - DESIGN RESTAURADO */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">ID / Data</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Descrição NF</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Filial</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Anexos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <p className="mt-2 text-sm font-bold text-gray-400 uppercase">Carregando dados...</p>
                    </td>
                  </tr>
                ) : filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-gray-400 font-medium">
                      Nenhuma solicitação encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-50/80 transition-colors group">
                      <td className="px-6 py-5">
                        <div className="text-xs font-mono font-bold text-blue-600">#{req.id}</div>
                        <div className="flex items-center text-[11px] text-gray-400 mt-1 font-bold">
                          <Calendar size={12} className="mr-1" />
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">{req.title}</div>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <FileText size={12} className="mr-1 text-gray-400" />
                          NF: {req.invoiceNumber}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center text-xs font-bold text-gray-600">
                          <MapPin size={12} className="mr-1 text-gray-400" />
                          {req.branch}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <Badge status={req.status} />
                      </td>
                      <td className="px-6 py-5">
                        {/* Indicador de Anexo Inteligente */}
                        <div className={`flex items-center space-x-1 px-3 py-1 rounded-full w-fit ${req.hasAttachments ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                          <Paperclip size={14} />
                          <span className="text-[10px] font-black uppercase tracking-tighter">
                            {req.hasAttachments ? 'Vinculado' : 'Sem Doc'}
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
