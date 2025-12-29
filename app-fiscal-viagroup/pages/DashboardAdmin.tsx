
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../App';
import { User, UserRole } from '../types';
import { microsoftGraphService } from '../services/microsoftGraph';
import { 
  UserPlus, 
  Search, 
  Edit3, 
  UserCheck, 
  UserX,
  Settings,
  Save,
  X,
  RefreshCw,
  Globe,
  Trash2
} from 'lucide-react';

const DashboardAdmin: React.FC = () => {
  const { authState } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [tenantUsers, setTenantUsers] = useState<Partial<User>[]>([]);
  const [search, setSearch] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(false);

  const loadLocalUsers = () => {
    setUsers(db.getUsers());
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
    loadLocalUsers();
    loadTenantUsers();
  }, [authState.token]);

  const handleToggleStatus = (userId: string) => {
    const allUsers = db.getUsers();
    const index = allUsers.findIndex(u => u.id === userId);
    if (index !== -1) {
      allUsers[index].isActive = !allUsers[index].isActive;
      db.saveUsers(allUsers);
      loadLocalUsers();
    }
  };

  const handleDeleteUser = (userId: string) => {
    if (userId === authState.user?.id) {
      alert("Você não pode excluir o seu próprio usuário logado.");
      return;
    }
    
    if (!window.confirm("Tem certeza que deseja excluir permanentemente este usuário do sistema?")) return;
    
    const allUsers = db.getUsers().filter(u => u.id !== userId);
    db.saveUsers(allUsers);
    loadLocalUsers();
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser?.email || !editingUser?.name || !editingUser?.role) return;

    const allUsers = [...db.getUsers()];
    // Busca por ID ou por E-mail (caso seja um usuário do tenant sendo adicionado agora)
    const existingIndex = allUsers.findIndex(u => 
      u.id === editingUser.id || 
      u.email.toLowerCase() === editingUser.email?.toLowerCase()
    );

    if (existingIndex !== -1) {
      // Atualização de usuário existente
      allUsers[existingIndex] = { 
        ...allUsers[existingIndex], 
        ...editingUser as User, 
        updatedAt: new Date().toISOString() 
      };
    } else {
      // Criação de novo usuário (Manual ou vindo do Tenant)
      const newUser: User = {
        id: editingUser.id || Math.random().toString(36).substr(2, 9),
        email: editingUser.email,
        name: editingUser.name,
        role: editingUser.role as UserRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      allUsers.push(newUser);
    }

    db.saveUsers(allUsers);
    loadLocalUsers();
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
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
            placeholder="Buscar usuários locais..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={loadTenantUsers}
            disabled={isLoadingTenant}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
          >
            {isLoadingTenant ? <RefreshCw size={18} className="animate-spin mr-2" /> : <RefreshCw size={18} className="mr-2" />}
            Sincronizar Tenant
          </button>
          <button 
            onClick={() => { setEditingUser({ name: '', email: '', role: UserRole.SOLICITANTE }); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all"
          >
            <UserPlus size={20} className="mr-2" /> Novo Local
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex items-center">
             <UserCheck size={18} className="text-blue-600 mr-2" />
             <h3 className="text-sm font-black uppercase text-gray-700 tracking-tight">Usuários do Sistema</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Papel</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900">{user.name}</span>
                        <span className="text-xs text-gray-500 font-mono">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter ${
                        user.role === UserRole.ADMIN_MASTER ? 'bg-red-100 text-red-700' :
                        user.role.includes('Financeiro') ? 'bg-indigo-100 text-indigo-700' :
                        user.role.includes('Fiscal') ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="text-[10px] font-black uppercase text-green-600">Ativo</span>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-red-400">Inativo</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => { setEditingUser(user); setIsModalOpen(true); }} 
                          className="p-2 text-gray-400 hover:text-blue-600 rounded-lg transition-colors"
                          title="Editar Usuário"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(user.id)} 
                          className="p-2 text-gray-400 hover:text-orange-500 rounded-lg transition-colors"
                          title="Ativar/Desativar"
                        >
                          <Settings size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(user.id)} 
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition-colors"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={16} />
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
            {filteredTenantUsers.map(tu => {
               const isAlreadyRegistered = users.some(u => u.email.toLowerCase() === tu.email?.toLowerCase());
               return (
                <div key={tu.id} className="p-4 flex items-center justify-between hover:bg-gray-50 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{tu.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono truncate">{tu.email}</p>
                  </div>
                  {!isAlreadyRegistered ? (
                    <button 
                      onClick={() => { setEditingUser({ ...tu, role: UserRole.SOLICITANTE }); setIsModalOpen(true); }}
                      className="ml-3 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100"
                    >
                      <UserPlus size={14} />
                    </button>
                  ) : (
                    <UserCheck size={14} className="text-green-500 ml-3" />
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
              <h3 className="text-xl font-bold">{editingUser?.id && users.some(u => u.id === editingUser.id) ? 'Editar Usuário' : 'Novo Cadastro'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X /></button>
            </div>
            <form onSubmit={handleSaveUser} className="p-8 space-y-6">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nome Completo</label>
                <input type="text" required value={editingUser?.name || ''} onChange={e => setEditingUser({...editingUser!, name: e.target.value})} className="w-full p-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">E-mail Corporativo</label>
                <input type="email" required value={editingUser?.email || ''} onChange={e => setEditingUser({...editingUser!, email: e.target.value})} className="w-full p-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Papel no Sistema</label>
                <select required value={editingUser?.role || ''} onChange={e => setEditingUser({...editingUser!, role: e.target.value as UserRole})} className="w-full p-3 bg-gray-50 border-0 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium">
                  <option value={UserRole.SOLICITANTE}>Solicitante</option>
                  <option value={UserRole.FISCAL_COMUM}>Fiscal Comum</option>
                  <option value={UserRole.FISCAL_ADMIN}>Fiscal Admin</option>
                  <option value={UserRole.FINANCEIRO}>Financeiro Comum</option>
                  <option value={UserRole.FINANCEIRO_MASTER}>Financeiro Master</option>
                  <option value={UserRole.ADMIN_MASTER}>Admin Master</option>
                </select>
              </div>
              <div className="flex pt-4 space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl flex items-center justify-center"><Save size={18} className="mr-2" /> Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;
