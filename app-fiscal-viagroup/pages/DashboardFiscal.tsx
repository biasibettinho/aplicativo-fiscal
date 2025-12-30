
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
  Hash,
  Banknote
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
    if (!base64Data) return;
    try {
      const parts = base64Data.split(';base64,');
      if (parts.length < 2) {
        window.open(base64Data, '_blank');
        return;
      }
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
    const filtered = requests.filter(r => {
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
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Fim</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white text-gray-700 cursor-pointer shadow-sm" />
        </div>
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Filial</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 w-44 bg-white appearance-none cursor-pointer">
              <option value="">Todas as Filiais</option>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        {(startDate || endDate || branchFilter || searchTerm || statusFilter !== 'all') && (
          <button onClick={() => { setStartDate(''); setEndDate(''); setBranchFilter(''); setSearchTerm(''); setStatusFilter('all'); }} className="text-[10px] font-black text-red-500 hover:text-red-700 transition-colors uppercase tracking-widest">Limpar</button>
        )}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        <div className="w-1/3 flex flex-col bg-white border rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b space-y-4 bg-gray-50/50">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="ID, Nome ou NF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:ring-2 focus:ring-blue-500" />
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
            )) : <div className="p-10 text-center text-gray-400 italic text-sm">Nada encontrado.</div>}
          </div>
        </div>

        <div className="flex-1 bg-white border rounded-2xl overflow-hidden flex flex-col shadow-sm">
          {selectedRequest ? (
            <>
              <div className="p-8 border-b flex justify-between items-center bg-gray-50/30">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-tight italic">{selectedRequest.title}</h2>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">ID SHAREPOINT: #{selectedRequest.id} • ORIGEM: {selectedRequest.branch}</p>
                </div>
                <div className="flex space-x-3">
                  {selectedRequest.status !== RequestStatus.FATURADO && (
                    <>
                      <button onClick={() => setIsRejectModalOpen(true)} className="px-6 py-3 text-red-600 font-black text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl transition-all flex items-center border border-red-100"><XCircle size={18} className="mr-2" /> Reprovar</button>
                      <button onClick={handleApprove} className="px-10 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-100 flex items-center hover:bg-green-700 transition-colors"><CheckCircle size={18} className="mr-2" /> Validar & Aprovar</button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-12 space-y-12 custom-scrollbar">
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-10">
                    <section className="bg-blue-50/40 p-10 rounded-[2.5rem] border border-blue-100 shadow-sm">
                      <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-8 flex items-center border-b border-blue-100 pb-4 italic"><Info size={16} className="mr-2" /> Dados Cadastrais Primários</h3>
                      <div className="grid grid-cols-1 gap-10">
                        <div><span className="text-[11px] text-blue-400 font-black uppercase block mb-2">Número da Nota Fiscal</span><p className="text-4xl font-black text-slate-900 leading-none">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p></div>
                        <div className="grid grid-cols-2 gap-6">
                          <div><span className="text-[11px] text-blue-400 font-black uppercase block mb-2">Pedidos / O.C.</span><p className="text-2xl font-black text-slate-900 leading-tight">{stripHtml(selectedRequest.orderNumbers) || '---'}</p></div>
                          <div><span className="text-[11px] text-blue-400 font-black uppercase block mb-2">Vencimento</span><p className="text-2xl font-black text-slate-900 leading-tight">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                        </div>
                        <div className="pt-6 mt-4 border-t border-blue-100/50"><span className="text-[11px] text-blue-400 font-black uppercase block mb-2">Observações Adicionais</span><p className="text-lg text-slate-600 leading-relaxed italic italic">"{selectedRequest.generalObservation || 'Sem observações do solicitante.'}"</p></div>
                      </div>
                    </section>
                  </div>
                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center border-b pb-4 mb-6 italic"><Paperclip size={16} className="mr-2" /> Anexos para Validação</h3>
                    <div className="space-y-4">
                      {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? selectedRequest.attachments.map(att => (
                        <div key={att.id} className="p-5 bg-white border border-gray-200 rounded-3xl flex items-center shadow-md hover:border-blue-500 transition-all group">
                          <div className="bg-blue-100 p-4 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors mr-6 flex-shrink-0"><FileText size={24}/></div>
                          <div className="flex-1 truncate"><span className="text-gray-900 font-black text-sm block mb-1 truncate">{att.fileName}</span><span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{att.type}</span></div>
                          <button onClick={() => handleViewFile(att.storageUrl)} className="ml-4 px-6 py-2.5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center shadow-lg shadow-blue-100"><ExternalLink size={14} className="mr-2" /> Abrir</button>
                        </div>
                      )) : <div className="p-12 border-2 border-dashed border-gray-100 rounded-[2.5rem] text-center text-gray-300 italic font-medium">Nenhum documento anexado.</div>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : <div className="flex-1 flex flex-col items-center justify-center text-gray-300"><div className="bg-gray-50 p-12 rounded-full mb-8 shadow-inner"><FileSearch size={100} className="opacity-10" /></div><h3 className="text-3xl font-black text-gray-900 tracking-tight uppercase italic leading-none">Análise Fiscal</h3><p className="text-sm font-bold text-gray-400 uppercase tracking-widest max-w-xs text-center mt-4">Selecione uma solicitação para processar a validação de impostos e documentos.</p></div>}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[3rem] max-w-lg w-full p-12 shadow-2xl">
            <div className="flex items-center space-x-6 mb-10">
              <div className="bg-red-50 p-4 rounded-3xl text-red-600"><AlertTriangle size={40} /></div>
              <h3 className="text-3xl font-black uppercase text-red-600 tracking-tighter italic">Reprovar Lançamento</h3>
            </div>
            <div className="space-y-8">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 italic">Tipo da Inconsistência</label>
                <select value={errorType} onChange={e => setErrorType(e.target.value)} className="w-full p-5 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-700 text-lg appearance-none shadow-sm">
                  <option value="Erro nos Anexos">Erro nos Anexos</option>
                  <option value="Erro nos Pedidos">Erro nos Pedidos</option>
                  <option value="Dados Bancários Inválidos">Dados Bancários Inválidos</option>
                  <option value="Favorecido Incorreto">Favorecido Incorreto</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3 italic">Detalhamento para Correção</label>
                <textarea rows={5} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Descreva exatamente o que o solicitante precisa corrigir..." className="w-full p-6 bg-gray-50 rounded-[2rem] outline-none font-medium text-lg border border-gray-100 shadow-inner resize-none placeholder:text-gray-300" />
              </div>
            </div>
            <div className="flex space-x-5 pt-10">
              <button onClick={() => setIsRejectModalOpen(false)} className="flex-1 py-5 font-black text-gray-500 uppercase text-sm tracking-widest transition-colors hover:text-gray-900">Cancelar</button>
              <button onClick={handleReject} disabled={!rejectReason} className="flex-1 py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-sm tracking-widest shadow-xl shadow-red-100 disabled:opacity-30">Confirmar Reprovação</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardFiscal;
