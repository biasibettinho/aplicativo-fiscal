
import { User, AuthState, UserRole } from '../types';
import { db } from './db';
import { msalInstance, loginRequest } from './msalConfig';

export const authService = {
  loginWithMicrosoft: async (): Promise<AuthState> => {
    try {
      const loginResponse = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: 'select_account'
      });
      const account = loginResponse.account;
      
      if (!account) throw new Error("Falha ao obter conta Microsoft.");

      const users = db.getUsers();
      // Busca pelo email para vincular a conta Microsoft ao registro local
      let user = users.find(u => u.email.toLowerCase() === account.username.toLowerCase());

      const isAdmin = account.username.toLowerCase() === 'felipe.gabriel@viagroup.com.br';

      if (!user) {
        user = {
          id: account.localAccountId, // ID Real da Microsoft
          email: account.username,
          name: account.name || account.username.split('@')[0],
          role: isAdmin ? UserRole.ADMIN_MASTER : UserRole.SOLICITANTE,
          isActive: true,
          department: (account.idTokenClaims as any)?.department || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.saveUsers([...users, user]);
      } else {
        // ATUALIZAÇÃO CRÍTICA: Se o usuário já existia mas com ID de placeholder, atualizamos para o ID real do Azure
        let needsUpdate = false;
        if (user.id !== account.localAccountId) {
          user.id = account.localAccountId;
          needsUpdate = true;
        }
        if (isAdmin && user.role !== UserRole.ADMIN_MASTER) {
          user.role = UserRole.ADMIN_MASTER;
          needsUpdate = true;
        }
        
        // Sincroniza o departamento se disponível no token
        const dept = (account.idTokenClaims as any)?.department;
        if (dept && user.department !== dept) {
          user.department = dept;
          needsUpdate = true;
        }

        if (needsUpdate) {
          db.saveUsers(users.map(u => u.email.toLowerCase() === user?.email.toLowerCase() ? user! : u));
        }
      }

      if (!user.isActive) throw new Error("Sua conta está desativada no sistema.");

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
