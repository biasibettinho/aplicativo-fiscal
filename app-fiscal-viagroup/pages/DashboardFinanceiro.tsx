
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus, User, UserRole } from '../types';
import { requestService } from '../services/requestService';
import { db } from '../services/db';
import Badge from '../components/Badge';
import { isHighPriority, BRANCHES } from '../constants';
import { 
  Search, Banknote, XCircle, CheckCircle, AlertTriangle, Hash, Filter, Calendar
} from 'lucide-react';

const DashboardFinanceiro: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorType, setErrorType] = useState('Nota fiscal não localizada para faturamento');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    // Filtra apenas o que é pertinente ao financeiro
    const financeOnly = data.filter(r => ![RequestStatus.PENDENTE, RequestStatus.ANALISE, RequestStatus.ANALISE_FISCAL].includes(r.status));
    setRequests(financeOnly);
  };

  useEffect(() => { 
    loadData(); 
    const t = setInterval(loadData, 15000); 
    return () => clearInterval(t); 
  }, [authState.user, authState.token]);

  const filteredRequests = useMemo(() => {
    return requests
      .filter(r => {
        const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.toString().includes(searchTerm);
        const matchesBranch = branchFilter === '' || r.branch === branchFilter;
        return matchesSearch && matchesBranch;
      })
      .sort((a, b) => {
        const priorityA = isHighPriority(a.paymentDate) ? 1 : 0;
        const priorityB = isHighPriority(b.paymentDate) ? 1 : 0;
        
        // Prioridade 1: Vencimento < 3 dias
        if (priorityA !== priorityB) return priorityB - priorityA;
        
        // Prioridade 2: Data de criação (mais recentes primeiro)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [requests, searchTerm, branchFilter]);

  const selectedRequest = filteredRequests.find(r => r.id === selectedId);

  const handleFaturar = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    const nextStatus = (authState.user.role === UserRole.FINANCEIRO_MASTER || authState.user.role === UserRole.ADMIN_MASTER) ? RequestStatus.FATURADO : RequestStatus.ANALISE_FINANCEIRO;
    await requestService.changeStatus(selectedId, nextStatus, authState.token);
    await loadData();
    setSelectedId(null);
  };

  const handleReject = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    await requestService.updateRequest(selectedId, { 
      status: RequestStatus.ERRO_FINANCEIRO, 
      errorType, 
      errorObservation: rejectReason 
    }, authState.token);
    await loadData();
    setIsRejectModalOpen(false);
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex justify-between items-center shadow-sm">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input type="text" placeholder="Filtrar faturas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border-0 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
        </div>
        <div className="flex items-center space-x-4">
           <Filter size={16} className="text-gray-400" />
           <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="p-2 bg-gray-50 border-0 rounded-lg text-xs font-bold uppercase outline-none cursor-pointer">
             <option value="">Todas as Filiais</option>
             {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
           </select>
        </div>
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredRequests.map(r => {
              const urgent = isHighPriority(r.paymentDate);
              return (
                <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-indigo-50 border-r-4 border-indigo-600' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono text-gray-400 font-bold">#{r.id.substring(0,8)}</span>
                      {urgent && <AlertTriangle size={14} className="text-red-600 animate-bounce" />}
                    </div>
                    <Badge status={r.status} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm truncate">{r.title}</h4>
                  <div className="flex justify-between mt-2 items-center">
                    <div className="flex items-center text-[10px] font-black uppercase tracking-tighter">
                       <Calendar size={10} className="mr-1" />
                       <span className={urgent ? 'text-red-600' : 'text-gray-500'}>{new Date(r.paymentDate).toLocaleDateString()}</span>
                    </div>
                    <span className="text-xs font-black text-indigo-700">R$ {r.budgetValue?.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {selectedRequest ? (
            <>
              <div className="p-8 border-b flex justify-between items-center bg-indigo-50/10">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mt-1">Fluxo Financeiro • #{selectedRequest.id}</p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setIsRejectModalOpen(true)} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-black text-[10px] uppercase border border-red-100 hover:bg-red-100 transition-colors">Reprovar</button>
                  <button onClick={handleFaturar} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">Aprovar / Faturar</button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-8">
                {isHighPriority(selectedRequest.paymentDate) && (
                  <div className="bg-red-50 border border-red-200 p-5 rounded-3xl flex items-center space-x-5 animate-pulse">
                    <div className="bg-red-600 text-white p-3 rounded-2xl shadow-lg"><AlertTriangle size={28} /></div>
                    <div>
                      <h4 className="text-[11px] font-black text-red-700 uppercase tracking-widest">Ação Prioritária Necessária</h4>
                      <p className="text-sm font-bold text-red-900">Vencimento em {new Date(selectedRequest.paymentDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center"><Hash size={12} className="mr-1" /> Nota Fiscal</h4>
                    <p className="text-2xl font-black text-gray-900">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 shadow-inner">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase mb-3">Favorecido / Recebedor</h4>
                    <p className="text-2xl font-black text-gray-900">{selectedRequest.payee || '---'}</p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-200">
              <Banknote size={80} className="opacity-10 mb-6" />
              <p className="font-black uppercase text-[12px] tracking-widest text-gray-300">Painel de Faturamento Financeiro</p>
            </div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black text-red-600 uppercase mb-8 tracking-tighter">Reprovar para Correção</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Categoria do Erro</label>
                <select value={errorType} onChange={e => setErrorType(e.target.value)} className="w-full p-4 bg-gray-50 border-0 rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-red-500 outline-none appearance-none">
                  <option value="Nota fiscal não localizada para faturamento">NF não localizada</option>
                  <option value="Dados Bancários Inválidos">Dados Bancários Inválidos</option>
                  <option value="Valor Divergente">Valor Divergente</option>
                  <option value="Falta Anexo Obrigatório">Falta Anexo</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Instruções para o Solicitante</label>
                <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Detalhe o que precisa ser corrigido..." className="w-full p-6 bg-gray-50 border-0 rounded-3xl outline-none resize-none font-medium placeholder:text-gray-300" />
              </div>
            </div>
            <div className="flex space-x-4 mt-10">
              <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 font-black text-gray-500 uppercase text-xs hover:bg-gray-50 rounded-2xl transition-colors">Cancelar</button>
              <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs shadow-xl shadow-red-100 disabled:opacity-50">Confirmar Reprovação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFinanceiro;
