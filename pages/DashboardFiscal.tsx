
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { db } from '../services/db';
import { BRANCHES } from '../constants';
import Badge from '../components/Badge';
import { 
  Search, 
  CheckCircle, 
  XCircle, 
  FileSearch, 
  FileText, 
  ExternalLink, 
  CreditCard,
  Calendar,
  AlertTriangle,
  Info,
  Paperclip,
  MapPin,
  Filter,
  Hash
} from 'lucide-react';

const DashboardFiscal: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [errorType, setErrorType] = useState('Erro nos Anexos');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();

  const loadData = async () => {
    if (!authState.user || !authState.token) return;
    const data = await requestService.getRequestsFiltered(authState.user, authState.token);
    setRequests(data);
  };

  useEffect(() => {
    loadData();
    const t = setInterval(loadData, 15000);
    return () => clearInterval(t);
  }, [authState.user, authState.token]);

  const selectedRequest = requests.find(r => r.id === selectedId);

  const handleApprove = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    await requestService.changeStatus(selectedId, RequestStatus.APROVADO, authState.token, 'Fiscal validou dados e anexos.');
    await loadData();
    setSelectedId(null);
  };

  const handleReject = async () => {
    if (!selectedId || !authState.user || !authState.token) return;
    await requestService.updateRequest(selectedId, {
      status: RequestStatus.ERRO_FISCAL,
      errorType: errorType,
      errorObservation: rejectReason
    }, authState.token);
    await loadData();
    setIsRejectModalOpen(false);
    setRejectReason('');
    setSelectedId(null);
  };

  const handleViewFile = (base64Data: string) => {
    try {
      const parts = base64Data.split(';base64,');
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) uInt8Array[i] = raw.charCodeAt(i);
      const blob = new Blob([uInt8Array], { type: contentType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      window.open(base64Data, '_blank');
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      const matchesSearch = 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.id.toString().includes(searchTerm) ||
        r.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = true;
      if (statusFilter === 'pending') {
        matchesStatus = r.status === RequestStatus.PENDENTE;
      } else if (statusFilter === 'analysis') {
        matchesStatus = r.status === RequestStatus.ANALISE;
      } else if (statusFilter === 'errors') {
        matchesStatus = r.status === RequestStatus.ERRO_FISCAL;
      } else if (statusFilter === 'approved') {
        matchesStatus = r.status === RequestStatus.APROVADO || r.status === RequestStatus.LANCADO || r.status === RequestStatus.FATURADO;
      }

      const matchesBranch = branchFilter === '' || r.branch === branchFilter;

      const reqDate = new Date(r.createdAt);
      reqDate.setHours(0, 0, 0, 0);
      let matchesDate = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (reqDate < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (reqDate > end) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesBranch && matchesDate;
    });
  }, [requests, searchTerm, statusFilter, branchFilter, startDate, endDate]);

  const getFiscalStatusDisplay = (status: RequestStatus) => {
    if (status === RequestStatus.FATURADO || status === RequestStatus.LANCADO) {
      return RequestStatus.APROVADO; 
    }
    return status;
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center space-x-2">
          <Filter size={18} className="text-blue-600" />
          <span className="text-xs font-black text-gray-700 uppercase tracking-tighter">Filtros:</span>
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Início</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm hover:border-gray-300 transition-colors" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fim</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm hover:border-gray-300 transition-colors" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Filial</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white appearance-none cursor-pointer shadow-sm">
              <option value="">Todas as Filiais</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {(startDate || endDate || branchFilter || searchTerm || statusFilter !== 'all') && (
          <button onClick={() => { setStartDate(''); setEndDate(''); setBranchFilter(''); setSearchTerm(''); setStatusFilter('all'); }} className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest">Limpar Filtros</button>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b space-y-4 bg-gray-50/50">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Filtrar por ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[{ id: 'all', label: 'Todos' }, { id: 'pending', label: 'Pendentes' }, { id: 'analysis', label: 'Em Análise' }, { id: 'approved', label: 'Aprovados' }, { id: 'errors', label: 'Com Erro' }].map(f => (
                <button key={f.id} onClick={() => setStatusFilter(f.id)} className={`py-1.5 px-2 rounded-lg text-[10px] font-black uppercase tracking-tighter border transition-all ${statusFilter === f.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{f.label}</button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredRequests.length > 0 ? filteredRequests.map(r => (
              <div key={r.id} onClick={() => setSelectedId(r.id)} className={`p-4 cursor-pointer transition-colors ${selectedId === r.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-bold text-gray-400">#{r.id}</span>
                    <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{r.branch}</span>
                  </div>
                  <Badge status={getFiscalStatusDisplay(r.status)} request={r} currentUser={authState.user} />
                </div>
                <p className="font-bold text-gray-900 text-sm truncate">{r.title}</p>
              </div>
            )) : <div className="p-10 text-center text-gray-400 italic text-sm">Nenhuma solicitação encontrada.</div>}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-2xl overflow-hidden flex flex-col shadow-sm">
          {selectedRequest ? (
            <>
              <div className="p-8 border-b flex justify-between items-center bg-gray-50/30">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{selectedRequest.title}</h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">VALIDAÇÃO FISCAL SISPAG • ID SHAREPOINT: #{selectedRequest.id} • {selectedRequest.branch}</p>
                </div>
                <div className="flex space-x-2">
                  {selectedRequest.status !== RequestStatus.FATURADO && (
                    <>
                      <button onClick={() => setIsRejectModalOpen(true)} className="px-6 py-2.5 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl transition-all flex items-center"><XCircle size={18} className="mr-2" /> Reprovar</button>
                      <button onClick={handleApprove} className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-green-100 flex items-center hover:bg-green-700 transition-colors"><CheckCircle size={18} className="mr-2" /> Aprovar</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 space-y-10">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <section className="bg-blue-50/40 p-6 rounded-3xl border border-blue-100">
                      <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center"><Info size={14} className="mr-2" /> Identificação Prioritária</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div><span className="text-[9px] text-blue-400 font-bold uppercase block mb-1">Nota Fiscal</span><p className="text-2xl font-black text-slate-900 break-words">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p></div>
                        <div><span className="text-[9px] text-blue-400 font-bold uppercase block mb-1">Pedidos</span><p className="text-2xl font-black text-slate-900 break-words leading-tight">{stripHtml(selectedRequest.orderNumbers) || '---'}</p></div>
                        <div className="col-span-2 pt-4 mt-2 border-t border-blue-100/50"><span className="text-[9px] text-blue-400 font-bold uppercase block mb-1">Observações</span><p className="text-xs text-slate-600 leading-relaxed italic">"{selectedRequest.generalObservation || '---'}"</p></div>
                      </div>
                    </section>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center"><Paperclip size={14} className="mr-2" /> Documentação Anexada</h3>
                    <div className="space-y-3">
                      {selectedRequest.attachments?.map(att => (
                        <div key={att.id} className="p-4 bg-white border border-gray-200 rounded-2xl flex items-center shadow-sm hover:border-blue-400 transition-all">
                          <div className="bg-blue-50 p-3 rounded-xl text-blue-600 mr-4"><FileText size={20}/></div>
                          <div className="flex-1 truncate"><span className="text-gray-900 font-bold text-xs block">{att.fileName}</span><span className="text-[9px] text-gray-400 font-black uppercase">{att.type}</span></div>
                          <button onClick={() => handleViewFile(att.storageUrl)} className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest"><ExternalLink size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><div className="bg-gray-50 p-10 rounded-full mb-6"><FileSearch size={80} className="opacity-10" /></div><h3 className="text-xl font-black text-gray-900 tracking-tight">Análise Fiscal</h3><p className="text-sm font-medium text-gray-500 max-w-xs text-center mt-2">Selecione para validar.</p></div>}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-10 shadow-2xl">
            <div className="flex items-center space-x-4 mb-8">
              <div className="bg-red-50 p-3 rounded-2xl text-red-600"><AlertTriangle size={32} /></div>
              <h3 className="text-3xl font-black uppercase text-red-600 tracking-tight">Reprovar Solicitação</h3>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tipo do Erro</label>
                <select value={errorType} onChange={e => setErrorType(e.target.value)} className="w-full p-4 bg-gray-50 border-0 rounded-2xl outline-none font-bold text-gray-700 shadow-inner appearance-none">
                  <option value="Erro nos Anexos">Erro nos Anexos</option>
                  <option value="Erro nos Pedidos">Erro nos Pedidos</option>
                  <option value="Dados Bancários Inválidos">Dados Bancários Inválidos</option>
                  <option value="Favorecido Incorreto">Favorecido Incorreto</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Observações Detalhadas</label>
                <textarea rows={4} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="O que corrigir?" className="w-full p-6 bg-gray-50 rounded-3xl outline-none font-medium border-0 shadow-inner resize-none" />
              </div>
            </div>
            <div className="flex space-x-4 pt-8">
              <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-4 font-black text-gray-500 uppercase text-xs">Cancelar</button>
              <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl uppercase text-xs">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFiscal;
