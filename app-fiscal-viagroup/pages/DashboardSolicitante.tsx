import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { sharepointService } from '../services/sharepointService';
import { PaymentRequest, RequestStatus } from '../types';
import { Layout } from '../components/Layout';
import { Badge } from '../components/Badge';
import { stripHtml } from '../utils/stripHtml';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<Partial<PaymentRequest>>({});
  const [formError, setFormError] = useState('');

  // 👇 FILTRO DO USUÁRIO LOGADO - ÚNICA MUDANÇA
  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        if (!authState.token) return;

        const allRequests = await sharepointService.getRequests(authState.token);
        
        // 👈 FILTRA APENAS PEDIDOS DO USUÁRIO LOGADO
        const currentUserId = authState.user?.id;
        const userRequests = allRequests.filter((req: PaymentRequest) => 
          req.createdByUserId === currentUserId
        );
        
        setRequests(userRequests);
      } catch (error) {
        console.error('Erro carregar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [authState.token, authState.user?.id]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sharepointService.createRequest(authState.token!, formData);
      setShowCreateModal(false);
      setFormData({});
      // Recarrega lista
      const allRequests = await sharepointService.getRequests(authState.token!);
      const currentUserId = authState.user?.id;
      const userRequests = allRequests.filter((req: PaymentRequest) => req.createdByUserId === currentUserId);
      setRequests(userRequests);
    } catch (error) {
      setFormError('Erro ao criar pedido');
    }
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
        {/* Header com botão criar */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meus Pedidos</h1>
            <p className="text-gray-600 mt-1">{requests.length} pedidos encontrados</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Novo Pedido
          </button>
        </div>

        {/* Lista de pedidos - MESMO DESIGN ORIGINAL */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destinatário
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRequest(request)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {stripHtml(request.invoiceNumber) || '---'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {stripHtml(request.orderNumbers)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge status={request.status as any}>
                        {request.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.createdAt 
                        ? new Date(request.createdAt).toLocaleDateString('pt-BR') 
                        : '---'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.payee || request.title}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {requests.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Nenhum pedido criado por você ainda. <br />
              <button 
                onClick={() => setShowCreateModal(true)}
                className="text-blue-600 hover:underline mt-2"
              >
                Criar primeiro pedido
              </button>
            </div>
          )}
        </div>

        {/* Detalhes - MESMO DESIGN ORIGINAL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* Cards de estatísticas originais */}
          </div>
          <div className="lg:col-span-1">
            {selectedRequest ? (
              <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold mb-4">
                  Pedido {stripHtml(selectedRequest.invoiceNumber)}
                </h3>
                <div className="space-y-3 text-sm">
                  <div><span className="font-medium">Título:</span> {selectedRequest.title}</div>
                  <div><span className="font-medium">Pedidos:</span> {stripHtml(selectedRequest.orderNumbers)}</div>
                  <div><span className="font-medium">Método:</span> {selectedRequest.paymentMethod || '---'}</div>
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
                    <div className="mt-2 p-3 bg-gray-50 rounded">
                      <span className="font-medium block mb-1">Observação:</span>
                      {selectedRequest.generalObservation}
                    </div>
                  )}
                  {selectedRequest.errorType && (
                    <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-red-800">
                      <span className="font-medium">Erro:</span> {selectedRequest.errorType}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <div className="text-gray-400 mb-4">👆</div>
                <p className="text-lg text-gray-500">Selecione uma linha da lista para detalhes</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Criar Pedido - FUNCIONALIDADE ORIGINAL */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Novo Pedido</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreateRequest} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                    {formError}
                  </div>
                )}
                
                <input
                  type="text"
                  placeholder="Título do pedido"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
                
                <input
                  type="text"
                  placeholder="NF ou número do pedido"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.invoiceNumber || ''}
                  onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                />
                
                <input
                  type="text"
                  placeholder="Pedidos (123, 456...)"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.orderNumbers || ''}
                  onChange={(e) => setFormData({ ...formData, orderNumbers: e.target.value })}
                />
                
                <input
                  type="text"
                  placeholder="Destinatário"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.payee || ''}
                  onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
                  required
                />
                
                <input
                  type="date"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={formData.paymentDate || ''}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  required
                />
                
                <textarea
                  placeholder="Observações (opcional)"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 h-24"
                  value={formData.generalObservation || ''}
                  onChange={(e) => setFormData({ ...formData, generalObservation: e.target.value })}
                />

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    Criar Pedido
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DashboardSolicitante;
