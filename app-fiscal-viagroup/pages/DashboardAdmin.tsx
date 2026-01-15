
import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { sharepointService } from '../services/sharepointService';
import { 
  Search, 
  Edit3, 
  UserCheck, 
  RefreshCw,
  Loader2,
  User as UserIcon,
  UserPlus,
  Trash2,
  X,
  Save,
  Mail,
  ShieldAlert,
  Briefcase
} from 'lucide-react';

const DashboardAdmin: React.FC = () => {
  const { authState } = useAuth();
  const [spUsers, setSpUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoadingSp, setIsLoadingSp] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estado para o Formulário do Modal
  const [formData, setFormData] = useState({
    Id: 0,
    EmailUsuario: '',
    Setor: 'Solicitante',
    Nivel: 'Comum'
  });

  const formatNameFromEmail = (email: string) => {
    if (!email) return 'USUÁRIO SEM NOME';
    return email.split('@')[0].replace(/[\._]/g, ' ').toUpperCase();
  };

  const loadSpUsers = async () => {
    setIsLoadingSp(true);
    try {
      const users = await sharepointService.getAllSharePointUsers();
      if (users && users.length > 0) {
        setSpUsers(users);
      } else {
        setSpUsers([]);
      }
    } catch (e) {
      console.error("DashboardAdmin: Erro crítico ao carregar usuários:", e);
      setSpUsers([]);
    } finally {
      setIsLoadingSp(false);
    }
  };

  useEffect(() => {
    loadSpUsers();
  }, [authState.token]);

  const handleOpenCreate = () => {
    setFormData({ Id: 0, EmailUsuario: '', Setor: 'Solicitante', Nivel: 'Comum' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setFormData({
      Id: user.Id || user.ID,
      EmailUsuario: user.EmailUsuario,
      Setor: user.Setor || 'Solicitante',
      Nivel: user.Nivel || 'Comum'
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja remover este acesso? Esta ação é irreversível.")) return;
    
    setIsLoadingSp(true);
    try {
      const success = await sharepointService.deleteSharePointUser(id);
      if (success) {
        alert("Usuário removido com sucesso.");
        loadSpUsers();
      } else {
        alert("Falha ao remover usuário.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = {
      EmailUsuario: formData.EmailUsuario.toLowerCase().trim(),
      Setor: formData.Setor,
      Nivel: formData.Nivel,
      Title: formatNameFromEmail(formData.EmailUsuario)
    };

    try {
      let success = false;
      if (formData.Id === 0) {
        success = await sharepointService.addSharePointUser(payload);
      } else {
        success = await sharepointService.updateSharePointUser(formData.Id, payload);
      }

      if (success) {
        setIsModalOpen(false);
        loadSpUsers();
      } else {
        alert("Erro ao salvar alterações no SharePoint.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSpUsers = spUsers.filter(u => 
    (u.EmailUsuario || '').toLowerCase().includes(search.toLowerCase()) ||
    (formatNameFromEmail(u.EmailUsuario)).includes(search.toUpperCase()) ||
    (u.Setor || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.Nivel || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100 gap-4">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, e-mail, setor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
          />
        </div>
        <div className="flex space-x-3 w-full md:w-auto">
          <button 
            onClick={loadSpUsers}
            disabled={isLoadingSp}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black text-[10px] uppercase hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {isLoadingSp ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
            Sincronizar
          </button>
          <button 
            onClick={handleOpenCreate}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg active:scale-95 shadow-blue-500/20"
          >
            <UserPlus size={16} className="mr-2" />
            Novo Usuário
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b bg-gray-50/50 flex items-center justify-between">
             <div className="flex items-center">
                <UserCheck size={20} className="text-blue-600 mr-3" />
                <h3 className="text-sm font-black uppercase text-gray-700 tracking-tight italic">Gestão de Colaboradores</h3>
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{filteredSpUsers.length} Cadastros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/30">
                <tr>
                  <th className="px-8 py-5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Colaborador / E-mail</th>
                  <th className="px-8 py-5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Setor / Departamento</th>
                  <th className="px-8 py-5 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest">Nível de Acesso</th>
                  <th className="px-8 py-5 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {isLoadingSp ? (
                  <tr><td colSpan={4} className="p-20 text-center"><Loader2 className="animate-spin text-blue-600 mx-auto" size={32} /></td></tr>
                ) : filteredSpUsers.length === 0 ? (
                  <tr><td colSpan={4} className="p-20 text-center text-gray-300 font-bold uppercase italic text-xs">Nenhum registro localizado</td></tr>
                ) : filteredSpUsers.map((user, idx) => (
                  <tr key={user.Id || idx} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4 shadow-sm group-hover:scale-110 transition-transform">
                          <UserIcon size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 uppercase italic leading-tight">{formatNameFromEmail(user.EmailUsuario)}</span>
                          <span className="text-[10px] font-bold text-slate-400 truncate max-w-[250px]">{user.EmailUsuario}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-blue-50 text-blue-600 border border-blue-100">
                        {user.Setor}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${user.Nivel === 'Master' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                        {user.Nivel}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleOpenEdit(user)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Editar"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(user.Id || user.ID)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Remover"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal CRUD */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl relative border border-gray-100 animate-in zoom-in duration-200">
            <header className="bg-blue-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <UserPlus size={20} />
                <h3 className="text-lg font-black uppercase italic tracking-tight">{formData.Id === 0 ? 'Cadastrar Acesso' : 'Editar Acesso'}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform"><X size={20}/></button>
            </header>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center">
                    <Mail size={12} className="mr-2" /> E-mail Institucional
                  </label>
                  <input 
                    required
                    type="email"
                    placeholder="usuario@viagroup.com.br"
                    value={formData.EmailUsuario}
                    onChange={e => setFormData({ ...formData, EmailUsuario: e.target.value })}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  />
                  {formData.EmailUsuario && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Nome que será exibido:</p>
                      <p className="text-xs font-black text-blue-800 uppercase italic truncate">{formatNameFromEmail(formData.EmailUsuario)}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center">
                      <Briefcase size={12} className="mr-2" /> Setor
                    </label>
                    <select 
                      value={formData.Setor}
                      onChange={e => setFormData({ ...formData, Setor: e.target.value })}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Solicitante">Solicitante</option>
                      <option value="Fiscal">Fiscal</option>
                      <option value="Financeiro">Financeiro</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 flex items-center">
                      <ShieldAlert size={12} className="mr-2" /> Nível
                    </label>
                    <select 
                      value={formData.Nivel}
                      onChange={e => setFormData({ ...formData, Nivel: e.target.value })}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Comum">Comum</option>
                      <option value="Master">Master</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="flex-1 py-4 text-[10px] font-black uppercase text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  disabled={isSubmitting}
                  type="submit" 
                  className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-700 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save className="mr-2" size={16} />}
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;
