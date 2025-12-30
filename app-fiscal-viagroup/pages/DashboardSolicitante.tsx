import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { sharepointService } from '../services/sharepointService';
import { PaymentRequest } from '../types';
import { Layout } from '../components/Layout';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<Partial<PaymentRequest>>({
    branch: 'Matriz SP',
    paymentMethod: 'Boleto'
  });
  
  const [nfFile, setNfFile] = useState<File | null>(null);
  const [boletoFile, setBoletoFile] = useState<File | null>(null);

  useEffect(() => {
    loadData();
  }, [authState.token]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (authState.token) {
        const data = await sharepointService.getRequests(authState.token);
        setRequests(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Criar o item principal
      const newItem = await sharepointService.createRequest(authState.token!, formData);
      const itemId = newItem.id;

      // 2. Upload da Nota Fiscal (com ajuste de nome por NF)
      if (nfFile) {
        await (sharepointService as any).uploadAttachment(
          authState.token!, 
          itemId, 
          nfFile, 
          formData.invoiceNumber
        );
      }

      // 3. Upload do Boleto/Comprovante
      if (boletoFile) {
        await (sharepointService as any).uploadAttachment(
          authState.token!, 
          itemId, 
          boletoFile, 
          formData.invoiceNumber
        );
      }

      alert("Solicitação e anexos enviados com sucesso!");
      setShowCreateModal(false);
      setNfFile(null);
      setBoletoFile(null);
      loadData();
    } catch (error: any) {
      alert("Erro no processo: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // O restante do seu JSX (tabela e modal) permanece o mesmo do original
  return (
    <Layout>
      {/* ... conteúdo do layout e modal ... */}
      {/* Certifique-se de que os inputs de arquivo chamem setNfFile e setBoletoFile */}
    </Layout>
  );
};

export default DashboardSolicitante;
