
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../App';
import { User, UserRole } from '../types';
import { microsoftGraphService } from '../services/microsoftGraph';
import { sharepointService } from '../services/sharepointService';
import { 
  UserPlus, 
  Search, 
  Edit3, 
  UserCheck, 
  Settings,
  Save,
  X,
  RefreshCw,
  Globe,
  Trash2,
  Loader2
} from 'lucide-react';

const DashboardAdmin: React.FC = () => {
  const { authState } = useAuth();
  const [spUsers, setSpUsers] = useState<any[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Partial<User>[]>([]);
  const [search, setSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [isLoadingSp, setIsLoadingSp] = useState(false);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);

  const loadSpUsers = async () => {
    setIsLoadingSp(true);
    try {
      const users = await sharepointService.getAllSharePointUsers();
      setSpUsers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSp(false);
    }
  };

  const loadTenantUsers = async () => {
    if (!authState.token) return;
    setIsLoadingTenant(true);
    try {
      const users = await microsoftGraphService.fetchTenantUsers(authState.token);
      setTenantUsers(users);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingTenant(false);
    }
  };

  useEffect(() => {
    loadSpUsers();
    loadTenantUsers();
  }, [authState.token]);

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    // Nota: Por restrição, não alteramos lógica de gravação, apenas exibição.
    // Em um sistema real, aqui você dispararia um update para a lista App_Gestao_Usuarios
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const filteredSpUsers = spUsers.filter(u => 
    (u.EmailUsuario || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.Setor || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredTenantUsers = tenantUsers.filter(u => 
    u.name?.toLowerCase().includes(tenantSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar na lista SharePoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={loadSpUsers}
            disabled={isLoadingSp}
            className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all border border-blue-100"
          >
            {isLoadingSp ? <Loader2 size={18} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
            Atualizar SharePoint
          </button>
          <button 
            onClick={loadTenantUsers}
            disabled={isLoadingTenant}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            {isLoadingTenant ? <RefreshCw size={18} className="animate-spin mr-2" /> : <Globe size={18} className="mr-2" />}
            Sincronizar Tenant
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center">
             <UserCheck size={18} className="text-blue-600 mr-2" />
             <h3 className="text-sm font-black uppercase text-gray-700 tracking-tight">Usuários do Sistema (SharePoint)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Papel (Setor + Nível)</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoadingSp ? (
                  <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">Carregando lista SharePoint...</td></tr>
                ) : filteredSpUsers.map((user, idx) => (
                  <tr key={user.Id || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{user.EmailUsuario || 'Sem e-mail'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter bg-gray-100 text-gray-600`}>
                        {user.Setor} {user.Nivel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase ${user.Status === 'Ativo' ? 'text-green-600' : 'text-red-400'}`}>
                        {user.Status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                          title="Editar (Visualização)"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b bg-indigo-900 text-white flex flex-col space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center">
                   <Globe size={18} className="mr-2 text-indigo-300" />
                   <h3 className="text-sm font-black uppercase tracking-tight">Usuários do Tenant</h3>
                </div>
                <span className="bg-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredTenantUsers.length}</span>
             </div>
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-300" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar no Tenant..."
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-indigo-800/50 border-0 rounded-lg text-xs text-white placeholder:text-indigo-300 outline-none focus:ring-1 focus:ring-indigo-400"
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {isLoadingTenant ? (
              <div className="p-10 text-center"><Loader2 className="animate-spin text-indigo-300 inline" /></div>
            ) : filteredTenantUsers.map(tu => {
               const isAlreadyRegistered = spUsers.some(u => (u.EmailUsuario || '').toLowerCase() === tu.email?.toLowerCase());
               return (
                <div key={tu.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{tu.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate">{tu.email}</p>
                  </div>
                  {isAlreadyRegistered ? (
                    <UserCheck size={14} className="text-green-500 ml-3" />
                  ) : (
                    <button 
                      className="ml-3 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100"
                    >
                      <UserPlus size={14} />
                    </button>
                  )}
                </div>
               );
            })}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gray-900 p-6 flex justify-between items-center text-white">
              <h3 className="text-xl font-bold">Gerenciar Usuário</h3>
              <button onClick={() => setIsModalOpen(false)}><X /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">E-mail Corporativo</label>
                <input type="email" disabled value={editingUser?.email || ''} className="w-full p-3 bg-gray-50 border-0 rounded-xl outline-none font-mono opacity-50" />
              </div>
              <p className="text-[10px] text-gray-400 italic">As alterações de papel devem ser feitas diretamente na lista App_Gestao_Usuarios no SharePoint para refletir no sistema.</p>
              <div className="flex pt-4 space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Fechar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;
