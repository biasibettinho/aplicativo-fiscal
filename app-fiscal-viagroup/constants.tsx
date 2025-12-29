
import React from 'react';
import { RequestStatus, User, UserRole } from './types';

export const STATUS_COLORS: Record<RequestStatus, string> = {
  [RequestStatus.PENDENTE]: 'bg-gray-100 text-gray-700 border-gray-200',
  [RequestStatus.ANALISE_FISCAL]: 'bg-yellow-50 text-yellow-600 border-yellow-100',
  [RequestStatus.ANALISE_FINANCEIRO]: 'bg-orange-50 text-orange-600 border-orange-100',
  [RequestStatus.ANALISE]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [RequestStatus.APROVADO]: 'bg-green-100 text-green-700 border-green-200',
  [RequestStatus.ERRO_FISCAL]: 'bg-red-100 text-red-700 border-red-200',
  [RequestStatus.ERRO_FINANCEIRO]: 'bg-red-100 text-red-700 border-red-200',
  [RequestStatus.LANCADO]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [RequestStatus.FATURADO]: 'bg-blue-100 text-blue-700 border-blue-200',
  [RequestStatus.COMPARTILHADO]: 'bg-purple-100 text-purple-700 border-purple-200',
};

export const BRANCHES = ['Matriz SP', 'Filial RJ', 'Filial MG', 'Filial RS', 'Filial BA'];
export const PAYMENT_METHODS = ['Boleto', 'PIX', 'TED/DEPOSITO', 'Transferência', 'Cartão de Crédito'];

export const getStatusPriorityColor = (req: any, currentUser?: User | null) => {
  if (req.status.includes('Erro')) return STATUS_COLORS[req.status as RequestStatus];

  const isFinanceViewer = currentUser?.role === UserRole.FINANCEIRO || currentUser?.role === UserRole.FINANCEIRO_MASTER;
  const isSpecificAnalyst = currentUser?.email === 'financeiro.norte@viagroup.com.br' || currentUser?.email === 'financeiro.sul@viagroup.com.br';

  if (req.statusManual === 'Compartilhado' && isFinanceViewer && !isSpecificAnalyst && currentUser?.role !== UserRole.ADMIN_MASTER) {
    return STATUS_COLORS[RequestStatus.COMPARTILHADO];
  }

  return STATUS_COLORS[req.status as RequestStatus] || 'bg-gray-100 text-gray-700';
};

export const isHighPriority = (paymentDate: string) => {
  const today = new Date();
  const dueDate = new Date(paymentDate);
  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 3;
};
