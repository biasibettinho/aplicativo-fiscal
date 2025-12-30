
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  ShieldCheck, 
  BadgeDollarSign, 
  Settings, 
  LogOut, 
  PieChart,
  UserCircle
} from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const location = useLocation();
  const user = authState.user;

  const NavItem = ({ to, icon: Icon, label, roles }: { to: string, icon: any, label: string, roles?: UserRole[] }) => {
    if (roles && user && !roles.includes(user.role)) return null;
    const isActive = location.pathname === to;
    
    return (
      <Link 
        to={to} 
        className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
          isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
        }`}
      >
        <Icon size={20} />
        <span className="font-semibold text-sm">{label}</span>
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar - Sem logos */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-8 border-b border-gray-100">
          <h1 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em]">
            Menu do Sistema
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 mt-4">
          <NavItem to="/solicitante" icon={LayoutDashboard} label="Solicitante" roles={[UserRole.SOLICITANTE, UserRole.ADMIN_MASTER]} />
          <NavItem to="/fiscal" icon={ShieldCheck} label="Fiscal / Admin" roles={[UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.ADMIN_MASTER]} />
          <NavItem to="/financeiro" icon={BadgeDollarSign} label="Financeiro" roles={[UserRole.FINANCEIRO, UserRole.FINANCEIRO_MASTER, UserRole.ADMIN_MASTER]} />
          <NavItem to="/stats" icon={PieChart} label="Estatísticas" roles={[UserRole.ADMIN_MASTER, UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.FINANCEIRO_MASTER]} />
          <NavItem to="/admin" icon={Settings} label="Configurações" roles={[UserRole.ADMIN_MASTER]} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-3 px-4 py-2 mb-4">
            <div className="bg-gray-100 p-2 rounded-full text-gray-600">
              <UserCircle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter truncate">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-black text-xs uppercase tracking-widest"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h2 className="text-lg font-black text-gray-800 tracking-tight uppercase italic">
            {location.pathname === '/solicitante' && 'Fluxo de Notas'}
            {location.pathname === '/fiscal' && 'Análise Fiscal'}
            {location.pathname === '/financeiro' && 'Gestão Financeira'}
            {location.pathname === '/admin' && 'Painel Administrativo'}
            {location.pathname === '/stats' && 'Insights e Métricas'}
          </h2>
          <div className="flex items-center">
            <span className="text-[10px] font-black bg-gray-100 text-gray-400 px-3 py-1 rounded-full tracking-widest uppercase">V1.2.0</span>
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
