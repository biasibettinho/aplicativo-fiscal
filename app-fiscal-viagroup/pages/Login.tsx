
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
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-['Inter']">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img 
          src="https://viagroup.com.br/assets/via_group-22fac685.png" 
          alt="Via Group Logo" 
          className="h-24 mb-8"
        />
        <h2 className="text-center text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Fluxo de Notas</h2>
        <p className="mt-2 text-center text-[11px] text-blue-600 font-black uppercase tracking-[0.4em] mb-10">Ambiente Interno Corporativo</p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-gray-50 py-12 px-10 shadow-xl rounded-[3.5rem] border border-gray-100 flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-600/5 rounded-full -mr-12 -mt-12"></div>
          
          <button
            onClick={handleMicrosoftLogin}
            disabled={isMsLoading}
            className="w-full flex items-center justify-center py-5 px-6 bg-white border border-gray-200 rounded-2xl shadow-md text-sm font-black text-slate-900 hover:bg-gray-100 transition-all mb-8 active:scale-95"
          >
            {isMsLoading ? (
              <Loader2 className="animate-spin h-5 w-5 mr-3" />
            ) : (
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" className="h-5 w-5 mr-3" alt="MS" />
            )}
            ENTRAR COM CONTA MICROSOFT
          </button>

          {error && (
            <div className="w-full mb-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold text-amber-700 uppercase mb-2 leading-tight">{error}</p>
              <div className="flex items-center bg-white rounded-lg p-2 border border-amber-100">
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

          <p className="text-center text-gray-400 text-[10px] font-bold uppercase tracking-widest max-w-[280px] leading-relaxed">
            Utilize suas credenciais da Microsoft para acessar os serviços internos.
          </p>

          <div className="mt-12 flex items-center space-x-3 text-[10px] text-gray-400 font-black uppercase tracking-tighter">
            <ShieldCheck size={16} className="text-green-500" />
            <span>Conexão Segura Via Group</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
