
import React from 'react';
import { RequestStatus, PaymentRequest, User, UserRole } from '../types';
import { STATUS_COLORS } from '../constants';

interface BadgeProps {
  status: RequestStatus | string;
  request?: PaymentRequest;
  currentUser?: User | null;
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ status, request, currentUser, className }) => {
  let displayStatus = status;
  let colorClass = STATUS_COLORS[status as RequestStatus] || 'bg-gray-100 text-gray-600 border-gray-200';

  if (currentUser) {
    // Regra: Solicitante não deve ver "Compartilhado"
    if (currentUser.role === UserRole.SOLICITANTE && status === RequestStatus.COMPARTILHADO) {
      displayStatus = RequestStatus.APROVADO;
      colorClass = STATUS_COLORS[RequestStatus.APROVADO];
    } else if (request) {
      const isRecipient = currentUser.id === request.sharedWithUserId;
      const isFinanceViewer = currentUser.role === UserRole.FINANCEIRO || currentUser.role === UserRole.FINANCEIRO_MASTER;
      const isSpecificAnalyst = currentUser.email === 'financeiro.norte@viagroup.com.br' || currentUser.email === 'financeiro.sul@viagroup.com.br';

      // Se a solicitação foi compartilhada manualmente
      if (request.statusManual === 'Compartilhado' && isFinanceViewer) {
        if (isRecipient) {
          // Quem recebeu vê como "Pendente" (de sua ação)
          displayStatus = 'Pendente';
          colorClass = STATUS_COLORS[RequestStatus.PENDENTE];
        } else if (!isSpecificAnalyst && currentUser.role !== UserRole.ADMIN_MASTER) {
          // Demais do financeiro (organizacional) veem como "Compartilhado"
          displayStatus = 'Compartilhado';
          colorClass = STATUS_COLORS[RequestStatus.COMPARTILHADO];
        }
      }
    }
  }
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}>
      {displayStatus}
    </span>
  );
};

export default Badge;
