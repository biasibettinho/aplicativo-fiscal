
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../App';
import { PaymentRequest, RequestStatus } from '../types';
import { requestService } from '../services/requestService';
import { sharepointService } from '../services/sharepointService';
import { PAYMENT_METHODS } from '../constants';
import { 
  Plus, Search, History, Clock, Loader2, Calendar, CreditCard, Landmark, Edit3, Send, Paperclip, FileText, Banknote, X
} from 'lucide-react';
import Badge from '../components/Badge';

const DashboardSolicitante: React.FC = () => {
  const { authState } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  const [invoiceFiles, setInvoiceFiles] = useState<File[]>([]);
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');

  const stripHtml = (html: string) => (html || '').replace(/<[^>]*>?/gm, '').trim();
  
  const initialFormData: Partial<PaymentRequest> = {
    title: '',
    invoiceNumber: '',
    orderNumbers: '',
    payee: '',
    paymentMethod: 'Boleto',
    paymentDate: todayStr,
    generalObservation: '',
    bank: '',
    agency: '',
    account: '',
    accountType: 'Conta Corrente',
    pixKey: '',
    branch: authState.user?.department || 'Matriz SP'
  };

  const [formData, setFormData] = useState<Partial<PaymentRequest>>(initialFormData);

  const syncData = async () => {
    if (!authState.user || !authState.token) return;
    setIsLoading(true);
    try {
      const allAvailable = await requestService.getRequestsFiltered(authState.user, authState.token);
      setRequests(allAvailable.filter(r => r.createdByUserId === authState.user?.id));
    } catch (e) {
      console.error("Erro na sincronização:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { syncData(); }, [authState.user, authState.token]);

  const filteredRequests = useMemo(() => {
    const filtered = requests.filter(req => {
      const searchLower = searchTerm.toLowerCase();
      return (req.title?.toLowerCase() || '').includes(searchLower) || 
             (req.invoiceNumber?.toLowerCase() || '').includes(searchLower) ||
             (req.id?.toString() || '').includes(searchLower);
    });
    return [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, searchTerm]);

  const selectedRequest = requests.find(r => r.id === selectedId);
  const isFormValid = useMemo(() => !!formData.title && !!formData.paymentMethod, [formData]);

  const handleSave = async () => {
    if (!authState.user || !authState.token || !isFormValid) return;
    setIsLoading(true);
    setUploadStatus('Processando...');
    
    try {
      const finalData = { ...formData, branch: authState.user?.department || 'Matriz SP' };
      let itemId = selectedId;

      if (isEditing && selectedId) {
        setUploadStatus('Atualizando...');
        await sharepointService.updateRequest(authState.token, selectedId, finalData);
      } else {
        setUploadStatus('Criando registro...');
        const newReq = await sharepointService.createRequest(authState.token, finalData);
        itemId = newReq.id;
      }

      if (!itemId) throw new Error("O servidor SharePoint não retornou um ID válido.");

      const nfId = formData.invoiceNumber?.trim() || `ID_${itemId}`;
      const baseName = `NF_${nfId}`;

      // Envio para lista principal
      if (invoiceFiles.length > 0) {
        for (let i = 0; i < invoiceFiles.length; i++) {
          const name = invoiceFiles.length > 1 ? `${baseName}_P${i + 1}` : baseName;
          setUploadStatus(`Enviando NF ${i + 1}/${invoiceFiles.length}...`);
          await sharepointService.uploadAttachment(authState.token, 'solicitacoes_sispag_v2', itemId, invoiceFiles[i], name);
        }
      }

      // Envio para lista auxiliar
      if (ticketFiles.length > 0) {
        setUploadStatus('Gerando vínculo de boletos...');
        const auxItem = await sharepointService.createAuxiliaryItem(authState.token, itemId);
        for (let i = 0; i < ticketFiles.length; i++) {
          const name = `BOLETO_${nfId}_${i + 1}`;
          setUploadStatus(`Enviando Boleto ${i + 1}/${ticketFiles.length}...`);
          await sharepointService.uploadAttachment(authState.token, 'APP_Fiscal_AUX_ANEXOS', auxItem.id, ticketFiles[i], name);
        }
      }

      setUploadStatus('Sucesso!');
      setTimeout(() => {
        setIsNew(false);
        setIsEditing(false);
        setFormData(initialFormData);
        setInvoiceFiles([]);
        setTicketFiles([]);
        setUploadStatus('');
        syncData();
      }, 1000);

    } catch (e: any) {
      alert(`Erro: ${e.message}`);
      setUploadStatus('Erro no envio');
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = () => {
    if (!selectedRequest) return;
    setFormData({
      ...selectedRequest,
      invoiceNumber: stripHtml(selectedRequest.invoiceNumber),
      orderNumbers: stripHtml(selectedRequest.orderNumbers),
      paymentDate: selectedRequest.paymentDate?.split('T')[0]
    });
    setIsEditing(true);
    setIsNew(true);
  };

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      {/* Sidebar - Lista Lateral */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-black text-gray-900 tracking-tighter uppercase italic">Minhas Notas</h1>
            <div className="flex items-center space-x-2">
              <button onClick={syncData} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <History size={18} />}
              </button>
              <button onClick={() => { setIsNew(true); setIsEditing(false); setSelectedId(null); setFormData(initialFormData); setInvoiceFiles([]); setTicketFiles([]); }} className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg">
                <Plus size={20} />
              </button>
            </div>
          </div>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input type="text" placeholder="Pesquisar..." className="w-full pl-11 pr-4 py-3 bg-gray-50 border-0 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredRequests.map(req => (
            <button key={req.id} onClick={() => { setSelectedId(req.id); setIsNew(false); }} className={`w-full p-4 rounded-3xl transition-all text-left border-2 ${selectedId === req.id ? 'bg-blue-50 border-blue-600 shadow-xl scale-[1.02]' : 'bg-white border-transparent hover:bg-gray-50 shadow-sm'}`}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-0.5 rounded-full font-mono">#{req.id}</span>
                <Badge status={req.status} />
              </div>
              <h3 className="font-bold text-gray-900 text-sm mb-1 truncate">{req.title}</h3>
              <div className="flex items-center text-[10px] font-bold text-gray-400 uppercase tracking-tighter space-x-3">
                <span className="flex items-center"><Clock size={12} className="mr-1" /> {new Date(req.createdAt).toLocaleDateString()}</span>
                <span className="text-indigo-600 font-black italic">{req.branch}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all ${isNew ? 'bg-[#0a0f2b] text-white' : 'bg-gray-50'}`}>
        {isNew ? (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              <header className="flex items-center justify-between border-b border-white/10 pb-6">
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">{isEditing ? 'Editar Registro' : 'Nova Solicitação'}</h2>
                {uploadStatus && <div className="text-blue-300 font-black animate-pulse uppercase text-[10px] tracking-widest flex items-center bg-white/5 px-4 py-2 rounded-full border border-white/10"><Loader2 className="mr-2 animate-spin" size={12} /> {uploadStatus}</div>}
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Título / Finalidade *</label>
                  <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Nº Nota Fiscal</label>
                  <input type="text" value={formData.invoiceNumber} onChange={e => setFormData({...formData, invoiceNumber: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Método de Pagamento</label>
                  <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none text-white">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m} className="bg-slate-900">{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Data de Vencimento</label>
                  <input type="date" value={formData.paymentDate} onChange={e => setFormData({...formData, paymentDate: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none text-white" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Nº Pedidos / Ordens</label>
                  <input type="text" value={formData.orderNumbers} onChange={e => setFormData({...formData, orderNumbers: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none text-white" />
                </div>
              </div>

              {(formData.paymentMethod === 'TED/DEPOSITO' || formData.paymentMethod === 'PIX') && (
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6 shadow-2xl">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><Landmark size={18} className="mr-2" /> Dados para Pagamento</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                       <label className="block text-[10px] font-black uppercase text-white/40 mb-2 italic tracking-widest">Favorecido (Nome/Razão Social)</label>
                       <input type="text" value={formData.payee} onChange={e => setFormData({...formData, payee: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-xl p-3 outline-none text-white" />
                    </div>
                    {formData.paymentMethod === 'PIX' ? (
                       <div className="md:col-span-2">
                          <label className="block text-[10px] font-black uppercase text-white/40 mb-2 italic tracking-widest">Chave PIX</label>
                          <input type="text" value={formData.pixKey} onChange={e => setFormData({...formData, pixKey: e.target.value})} className="w-full bg-white/10 border border-white/10 rounded-xl p-3 outline-none text-white font-mono" />
                       </div>
                    ) : (
                      <>
                        <input type="text" placeholder="Banco" value={formData.bank} onChange={e => setFormData({...formData, bank: e.target.value})} className="bg-white/10 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <input type="text" placeholder="Agência" value={formData.agency} onChange={e => setFormData({...formData, agency: e.target.value})} className="bg-white/10 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <input type="text" placeholder="Conta" value={formData.account} onChange={e => setFormData({...formData, account: e.target.value})} className="bg-white/10 p-3 rounded-xl border border-white/10 text-white outline-none" />
                        <select value={formData.accountType} onChange={e => setFormData({...formData, accountType: e.target.value})} className="bg-white/10 p-3 rounded-xl border border-white/10 text-white outline-none">
                           <option value="Conta Corrente" className="bg-slate-900">Conta Corrente</option>
                           <option value="Conta Poupança" className="bg-slate-900">Conta Poupança</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-[10px] font-black uppercase text-blue-300 mb-2 italic tracking-widest">Observações Detalhadas</label>
                <textarea rows={3} value={formData.generalObservation} onChange={e => setFormData({...formData, generalObservation: e.target.value})} className="w-full bg-white/5 border border-white/20 rounded-2xl p-4 outline-none text-white resize-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><FileText size={18} className="mr-2" /> Notas Fiscais (PDF)</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-8 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={32} className="text-blue-300 mb-2 opacity-30" />
                    <span className="text-[10px] font-black uppercase">Adicionar Notas</span>
                    <input type="file" multiple className="hidden" onChange={e => setInvoiceFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {invoiceFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="truncate flex-1 font-mono">{f.name}</span>
                        <button onClick={() => setInvoiceFiles(invoiceFiles.filter((_, idx) => idx !== i))} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest flex items-center text-blue-300 italic"><CreditCard size={18} className="mr-2" /> Boletos / Docs</h3>
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl p-8 hover:bg-white/10 cursor-pointer transition-all">
                    <Paperclip size={32} className="text-blue-300 mb-2 opacity-30" />
                    <span className="text-[10px] font-black uppercase">Adicionar Documentos</span>
                    <input type="file" multiple className="hidden" onChange={e => setTicketFiles(Array.from(e.target.files || []))} />
                  </label>
                  <div className="space-y-2">
                    {ticketFiles.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-[10px] bg-white/5 p-3 rounded-xl border border-white/10">
                        <span className="truncate flex-1 font-mono">{f.name}</span>
                        <button onClick={() => setTicketFiles(ticketFiles.filter((_, idx) => idx !== i))} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex justify-end space-x-6 items-center pb-12">
                <button onClick={() => setIsNew(false)} className="font-black uppercase text-[10px] tracking-widest text-white/40 hover:text-white transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={!isFormValid || isLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs flex items-center disabled:opacity-30 shadow-2xl transition-transform active:scale-95">
                  {isLoading ? <Loader2 className="animate-spin mr-3" /> : <Send size={18} className="mr-3" />}
                  {isEditing ? 'Atualizar Dados' : 'Enviar Solicitação'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedRequest ? (
          <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
            <header className="p-12 border-b border-gray-200 bg-white flex justify-between items-end shadow-sm">
              <div>
                <div className="flex items-center space-x-3 mb-4 font-mono">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocolo: #{selectedRequest.id}</span>
                  <Badge status={selectedRequest.status} />
                </div>
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase italic">{selectedRequest.title}</h2>
              </div>
              {selectedRequest.status.includes('Erro') && (
                <button onClick={startEdit} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center hover:bg-blue-700 transition-all"><Edit3 size={18} className="mr-2" /> Corrigir Dados</button>
              )}
            </header>
            <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 italic">Dados Técnicos</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-[9px] font-bold text-gray-400 uppercase">NF</span><p className="text-lg font-black text-gray-900">{stripHtml(selectedRequest.invoiceNumber) || '---'}</p></div>
                    <div><span className="text-[9px] font-bold text-gray-400 uppercase">Vencimento</span><p className="text-lg font-black text-gray-900">{new Date(selectedRequest.paymentDate).toLocaleDateString()}</p></div>
                  </div>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 italic">Pagamento</p>
                  <p className="text-lg font-black text-gray-900 uppercase italic">{selectedRequest.paymentMethod}</p>
                  <p className="text-sm font-bold text-gray-500 mt-2 uppercase truncate">{selectedRequest.payee || '---'}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 text-center animate-in fade-in">
            <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl border border-gray-100 mb-8 flex flex-col items-center">
               <Banknote size={100} className="text-blue-100 animate-pulse duration-[3000ms]" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 tracking-tight italic">Fluxo de Notas</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">Nenhuma nota selecionada. Utilize o painel lateral.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardSolicitante;
