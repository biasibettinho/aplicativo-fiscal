
import { User, UserRole } from '../types';

export const microsoftGraphService = {
  /**
   * Busca usuários do Tenant usando o token de acesso obtido via MSAL.
   */
  fetchTenantUsers: async (accessToken: string): Promise<Partial<User>[]> => {
    try {
      // Busca usuários com limite aumentado para 999 para garantir que toda a base (>300) seja carregada
      const response = await fetch('https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName&$top=999', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!response.ok) throw new Error("Graph API error");
      
      const data = await response.json();
      
      return data.value.map((u: any) => ({
        id: u.id,
        name: u.displayName,
        email: u.mail || u.userPrincipalName,
        role: UserRole.SOLICITANTE,
        isActive: true
      }));
    } catch (error) {
      console.error("Erro ao buscar usuários do Entra ID:", error);
      return [];
    }
  }
};
