
import React, { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { User, AuthState, UserRole } from './types';
import { db } from './services/db';
import Login from './pages/Login';
import DashboardSolicitante from './pages/DashboardSolicitante';
import DashboardFiscal from './pages/DashboardFiscal';
import DashboardFinanceiro from './pages/DashboardFinanceiro';
import DashboardAdmin from './pages/DashboardAdmin';
import Statistics from './pages/Statistics';
import Layout from './components/Layout';

interface AuthContextType {
  authState: AuthState;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

const App: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>(() => {
    const saved = localStorage.getItem('sispag_session');
    return saved ? JSON.parse(saved) : { user: null, isAuthenticated: false, token: null };
  });

  const login = async (email: string, pass: string) => {
    // Usamos db.getUsers() pois ele garante que INITIAL_USERS existam no localStorage
    const users = db.getUsers();
    const user = users.find((u: User) => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
    
    if (user) {
      // Simulação de verificação de senha (em produção usaria hash)
      const newState = { user, isAuthenticated: true, token: 'fake-jwt-' + user.id };
      setAuthState(newState);
      localStorage.setItem('sispag_session', JSON.stringify(newState));
    } else {
      throw new Error('Usuário não encontrado ou inativo.');
    }
  };

  const logout = () => {
    setAuthState({ user: null, isAuthenticated: false, token: null });
    localStorage.removeItem('sispag_session');
  };

  return (
    <AuthContext.Provider value={{ authState, login, logout }}>
      <HashRouter>
        <Routes>
          <Route path="/login" element={authState.isAuthenticated ? <Navigate to="/" /> : <Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <HomeRouter />
              </ProtectedRoute>
            } 
          />
          <Route path="/solicitante" element={<ProtectedRoute roles={[UserRole.SOLICITANTE, UserRole.ADMIN_MASTER]}><Layout><DashboardSolicitante /></Layout></ProtectedRoute>} />
          <Route path="/fiscal" element={<ProtectedRoute roles={[UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.ADMIN_MASTER]}><Layout><DashboardFiscal /></Layout></ProtectedRoute>} />
          <Route path="/financeiro" element={<ProtectedRoute roles={[UserRole.FINANCEIRO, UserRole.FINANCEIRO_MASTER, UserRole.ADMIN_MASTER]}><Layout><DashboardFinanceiro /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute roles={[UserRole.ADMIN_MASTER]}><Layout><DashboardAdmin /></Layout></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute roles={[UserRole.ADMIN_MASTER, UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.FINANCEIRO_MASTER]}><Layout><Statistics /></Layout></ProtectedRoute>} />
        </Routes>
      </HashRouter>
    </AuthContext.Provider>
  );
};

const HomeRouter: React.FC = () => {
  const { authState } = useAuth();
  const role = authState.user?.role;

  if (role === UserRole.SOLICITANTE) return <Navigate to="/solicitante" />;
  if (role === UserRole.FISCAL_COMUM || role === UserRole.FISCAL_ADMIN) return <Navigate to="/fiscal" />;
  if (role === UserRole.FINANCEIRO || role === UserRole.FINANCEIRO_MASTER) return <Navigate to="/financeiro" />;
  if (role === UserRole.ADMIN_MASTER) return <Navigate to="/admin" />;
  return <Navigate to="/login" />;
};

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
  const { authState } = useAuth();
  
  if (!authState.isAuthenticated) return <Navigate to="/login" />;
  if (roles && authState.user && !roles.includes(authState.user.role)) {
    return <Navigate to="/" />;
  }
  
  return <>{children}</>;
};

export default App;
