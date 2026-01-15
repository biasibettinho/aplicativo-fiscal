
import { User, AuthState, UserRole } from '../types';
import { db } from './db';
import { msalInstance, loginRequest } from './msalConfig';
import { sharepointService } from './sharepointService';

export const authService = {
  login: async (email: string, password: string): Promise<AuthState> => {
    await new Promise(r => setTimeout(r, 800));
    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    
    if (user) {
      return { user, isAuthenticated: true, token: 'mock-jwt-' + user.id };
    }
    throw new Error('Credenciais inválidas ou usuário inativo.');
  },

  loginWithMicrosoft: async (): Promise<AuthState> => {
    try {
      // Força o prompt de seleção de conta para permitir trocar de usuário
      const loginResponse = await msalInstance.loginPopup({
        ...loginRequest,
        prompt: "select_account"
      });
      const account = loginResponse.account;
      
      if (!account) throw new Error("Falha ao obter conta Microsoft.");

      const email = account.username.toLowerCase();
      
      // Consulta obrigatória à lista SharePoint App_Gestao_Usuarios para capturar a Role correta
      const role = await sharepointService.getUserRoleFromSharePoint(email);

      const users = db.getUsers();
      let user = users.find(u => u.email.toLowerCase() === email);

      if (!user) {
        user = {
          id: account.localAccountId,
          email: email,
          name: account.name || email.split('@')[0],
          role: role, 
          isActive: true,
          department: (account.idTokenClaims as any)?.department || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.saveUsers([...users, user]);
      } else {
        // Sincroniza a Role caso tenha havido alteração no SharePoint
        if (user.role !== role) {
          user.role = role;
          db.saveUsers(users.map(u => u.email.toLowerCase() === email ? { ...u, role } : u));
        }
      }

      if (!user.isActive) throw new Error("Sua conta está desativada no sistema.");

      const state = {
        user,
        isAuthenticated: true,
        token: loginResponse.accessToken
      };
      
      localStorage.setItem('sispag_session', JSON.stringify(state));
      return state;
    } catch (error: any) {
      console.error("MS Login Error:", error);
      const errorMessage = error.errorMessage || error.message || "Erro na autenticação Microsoft.";
      throw new Error(errorMessage);
    }
  },
  
  getSharePointToken: async (): Promise<string | null> => {
    try {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length === 0) return null;

      const request = {
        scopes: [`https://vialacteoscombr.sharepoint.com/.default`],
        account: accounts[0]
      };

      try {
        const response = await msalInstance.acquireTokenSilent(request);
        return response.accessToken;
      } catch (silentError) {
        console.warn("Silent token acquisition failed for SharePoint, trying popup...", silentError);
        const response = await msalInstance.acquireTokenPopup(request);
        return response.accessToken;
      }
    } catch (error) {
      console.error("Erro crítico ao adquirir token SharePoint:", error);
      return null;
    }
  },
  
  getCurrentUser: (): User | null => {
    const session = localStorage.getItem('sispag_session');
    if (!session) return null;
    const parsed = JSON.parse(session);
    const users = db.getUsers();
    return users.find(u => u.email.toLowerCase() === parsed.user.email.toLowerCase()) || parsed.user;
  }
};
