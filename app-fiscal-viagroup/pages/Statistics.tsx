
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { sharepointService } from '../services/sharepointService';
import { PaymentRequest, RequestStatus } from '../types';
// Adicionada importação do CheckCircle2 para resolver erro de referência na linha 232
import { Loader2, Calendar, MapPin, Filter, BarChart3, PieChart, UserX, Info, RefreshCw, CheckCircle2 } from 'lucide-react';
import { PAYMENT_METHODS } from '../constants';

const Statistics: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [payMethodFilter, setPayMethodFilter] = useState('');

  const loadData = async () => {
    if (!authState.token) return;
    setIsLoading(true);
    try {
      const data = await sharepointService.getRequests(authState.token);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [authState.token]);

  // Filtra dados em memória
  const filteredData = useMemo(() => {
    return requests.filter(r => {
      const rDate = new Date(r.createdAt);
      rDate.setHours(0,0,0,0);
      
      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        matchesDate = rDate.getTime() >= start.getTime();
      }
      if (endDate && matchesDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        matchesDate = rDate.getTime() <= end.getTime();
      }

      const matchesBranch = branchFilter === '' || r.branch === branchFilter;
      const matchesMethod = payMethodFilter === '' || r.paymentMethod === payMethodFilter;

      return matchesDate && matchesBranch && matchesMethod;
    });
  }, [requests, startDate, endDate, branchFilter, payMethodFilter]);

  const branches = useMemo(() => Array.from(new Set(requests.map(r => r.branch))).filter(Boolean).sort(), [requests]);

  // Cálculo Gráfico 1: Fiscal vs Financeiro por Filial
  const fiscalVsFinanceiroData = useMemo(() => {
    const map: Record<string, { fiscal: number; financeiro: number }> = {};
    branches.forEach(b => map[b] = { fiscal: 0, financeiro: 0 });

    filteredData.forEach(r => {
      if (!map[r.branch]) return;
      // Etapa Fiscal: Pendente ou Em Análise
      if ([RequestStatus.PENDENTE, RequestStatus.ANALISE].includes(r.status)) {
        map[r.branch].fiscal++;
      }
      // Etapa Financeiro: Aprovado (Aguardando Financeiro) ou Compartilhado
      if ([RequestStatus.APROVADO, RequestStatus.COMPARTILHADO].includes(r.status)) {
        map[r.branch].financeiro++;
      }
    });

    return Object.entries(map).map(([name, val]) => ({ name, ...val }));
  }, [filteredData, branches]);

  // Cálculo Gráfico 2: Erros por Filial (Pizza)
  const errorDistribution = useMemo(() => {
    const errorItems = filteredData.filter(r => 
      r.status === RequestStatus.ERRO_FISCAL || 
      r.status === RequestStatus.ERRO_FINANCEIRO
    );
    
    if (errorItems.length === 0) return [];

    const counts: Record<string, number> = {};
    errorItems.forEach(r => {
      counts[r.branch] = (counts[r.branch] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value, percentage: (value / errorItems.length) * 100 }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  // Cálculo Gráfico 3: Erros por Usuário (Top 5)
  const userErrorsRank = useMemo(() => {
    const errorItems = filteredData.filter(r => 
      r.status === RequestStatus.ERRO_FISCAL || 
      r.status === RequestStatus.ERRO_FINANCEIRO
    );
    
    const counts: Record<string, number> = {};
    errorItems.forEach(r => {
      const name = r.createdByName || 'N/A';
      counts[name] = (counts[name] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredData]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-20">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
        <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">Processando Big Data Corporativo...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {/* Filtros */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-wrap items-end gap-6">
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 flex items-center"><Calendar size={10} className="mr-1"/> Período De</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 flex items-center"><Calendar size={10} className="mr-1"/> Até</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 flex items-center"><MapPin size={10} className="mr-1"/> Filial</label>
          <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none min-w-[150px]">
            <option value="">Todas</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1 flex items-center"><Filter size={10} className="mr-1"/> Método</label>
          <select value={payMethodFilter} onChange={e => setPayMethodFilter(e.target.value)} className="px-4 py-2.5 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none min-w-[150px]">
            <option value="">Todos</option>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={loadData} className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all"><RefreshCw size={20}/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico 1: Fiscal vs Financeiro por Filial */}
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-10">
            <h3 className="text-sm font-black text-gray-800 uppercase italic tracking-tight flex items-center">
              <BarChart3 size={18} className="mr-3 text-blue-600" /> Demandas por Etapa Ativa
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center"><div className="w-2 h-2 bg-amber-400 rounded-full mr-1"></div><span className="text-[8px] font-bold text-gray-400 uppercase">Fiscal</span></div>
              <div className="flex items-center"><div className="w-2 h-2 bg-indigo-500 rounded-full mr-1"></div><span className="text-[8px] font-bold text-gray-400 uppercase">Financeiro</span></div>
            </div>
          </div>
          
          <div className="flex-1 flex items-end justify-between px-4 h-[250px] gap-4">
            {fiscalVsFinanceiroData.map((d, i) => {
              const max = Math.max(...fiscalVsFinanceiroData.map(x => x.fiscal + x.financeiro), 1);
              return (
                <div key={i} className="flex flex-col items-center flex-1 group">
                  <div className="w-full flex items-end justify-center space-x-1 h-full relative">
                     <div 
                      style={{ height: `${(d.fiscal / max) * 100}%` }} 
                      className="w-1/3 bg-amber-400 rounded-t-lg transition-all duration-500 group-hover:brightness-110 shadow-sm min-h-[4px]"
                      title={`Fiscal: ${d.fiscal}`}
                     />
                     <div 
                      style={{ height: `${(d.financeiro / max) * 100}%` }} 
                      className="w-1/3 bg-indigo-500 rounded-t-lg transition-all duration-500 group-hover:brightness-110 shadow-sm min-h-[4px]"
                      title={`Financeiro: ${d.financeiro}`}
                     />
                  </div>
                  <span className="text-[8px] font-black text-gray-400 uppercase mt-4 rotate-[-15deg] truncate w-full text-center">{d.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Gráfico 2: Distribuição de Erros por Filial (Pizza Nativa) */}
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col">
          <h3 className="text-sm font-black text-gray-800 uppercase italic tracking-tight mb-8 flex items-center">
            <PieChart size={18} className="mr-3 text-red-600" /> % Concentração de Erros
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-around flex-1 gap-8">
            {errorDistribution.length > 0 ? (
              <>
                <div className="relative w-48 h-48 rounded-full shadow-2xl border-[12px] border-gray-50 flex items-center justify-center overflow-hidden" 
                     style={{ 
                       background: `conic-gradient(
                         #ef4444 0% ${errorDistribution[0]?.percentage || 0}%, 
                         #f97316 ${errorDistribution[0]?.percentage || 0}% ${(errorDistribution[0]?.percentage || 0) + (errorDistribution[1]?.percentage || 0)}%,
                         #facc15 ${(errorDistribution[0]?.percentage || 0) + (errorDistribution[1]?.percentage || 0)}% 100%
                       )`
                     }}>
                   <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                      <span className="text-xl font-black text-slate-800 leading-none">{errorDistribution.reduce((a,b) => a + b.value, 0)}</span>
                      <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">Erros Totais</span>
                   </div>
                </div>
                <div className="space-y-3 min-w-[150px]">
                  {errorDistribution.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <div className="flex items-center">
                        <div className={`w-2.5 h-2.5 rounded-sm mr-2 ${i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-400'}`}></div>
                        <span className="text-[10px] font-bold text-gray-600 uppercase truncate max-w-[100px]">{d.name}</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-800">{d.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-300 italic">
                <CheckCircle2 size={40} className="text-green-500 mb-2 opacity-20" />
                <p className="text-[10px] font-bold uppercase tracking-widest">Nenhum erro detectado no período</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 3: Top Erros por Usuário (Barras Horizontais) */}
        <div className="bg-white p-8 rounded-[3rem] border border-gray-100 shadow-sm flex flex-col lg:col-span-2">
          <h3 className="text-sm font-black text-gray-800 uppercase italic tracking-tight mb-8 flex items-center">
            <UserX size={18} className="mr-3 text-red-600" /> Ranking de Retrabalho por Colaborador (Top 5)
          </h3>
          <div className="space-y-6">
            {userErrorsRank.length > 0 ? userErrorsRank.map((u, i) => {
              const maxCount = Math.max(...userErrorsRank.map(x => x.count), 1);
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-tight italic flex items-center">
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[9px] mr-2">#{i+1}</span>
                      {u.name}
                    </span>
                    <span className="text-xs font-black text-red-600">{u.count} Erros</span>
                  </div>
                  <div className="h-3 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div 
                      style={{ width: `${(u.count / maxCount) * 100}%` }} 
                      className="h-full bg-gradient-to-r from-red-400 to-red-600 rounded-full transition-all duration-700 delay-200 shadow-sm"
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-10 text-gray-300 font-bold uppercase italic text-xs opacity-50">Dados de performance impecável</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-600 p-8 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between shadow-2xl shadow-blue-200">
        <div className="flex items-center mb-4 md:mb-0">
          <div className="p-3 bg-white/20 rounded-2xl mr-4"><Info size={24}/></div>
          <div>
            <h4 className="text-lg font-black uppercase italic tracking-tighter">Resumo Executivo</h4>
            <p className="text-blue-100 text-xs font-medium uppercase tracking-widest opacity-80">Processamento de dados em tempo real da nuvem</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 w-full md:w-auto">
          <div className="text-center">
            <p className="text-2xl font-black">{filteredData.length}</p>
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-[0.2em]">Total Notas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-green-400">{filteredData.filter(r => r.status === RequestStatus.FATURADO).length}</p>
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-[0.2em]">Liquidadas</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-amber-400">{filteredData.filter(r => [RequestStatus.PENDENTE, RequestStatus.ANALISE].includes(r.status)).length}</p>
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-[0.2em]">Fila Fiscal</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400">{filteredData.filter(r => r.status.includes('Erro')).length}</p>
            <p className="text-[8px] font-black text-blue-200 uppercase tracking-[0.2em]">Erros/Recusas</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
