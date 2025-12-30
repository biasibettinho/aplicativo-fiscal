
import React, { useState } from 'react';
import { useAuth } from '../App';
import { Loader2, ShieldCheck, Copy, CheckCircle2 } from 'lucide-react';
import { authService } from '../services/authService';

const Login: React.FC = () => {
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
      if (err.message?.includes('AADSTS50011')) {
        setError('URL não autorizada no Azure. Adicione a URL abaixo nas configurações do app.');
      } else {
        setError(err.message || 'Erro ao conectar com Microsoft');
      }
    } finally {
      setIsMsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img 
          src="https://viagroup.com.br/assets/via_group-22fac685.png" 
          alt="Via Group Logo" 
          className="h-20 mb-6 drop-shadow-2xl"
        />
        <h2 className="text-center text-2xl font-black text-white tracking-tighter uppercase italic">App Fiscal</h2>
        <p className="mt-2 text-center text-[10px] text-blue-400 font-black uppercase tracking-[0.3em]">Ambiente Seguro Via Group</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white/5 backdrop-blur-xl py-12 px-10 shadow-2xl rounded-[3rem] border border-white/10 flex flex-col items-center">
          
          <button
            onClick={handleMicrosoftLogin}
            disabled={isMsLoading}
            className="w-full flex items-center justify-center py-5 px-6 bg-white rounded-2xl shadow-xl text-sm font-black text-slate-900 hover:bg-gray-100 transition-all mb-8 border-b-4 border-gray-300 active:border-b-0 active:translate-y-1"
          >
            {isMsLoading ? (
              <Loader2 className="animate-spin h-5 w-5 mr-3" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5 mr-3" alt="MS" />
            )}
            ENTRAR COM CONTA CORPORATIVA
          </button>

          {error && error.includes('URL não autorizada') && (
            <div className="w-full mb-6 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-500 uppercase mb-2 leading-tight">{error}</p>
              <div className="flex items-center bg-black/20 rounded-lg p-2">
                <code className="text-[9px] flex-1 truncate font-mono text-amber-200">{currentUri}</code>
                <button 
                  onClick={handleCopyUri}
                  className="ml-2 p-1.5 text-amber-500 hover:bg-white/10 rounded-md transition-colors"
                >
                  {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          )}

          {!error && (
            <p className="text-center text-white/30 text-[10px] font-medium uppercase tracking-widest max-w-[250px]">
              Utilize suas credenciais do Microsoft 365 para acessar o portal de lançamentos fiscais.
            </p>
          )}

          <div className="mt-12 flex items-center space-x-3 text-[10px] text-white/40 font-black uppercase tracking-tighter">
            <ShieldCheck size={16} className="text-green-500" />
            <span>Digital Security Verified</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
