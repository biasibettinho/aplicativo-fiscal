export enum UserRole {
  SOLICITANTE = 'Solicitante',
  FISCAL_COMUM = 'Fiscal Comum',
  FISCAL_ADMIN = 'Fiscal Admin',
  FINANCEIRO = 'Financeiro',
  FINANCEIRO_MASTER = 'Financeiro Master',
  ADMIN_MASTER = 'Admin Master'
}

export enum RequestStatus {
  PENDENTE = 'Pendente',
  ANALISE = 'Análise',
  APROVADO = 'Aprovado',
  ERRO_FISCAL = 'Erro - Fiscal',
  ERRO_FINANCEIRO = 'Erro - Financeiro',
  LANCADO = 'Lançado',
  FATURADO = 'Faturado',
  COMPARTILHADO = 'Compartilhado',
  PROCESSANDO = 'Processando'
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  department?: string;
  branchDefault?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  requestId: string;
  type: 'invoice_pdf' | 'boleto' | 'other';
  fileName: string;
  mimeType: string;
  size: number;
  storageUrl: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  requestId: string;
  actionType: string;
  message: string;
  actorUserId: string;
  actorName: string;
  actorRoleSnapshot: string;
  createdAt: string;
}

export interface PaymentRequest {
  id: string;
  graphId: string; 
  mirrorId: number;
  title: string;
  branch: string;
  createdByUserId: string;
  createdByName: string;
  // Adicionado authorEmail para corrigir erro de tipo no requestService.ts
  authorEmail?: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  statusFinal?: string;
  statusManual?: string;
  statusEspelho?: string; // Coluna STATUS_ESPELHO
  errorType?: string;
  errorObservation?: string;
  generalObservation?: string; 
  approverObservation?: string; 
  orderNumber: string;
  invoiceNumber: string;
  payee: string;
  budgetValue?: number; 
  discountText?: string; 
  paymentMethod: string;
  bank?: string;
  agency?: string;
  account?: string;
  accountType?: string;
  pixKey?: string;
  paymentDate: string;
  sentToFiscalAt?: string;
  sentToFinanceAt?: string;
  finalizedAt?: string;
  sharedWithUserId?: string;
  sharedByUserId?: string;
  sharedByName?: string; // Coluna PESSOA_COMPARTILHOU
  sharedWithEmail?: string; 
  shareComment?: string; // Coluna COMENTARIO_COMPARTILHAMENTO
  attachments?: Attachment[];
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}