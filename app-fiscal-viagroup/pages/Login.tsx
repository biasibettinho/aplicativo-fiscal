
import React, { useState } from 'react';
import { useAuth } from '../App';
import { Lock, Mail, Loader2, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMsLoading, setIsMsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const currentUri = window.location.origin.replace(/\/$/, "");

  const handleCopyUri = () => {
    navigator.clipboard.writeText(currentUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleMicrosoftLogin = async () => {
    setIsMsLoading(true);
    setError('');
    try {
      const authData = await authService.loginWithMicrosoft();
      localStorage.setItem('sispag_session', JSON.stringify(authData));
      window.location.reload();
    } catch (err: any) {
      // Se for erro de Redirect URI, damos a instrução clara
      if (err.message?.includes('AADSTS50011')) {
        setError('URL não autorizada no Azure. Copie a URL abaixo e adicione em "SPA" no Portal do Azure.');
      } else {
        setError(err.message || 'Erro ao conectar com Microsoft');
      }
    } finally {
      setIsMsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      const { db } = await import('../services/db');
      const users = db.getUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.isActive);
      
      if (user) {
        const newState = { user, isAuthenticated: true, token: 'fake-jwt-' + user.id };
        localStorage.setItem('sispag_session', JSON.stringify(newState));
        window.location.reload();
      } else {
        throw new Error('Usuário não encontrado ou inativo.');
      }
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <img 
              src="https://viagroup.com.br/assets/via_group-22fac685.png" 
              alt="Via Group" 
              className="h-12 w-auto" 
            />
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-black text-gray-900 tracking-tight">App Fiscal</h2>
        <p className="mt-2 text-center text-sm text-gray-600 font-medium uppercase tracking-widest">Acesso Corporativo</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-4 shadow-2xl sm:rounded-[2rem] sm:px-10 border border-gray-100">
          
          <button
            onClick={handleMicrosoftLogin}
            disabled={isMsLoading}
            className="w-full flex items-center justify-center py-4 px-4 border border-gray-200 rounded-2xl shadow-sm text-sm font-black text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all mb-4 border-b-4 border-gray-300 active:border-b-0 active:translate-y-1"
          >
            {isMsLoading ? (
              <Loader2 className="animate-spin h-5 w-5 mr-3" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5 mr-3" alt="MS" />
            )}
            Entrar com Conta Microsoft
          </button>

          {error && error.includes('URL não autorizada') && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-amber-800 uppercase mb-2">{error}</p>
              <div className="flex items-center bg-white border border-amber-200 rounded-lg p-2">
                <code className="text-[9px] flex-1 truncate font-mono text-amber-900">{currentUri}</code>
                <button 
                  onClick={handleCopyUri}
                  className="ml-2 p-1.5 text-amber-600 hover:bg-amber-100 rounded-md transition-colors"
                >
                  {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest">
              <span className="px-4 bg-white text-gray-400">Ou use e-mail interno</span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Usuário</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 font-medium outline-none"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-2xl focus:ring-2 focus:ring-blue-500 font-medium outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && !error.includes('URL não autorizada') && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-xl">
                <p className="text-xs font-bold text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-4 px-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200"
            >
              {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Acessar Sistema'}
            </button>
          </form>

          <div className="mt-8 flex justify-center">
             <div className="flex items-center space-x-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                <ShieldCheck size={14} className="text-green-500" />
                <span>Ambiente Seguro Via Group</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
