
import { User, UserRole, PaymentRequest, RequestStatus, AuditLog } from '../types';

const USERS_KEY = 'sispag_users';
const REQUESTS_KEY = 'sispag_requests';
const AUDIT_KEY = 'sispag_audit';

// IDs serão preenchidos dinamicamente no login via Microsoft para bater com o SharePoint
const INITIAL_USERS: User[] = [
  {
    id: 'placeholder_admin',
    email: 'felipe.gabriel@viagroup.com.br',
    name: 'Felipe Gabriel',
    role: UserRole.ADMIN_MASTER,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    let users: User[] = data ? JSON.parse(data) : INITIAL_USERS;
    
    // Garante que o administrador principal sempre tenha o papel correto
    let updated = false;
    users = users.map(u => {
      if (u.email.toLowerCase() === 'felipe.gabriel@viagroup.com.br' && u.role !== UserRole.ADMIN_MASTER) {
        updated = true;
        return { ...u, role: UserRole.ADMIN_MASTER };
      }
      return u;
    });

    if (updated || !data) {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    
    return users;
  },
  
  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  getRequests: (): PaymentRequest[] => {
    const data = localStorage.getItem(REQUESTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  saveRequests: (requests: PaymentRequest[]) => {
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  },

  getAuditLogs: (requestId?: string): AuditLog[] => {
    const data = localStorage.getItem(AUDIT_KEY);
    const logs: AuditLog[] = data ? JSON.parse(data) : [];
    return requestId ? logs.filter(l => l.requestId === requestId) : logs;
  },

  addAuditLog: (log: Omit<AuditLog, 'id' | 'createdAt'>) => {
    const logs = db.getAuditLogs();
    const newLog: AuditLog = {
      ...log,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(AUDIT_KEY, JSON.stringify([newLog, ...logs]));
  }
};
