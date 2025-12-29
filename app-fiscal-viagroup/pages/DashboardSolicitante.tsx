import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';  // ✅ useAuth EXPORTADO do App.tsx
import { sharepointService } from '../services/sharepointService';
import { PaymentRequest, RequestStatus } from '../types';
import Layout from '../components/Layout';
import Badge from '../components/Badge';

const stripHtml = (html: string): string => {
  return html?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() || '';
};

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();  // ✅ CORRETO do App.tsx[file:9]
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const currentUserId = authState.user?.id;
  const currentUserEmail = authState.user?.email;

  // ✅ CARREGA E FILTRA PEDIDOS DO USUÁRIO
  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        if (!authState.token || !authState.isAuthenticated) return;

        const allRequests = await sharepointService.getRequests(authState.token);
        
        // ✅ FILTRA PEDIDOS DO USUÁRIO LOGADO
        const userRequests = allRequests.filter((req: PaymentRequest) => 
          req.createdByUserId === currentUserId ||
          req.createdByName?.toLowerCase().includes(currentUserEmail?.toLowerCase() || '')
        );
        
        setRequests(userRequests);
        setFilteredRequests(userRequests);
        console.log(`✅ ${userRequests.length} pedidos do usuário ${currentUserEmail}`);
      } catch (error) {
        console.error('Erro:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [authState.token, authState.isAuthenticated, currentUserId, currentUserEmail]);

  // ✅ BUSCA LOCAL
  useEffect(() => {
    const filtered = requests.filter((req: PaymentRequest) =>
      req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.orderNumbers.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRequests(filtered);
  }, [requests, searchTerm]);

  // ✅ STATUS SIMPLES (sem enum)
  const formatStatus = (status: string) => {
    const labels: { [key: string]: string } = {
      'Pendente': 'Pendente',
      'Análise': 'Análise', 
      'Aprovado': 'Aprovado',
      'Erro - Fiscal': 'Erro Fiscal',
      'Erro - Financeiro': 'Erro Financeiro',
      'Lançado': 'Lançado',
      'Faturado': 'Faturado'
    };
    return labels[status] || status;
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meus Pedidos</h1>
          <p className="text-gray-600 mt-1">
            {requests.length} total | {filteredRequests.length} filtrados
          </p>
        </div>

        {/* Busca */}
        <input
          type="text"
          placeholder="Buscar NF, pedido ou título..."
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        {/* Tabela */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    NF/Pedido
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRequests.map((request) => (
                  <tr
                    key={request.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {stripHtml(request.invoiceNumber) || '---'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {stripHtml(request.orderNumbers)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge status={request.status as any}>
                        {formatStatus(request.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.createdAt 
                        ? new Date(request.createdAt).toLocaleDateString('pt-BR') 
                        : '---'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredRequests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum pedido encontrado
            </div>
          )}
        </div>

        {/* Detalhes */}
        <div className="p-6 bg-white rounded-lg shadow-sm border max-w-md">
          {selectedRequest ? (
            <>
              <h3 className="text-lg font-semibold mb-4">
                Pedido {stripHtml(selectedRequest.invoiceNumber)}
              </h3>
              <div className="space-y-2 text-sm">
                <div><strong>Título:</strong> {selectedRequest.title}</div>
                <div><strong>Status:</strong> {formatStatus(selectedRequest.status)}</div>
                <div><strong>Data:</strong> {new Date(selectedRequest.createdAt).toLocaleDateString('pt-BR')}</div>
                <div><strong>Destinatário:</strong> {selectedRequest.payee || selectedRequest.title}</div>
                {selectedRequest.paymentMethod && (
                  <div><strong>Método:</strong> {selectedRequest.paymentMethod}</div>
                )}
                {selectedRequest.generalObservation && (
                  <div className="text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                    <strong>Observação:</strong> {selectedRequest.generalObservation}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              Selecione um pedido para detalhes
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default DashboardSolicitante;
