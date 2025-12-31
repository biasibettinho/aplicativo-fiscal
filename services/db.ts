
import { User, UserRole, PaymentRequest, RequestStatus, AuditLog } from '../types';

const USERS_KEY = 'sispag_users';
const REQUESTS_KEY = 'sispag_requests';
const AUDIT_KEY = 'sispag_audit';

const INITIAL_USERS: User[] = [
  {
    id: 'admin_fg',
    email: 'felipe.gabriel@viagroup.com.br',
    name: 'Felipe Gabriel',
    role: UserRole.ADMIN_MASTER,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u1',
    email: 'admin@sispag.com',
    name: 'Admin Master',
    role: UserRole.ADMIN_MASTER,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u2',
    email: 'solicitante@sispag.com',
    name: 'João Silva',
    role: UserRole.SOLICITANTE,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u3',
    email: 'fiscal@sispag.com',
    name: 'Ana Fiscal',
    role: UserRole.FISCAL_ADMIN,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'u4',
    email: 'financeiro@sispag.com',
    name: 'Pedro Financeiro',
    role: UserRole.FINANCEIRO,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    let users: User[] = data && JSON.parse(data).length > 0 ? JSON.parse(data) : INITIAL_USERS;
    
    // Regra de Integridade: Garante que felipe.gabriel@viagroup.com.br sempre seja ADMIN_MASTER
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

  syncExternalUsers: (externalUsers: Partial<User>[]) => {
    const localUsers = db.getUsers();
    const updatedUsers = [...localUsers];

    externalUsers.forEach(ext => {
      const exists = updatedUsers.find(u => u.email.toLowerCase() === ext.email?.toLowerCase());
      if (!exists && ext.email && ext.name) {
        const isAdmin = ext.email.toLowerCase() === 'felipe.gabriel@viagroup.com.br';
        
        updatedUsers.push({
          id: ext.id || Math.random().toString(36).substr(2, 9),
          email: ext.email,
          name: ext.name,
          role: isAdmin ? UserRole.ADMIN_MASTER : UserRole.SOLICITANTE,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });

    db.saveUsers(updatedUsers);
    return updatedUsers;
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
