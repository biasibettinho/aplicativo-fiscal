
import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../App';
import { User, UserRole } from '../types';
import { sharepointService } from '../services/sharepointService';
import { 
  Search, 
  Edit3, 
  UserCheck, 
  RefreshCw,
  Loader2,
  User as UserIcon
} from 'lucide-react';

const DashboardAdmin: React.FC = () => {
  const { authState } = useAuth();
  const [spUsers, setSpUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoadingSp, setIsLoadingSp] = useState(false);

  const loadSpUsers = async () => {
    setIsLoadingSp(true);
    try {
      const users = await sharepointService.getAllSharePointUsers();
      
      console.log("DashboardAdmin: Tentando carregar usuários do SharePoint...");
      console.log("Resposta bruta da API:", users);
      
      if (users && users.length > 0) {
        // CORREÇÃO: Mapeamento usando 'Title' para o Nome e removendo 'Status' literal do banco
        const mappedUsers = users.map((u: any) => ({
          Id: u.Id || u.ID,
          Nome: u.Title || 'Sem Nome',
          EmailUsuario: u.EmailUsuario || 'Sem e-mail',
          Setor: u.Setor || 'N/A',
          Nivel: u.Nivel || 'N/A',
          Status: 'Ativo' // Assume Ativo por padrão pois a coluna não existe no banco
        }));
        setSpUsers(mappedUsers);
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

  const filteredSpUsers = spUsers.filter(u => 
    (u.EmailUsuario || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.Nome || '').toLowerCase().includes(search.toLowerCase()) ||
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
            placeholder="Buscar por nome, e-mail, setor ou nível..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold"
          />
        </div>
        <div className="flex space-x-2 w-full md:w-auto">
          <button 
            onClick={loadSpUsers}
            disabled={isLoadingSp}
            className="flex-1 md:flex-none flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {isLoadingSp ? <Loader2 size={16} className="animate-spin mr-2" /> : <RefreshCw size={16} className="mr-2" />}
            Sincronizar SharePoint
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b bg-gray-50/50 flex items-center justify-between">
             <div className="flex items-center">
                <UserCheck size={20} className="text-blue-600 mr-3" />
                <h3 className="text-sm font-black uppercase text-gray-700 tracking-tight italic">Gestão de Acessos (App_Gestao_Usuarios)</h3>
             </div>
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{filteredSpUsers.length} Usuários Encontrados</span>
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
                  <tr><td colSpan={4} className="p-20 text-center text-gray-300 font-bold uppercase italic text-xs">Nenhum registro localizado no SharePoint</td></tr>
                ) : filteredSpUsers.map((user, idx) => (
                  <tr key={user.Id || idx} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mr-4">
                          <UserIcon size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-800 uppercase italic leading-tight">{user.Nome}</span>
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
                      <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-indigo-50 text-indigo-600 border border-indigo-100">
                        {user.Nivel}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                        <Edit3 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAdmin;
