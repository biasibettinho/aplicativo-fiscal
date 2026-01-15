
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
      // Busca da lista App_Gestao_Usuarios oficial via GUID fixo
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
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const filteredSpUsers = spUsers.filter(u => 
    (u.EmailUsuario || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.Setor || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.Nivel || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredTenantUsers = tenantUsers.filter(u => 
    u.name?.toLowerCase().includes(tenantSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-4">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar na lista SharePoint..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
          />
        </div>
        <div className="flex space-x-2 w-full md:w-auto">
          <button 
            onClick={loadSpUsers}
            disabled={isLoadingSp}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-black text-[10px] uppercase hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
          >
            {isLoadingSp ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
            Sync SharePoint
          </button>
          <button 
            onClick={loadTenantUsers}
            disabled={isLoadingTenant}
            className="flex-1 md:flex-none flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm"
          >
            {isLoadingTenant ? <RefreshCw size={16} className="animate-spin mr-2" /> : <Globe size={16} className="mr-2" />}
            Sync Tenant
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center">
             <UserCheck size={18} className="text-blue-600 mr-2" />
             <h3 className="text-xs font-black uppercase text-gray-700 tracking-tight italic">Usuários (App_Gestao_Usuarios)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">E-mail</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Perfil</th>
                  <th className="px-6 py-4 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoadingSp ? (
                  <tr><td colSpan={4} className="p-10 text-center"><Loader2 className="animate-spin text-blue-600 mx-auto" size={24} /></td></tr>
                ) : filteredSpUsers.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-gray-300 font-bold uppercase italic text-xs">Vazio</td></tr>
                ) : filteredSpUsers.map((user, idx) => (
                  <tr key={user.Id || idx} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-900 truncate block max-w-[250px]">{user.EmailUsuario}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-blue-50 text-blue-600 border border-blue-100">
                          {user.Setor}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {user.Nivel}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest ${user.Status === 'Ativo' ? 'text-green-600' : 'text-red-400'}`}>
                        {user.Status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors">
                        <Edit3 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b bg-slate-900 text-white flex flex-col space-y-3">
             <div className="flex items-center justify-between">
                <div className="flex items-center">
                   <Globe size={18} className="mr-2 text-blue-400" />
                   <h3 className="text-xs font-black uppercase tracking-widest italic">Tenant Microsoft</h3>
                </div>
                <span className="bg-slate-800 text-[10px] px-2 py-0.5 rounded-full font-bold">{filteredTenantUsers.length}</span>
             </div>
             <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..."
                  value={tenantSearch}
                  onChange={e => setTenantSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-800 border-0 rounded-xl text-xs text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
            {isLoadingTenant ? (
              <div className="p-10 text-center"><Loader2 className="animate-spin text-blue-500 inline" /></div>
            ) : filteredTenantUsers.length === 0 ? (
              <div className="p-10 text-center text-gray-300 font-bold uppercase italic text-[10px]">Nenhum usuário</div>
            ) : filteredTenantUsers.map(tu => {
               const isAlreadyRegistered = spUsers.some(u => (u.EmailUsuario || '').toLowerCase() === tu.email?.toLowerCase());
               return (
                <div key={tu.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group transition-colors">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-[11px] font-black text-gray-900 uppercase italic truncate">{tu.name}</p>
                    <p className="text-[9px] text-gray-400 font-bold truncate tracking-tighter">{tu.email}</p>
                  </div>
                  {isAlreadyRegistered ? (
                    <div className="bg-green-100 p-1.5 rounded-lg text-green-600">
                      <UserCheck size={14} />
                    </div>
                  ) : (
                    <button 
                      className="p-1.5 bg-blue-50 text-blue-600 rounded-lg lg:opacity-0 lg:group-hover:opacity-100 transition-all hover:bg-blue-100"
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
    </div>
  );
};

export default DashboardAdmin;
