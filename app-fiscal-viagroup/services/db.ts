
import { User, UserRole, PaymentRequest, RequestStatus, AuditLog } from '../types';
import { supabase } from './supabase';

const USERS_KEY = 'sispag_users';

export const db = {
  getUsers: (): User[] => {
    const data = localStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  },
  
  saveUsers: (users: User[]) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  },

  fetchRemoteUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return [];
    
    const mapped = data.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role as UserRole,
      isActive: u.is_active,
      department: u.department,
      branchDefault: u.branch_default,
      createdAt: u.created_at,
      updatedAt: u.updated_at
    }));

    db.saveUsers(mapped);
    return mapped;
  },

  syncUser: async (user: User) => {
    const { error } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.isActive,
        department: user.department || '',
        branch_default: user.branchDefault || '',
        updated_at: new Date().toISOString()
      });
    
    if (!error) {
      const local = db.getUsers();
      const exists = local.findIndex(u => u.id === user.id);
      if (exists !== -1) {
        local[exists] = user;
      } else {
        local.push(user);
      }
      db.saveUsers(local);
    } else {
      console.error("Erro ao sincronizar usuário no Supabase:", error);
    }
  },

  getRequests: (): PaymentRequest[] => {
    const data = localStorage.getItem('sispag_requests');
    return data ? JSON.parse(data) : [];
  },

  getAuditLogs: (requestId?: string): AuditLog[] => {
    const data = localStorage.getItem('sispag_audit');
    const logs: AuditLog[] = data ? JSON.parse(data) : [];
    return requestId ? logs.filter(l => l.requestId === requestId) : logs;
  }
};
