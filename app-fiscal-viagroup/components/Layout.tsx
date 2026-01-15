
import React, { useState } from 'react';
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
  UserCircle,
  Menu,
  X,
  RefreshCw
} from 'lucide-react';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authState, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const user = authState.user;

  const NavItem = ({ to, icon: Icon, label, roles }: { to: string, icon: any, label: string, roles?: UserRole[] }) => {
    if (roles && user && !roles.includes(user.role)) return null;
    const isActive = location.pathname === to;
    
    return (
      <Link 
        to={to} 
        onClick={() => setIsSidebarOpen(false)}
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
    <div className="flex h-screen bg-gray-50 overflow-hidden relative">
      {/* Overlay Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col shadow-xl transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:shadow-sm
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <img 
            src="https://viagroup.com.br/assets/via_group-22fac685.png" 
            alt="Via Group" 
            className="h-8 object-contain"
          />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-6 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
          <NavItem to="/solicitante" icon={LayoutDashboard} label="Solicitante" roles={[
            UserRole.SOLICITANTE, 
            UserRole.ADMIN_MASTER, 
            UserRole.FISCAL_COMUM, 
            UserRole.FISCAL_ADMIN, 
            UserRole.FINANCEIRO, 
            UserRole.FINANCEIRO_MASTER
          ]} />
          <NavItem to="/fiscal" icon={ShieldCheck} label="Fiscal / Admin" roles={[UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.ADMIN_MASTER]} />
          <NavItem to="/financeiro" icon={BadgeDollarSign} label="Financeiro" roles={[UserRole.FINANCEIRO, UserRole.FINANCEIRO_MASTER, UserRole.ADMIN_MASTER]} />
          <NavItem to="/stats" icon={PieChart} label="Estatísticas" roles={[UserRole.ADMIN_MASTER, UserRole.FISCAL_COMUM, UserRole.FISCAL_ADMIN, UserRole.FINANCEIRO_MASTER]} />
          <NavItem to="/admin" icon={Settings} label="Configurações" roles={[UserRole.ADMIN_MASTER]} />
        </nav>

        <div className="p-6 border-t border-gray-100 bg-white">
          <div className="flex items-center space-x-3 px-4 py-3 mb-4 bg-gray-50 rounded-2xl">
            <div className="bg-white p-2 rounded-xl text-blue-600 shadow-sm">
              <UserCircle size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-tighter truncate">{user?.role}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <button 
              onClick={logout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors font-black text-xs uppercase tracking-widest"
            >
              <RefreshCw size={18} />
              <span>Trocar Conta</span>
            </button>
            <button 
              onClick={logout}
              className="flex items-center space-x-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-black text-xs uppercase tracking-widest"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <header className="h-20 bg-white border-b border-gray-200 flex items-center justify-between px-6 lg:px-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 text-gray-600 lg:hidden hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg lg:text-xl font-black text-gray-800 tracking-tight uppercase italic truncate">
              {location.pathname === '/solicitante' && 'Fluxo de Notas'}
              {location.pathname === '/fiscal' && 'Análise Fiscal'}
              {location.pathname === '/financeiro' && 'Gestão Financeira'}
              {location.pathname === '/admin' && 'Painel Administrativo'}
              {location.pathname === '/stats' && 'Insights e Métricas'}
            </h2>
          </div>
          <div className="flex items-center shrink-0">
            <span className="text-[9px] lg:text-[10px] font-black bg-blue-50 text-blue-600 px-3 lg:px-4 py-1.5 rounded-full tracking-widest uppercase border border-blue-100">V1.3.0</span>
          </div>
        </header>
        <section className="flex-1 overflow-y-auto p-4 lg:p-10 bg-gray-50/50 custom-scrollbar">
          {children}
        </section>
      </main>
    </div>
  );
};

export default Layout;
