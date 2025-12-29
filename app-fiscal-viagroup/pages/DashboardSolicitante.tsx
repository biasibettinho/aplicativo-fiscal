import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { sharepointService } from '../services/sharepointService';
import { PaymentRequest } from '../types';
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

  // 👇 useEffect ORIGINAL (SEM filtro - carrega TODOS os pedidos)
  useEffect(() => {
    const loadRequests = async () => {
      try {
        setLoading(true);
        if (!authState.token) return;

        const allRequests = await sharepointService.getRequests(authState.token);
        setRequests(allRequests);
        
      } catch (error) {
        console.error('Erro carregar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [authState.token]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await sharepointService.createRequest(authState.token!, formData);
      setShowCreateModal(false);
      setFormData({});
      setFormError('');
      
      // Recarrega lista
      const allRequests = await sharepointService.getRequests(authState.token!);
      setRequests(allRequests); // 👈 SEM FILTRO - ORIGINAL
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
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-gray-600 mt-1">{requests.length} pedidos carregados</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + Novo Pedido
          </button>
        </div>

        {/* Lista de pedidos - ORIGINAL */}
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
                  <th className="px-6 py
