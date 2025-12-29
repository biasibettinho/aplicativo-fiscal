import React, { useState, useEffect } from 'react';
import { useAuth } from '../../App';
import { sharepointService } from '../../services/sharepointService';
import { PaymentRequest, RequestStatus } from '../../types';
import { Layout } from '../../components/Layout';
import { Badge } from '../../components/Badge';
import { stripHtml } from '../../utils/stripHtml';

const DashboardSolicitante: React.FC = () => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'todos'>('todos');
  
  const authState = useAuth();
  const currentUserId = authState.user?.id;
  const currentUserEmail = authState.user?.email;

  // 👇 CARREGA APENAS PEDIDOS DO USUÁRIO LOGADO
  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        if (!authState.token) return;

        console.log('🔄 Carregando pedidos do usuário:', currentUserId);
        const allRequests = await sharepointService.getRequests(authState.token);
        
        // 👈 FILTRA SOMENTE PEDIDOS CRIADOS PELO USUÁRIO ATUAL
        const userRequests = allRequests.filter(req => 
          req.createdByUserId === currentUserId ||
          req.createdByName?.toLowerCase().includes(currentUserEmail?.toLowerCase() || '')
        );
        
        setRequests(userRequests);
        console.log(`✅ ${userRequests.length} pedidos carregados para ${currentUserEmail}`);
      } catch (error) {
        console.error('❌ Erro carregar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [authState.token, currentUserId, currentUserEmail]);

  // Filtros locais
  useEffect(() => {
    let filtered = [...requests];

    if (searchTerm) {
      filtered = filtered.filter(req =>
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.orderNumbers.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'todos') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    setFilteredRequests(filtered);
  }, [requests, searchTerm, statusFilter]);

  const formatStatus = (status: RequestStatus) => {
    const statusLabels: Record<RequestStatus, string> = {
      [RequestStatus.PENDENTE]: 'Pendente',
      [RequestStatus.ANALISE]: 'Análise',
      [RequestStatus.APROVADO]: 'Aprovado',
      [RequestStatus.ERROFISCAL]: 'Erro Fiscal',
      [RequestStatus.ERROFINANCEIRO]: 'Erro Financeiro',
      [RequestStatus.LANCADO]: 'Lançado',
      [RequestStatus.FATURADO]: 'Faturado',
      [RequestStatus.COMPARTILHADO]: 'Compartilhado'
    };
    return statusLabels[status] || status;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meus Pedidos</h1>
            <p className="text-gray-600 mt-1">
              {requests.length} pedidos totais | {filteredRequests.length} filtrados
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Buscar por título, NF ou pedido..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RequestStatus | 'todos')}
            >
              <option value="todos">Todos Status</option>
              <option value={RequestStatus.PENDENTE}>Pendente</option>
              <option value={RequestStatus.ANALISE}>Análise</option>
              <option value={RequestStatus.APROVADO}>Aprovado</option>
            </select>
          </div>
        </div>

        {/* Lista de pedidos */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Lista */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold text-gray-900">Lista de Pedidos</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NF/Pedido</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRequests.map((request) => (
                      <tr
                        key={request.id}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedRequest(request)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>{stripHtml(request.invoiceNumber) || '---'}</div>
                          <div className="text-sm text-gray-500">{stripHtml(request.orderNumbers)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge status={request.status}>{formatStatus(request.status)}</Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.createdAt ? new Date(request.createdAt).toLocaleDateString('pt-BR') : '---'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.budgetValue ? `R$ ${request.budgetValue.toLocaleString('pt-BR')}` : '---'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredRequests.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  {searchTerm || statusFilter !== 'todos' ? 'Nenhum pedido encontrado' : 'Nenhum pedido criado ainda'}
                </div>
              )}
            </div>
          </div>

          {/* Detalhes */}
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <div className="bg-white rounded-lg shadow-sm border p-6 h-[500px] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Detalhes do Pedido {stripHtml(selectedRequest.invoiceNumber)}
                </h3>
                <div className="space-y-3 text-sm">
                  <div><span className="font-medium">Título:</span> {selectedRequest.title}</div>
                  <div><span className="font-medium">Pedidos:</span> {stripHtml(selectedRequest.orderNumbers)}</div>
                  <div><span className="font-medium">Método:</span> {selectedRequest.paymentMethod}</div>
                  <div><span className="font-medium">Data Pagto:</span> {selectedRequest.paymentDate ? new Date(selectedRequest.paymentDate).toLocaleDateString('pt-BR') : '---'}</div>
                  <div><span className="font-medium">Destinatário:</span> {selectedRequest.payee || selectedRequest.title}</div>
                  {selectedRequest.bank && (
                    <>
                      <div><span className="font-medium">Banco:</span> {selectedRequest.bank}</div>
                      <div><span className="font-medium">Agência:</span> {selectedRequest.agency}</div>
                      <div><span className="font-medium">Conta:</span> {selectedRequest.account}</div>
                    </>
                  )}
                  {selectedRequest.pixKey && <div><span className="font-medium">PIX:</span> {selectedRequest.pixKey}</div>}
                  {selectedRequest.generalObservation && (
                    <div><span className="font-medium">Observação:</span> "{selectedRequest.generalObservation}"</div>
                  )}
                  {selectedRequest.errorType && <div className="text-red-600"><span className="font-medium">Erro:</span> {selectedRequest.errorType}</div>}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg shadow-sm border p-8 text-center text-gray-500 h-[500px] flex items-center justify-center">
                Selecione uma linha da lista para detalhes
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardSolicitante;
