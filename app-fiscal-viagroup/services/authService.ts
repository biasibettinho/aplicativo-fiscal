
import { User, AuthState, UserRole } from '../types';
import { db } from './db';
import { msalInstance, loginRequest } from './msalConfig';

export const authService = {
  login: async (email: string, password: string): Promise<AuthState> => {
    await new Promise(r => setTimeout(r, 800));
    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    
    if (user) {
      await db.syncUser(user);
      return { user, isAuthenticated: true, token: 'mock-jwt-' + user.id };
    }
    throw new Error('Credenciais inválidas ou usuário inativo.');
  },

  loginWithMicrosoft: async (): Promise<AuthState> => {
    try {
      const loginResponse = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: 'select_account'
      });
      const account = loginResponse.account;
      
      if (!account) throw new Error("Falha ao obter conta Microsoft.");

      // Mapeamento do officeLocation (Escritório) vindo do Microsoft Graph
      const office = (account.idTokenClaims as any)?.officeLocation || (account.idTokenClaims as any)?.department || 'Matriz SP';

      const users = db.getUsers();
      let user = users.find(u => u.email.toLowerCase() === account.username.toLowerCase());

      const isAdmin = account.username.toLowerCase() === 'felipe.gabriel@viagroup.com.br';

      if (!user) {
        user = {
          id: account.localAccountId,
          email: account.username,
          name: account.name || account.username.split('@')[0],
          role: isAdmin ? UserRole.ADMIN_MASTER : UserRole.SOLICITANTE,
          isActive: true,
          department: office,
          branchDefault: office,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      } else {
        user.name = account.name || user.name;
        user.department = office;
        user.branchDefault = office;
        if (isAdmin) user.role = UserRole.ADMIN_MASTER;
      }

      if (!user.isActive) throw new Error("Sua conta está desativada no sistema.");

      // Sincroniza usuário na tabela 'users' do Supabase
      await db.syncUser(user);

      return {
        user,
        isAuthenticated: true,
        token: loginResponse.accessToken
      };
    } catch (error: any) {
      console.error("MS Login Error:", error);
      throw new Error(error.message || "Erro na autenticação Microsoft.");
    }
  },
  
  getCurrentUser: (): User | null => {
    const session = localStorage.getItem('sispag_session');
    if (!session) return null;
    
    const parsed = JSON.parse(session);
    const latestUsers = db.getUsers();
    return latestUsers.find(u => u.email.toLowerCase() === parsed.user.email.toLowerCase()) || parsed.user;
  }
};
