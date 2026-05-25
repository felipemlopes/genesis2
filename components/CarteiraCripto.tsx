import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Search, Plus, Wallet, Trash2, Edit2, TrendingUp, TrendingDown, CheckCircle, X, PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { buscarPrecoSpot, buscarListaAtivos } from '../services/spotPriceService';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { useMonitoramentoCarteira } from '../hooks/useMonitoramentoCarteira';
import { useAppContext } from '../contexts/AppContext';
import {
  fetchCarteiraMembro, storeCarteiraMembro, updateCarteiraMembro, deleteCarteiraMembro,
  fetchCarteiraMae, storeCarteiraMae, updateCarteiraMae, deleteCarteiraMae,
  fetchCarteiraGemas, storeCarteiraGemas, updateCarteiraGemas, deleteCarteiraGemas,
} from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Ativo {
  id: number;
  ativo: string;
  nome_completo: string;
  corretora: string;
  preco_entrada: number;
  preco_atual: number;
  data_entrada: string;
  tipo: 'GEMA' | 'PRJ';
  alvo_saida?: number;
  alvo_cima?: number;
  alvo_baixo?: number;
  investimento?: number;
  telegram_mensagem?: string;
  status: 'ATIVO' | 'VENDIDO';
  preco_venda?: number;
  data_venda?: string;
  observacoes?: string;
}

const CarteiraCripto = () => {
  const [activeTab, setActiveTab] = useState<'MEMBRO' | 'MAE' | 'GEMAS'>('MEMBRO');
  const [ativosMembro, setAtivosMembro] = useState<Ativo[]>([]);
  const [ativosMae, setAtivosMae] = useState<Ativo[]>([]);
  const [ativosGemas, setAtivosGemas] = useState<Ativo[]>([]);
  
  const ativosMembroRef = useRef(ativosMembro);
  const ativosMaeRef = useRef(ativosMae);
  const ativosGemasRef = useRef(ativosGemas);

  useEffect(() => { ativosMembroRef.current = ativosMembro; }, [ativosMembro]);
  useEffect(() => { ativosMaeRef.current = ativosMae; }, [ativosMae]);
  useEffect(() => { ativosGemasRef.current = ativosGemas; }, [ativosGemas]);
  
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'ATIVOS' | 'VENDIDOS'>('TODOS');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'GEMA' | 'PRJ'>('TODOS');
  const [filtroCorretora, setFiltroCorretora] = useState('TODAS');
  const [busca, setBusca] = useState('');

  const [isLoading, setIsLoading] = useState(true);

  // Modais
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  
  const [editingAtivo, setEditingAtivo] = useState<Ativo | null>(null);

  // Form State
  const [formBuscaAtivo, setFormBuscaAtivo] = useState('');
  const [listaBusca, setListaBusca] = useState<{ symbol: string; name: string }[]>([]);
  const [formCurrentPrice, setFormCurrentPrice] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    ativo: '',
    nome_completo: '',
    corretora: 'Binance',
    tipo: 'GEMA',
    preco_entrada: '',
    data_entrada: format(new Date(), 'yyyy-MM-dd'),
    alvo_saida: '',
    alvo_porcentagem: '',
    investimento: '',
    observacoes: '',
    alvo_cima: '',
    alvo_baixo: '',
    telegram_mensagem: ''
  });

  const [sellData, setSellData] = useState({
    preco_venda: '',
    data_venda: format(new Date(), 'yyyy-MM-dd')
  });

  const [alvoAlerta, setAlvoAlerta] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setAlvoAlerta((e as CustomEvent).detail);
      setTimeout(() => setAlvoAlerta(null), 15000);
    };
    window.addEventListener('carteira:alvo-atingido', handler);
    return () => window.removeEventListener('carteira:alvo-atingido', handler);
  }, []);

  const { isAdmin } = useAppContext();

  // --- BUSCA DE DADOS ---
  const fetchCarteiras = async () => {
    try {
      const [resMembro, resMae, resGemas] = await Promise.all([
        fetchCarteiraMembro(),
        isAdmin ? fetchCarteiraMae() : Promise.resolve({ data: [] }),
        isAdmin ? fetchCarteiraGemas() : Promise.resolve({ data: [] }),
      ]);
      if (resMembro.data) setAtivosMembro(resMembro.data);
      if (resMae.data) setAtivosMae(resMae.data);
      if (resGemas.data) setAtivosGemas(resGemas.data);
      
      const currentListMem = resMembro.data || [];
      const currentListMae = resMae.data || [];
      const currentListGem = resGemas.data || [];
      
      // Update prices for the active tab immediately after fetching
      if (activeTab === 'MEMBRO') atualizarPrecosSpot(currentListMem, 'MEMBRO');
      else if (activeTab === 'MAE') atualizarPrecosSpot(currentListMae, 'MAE');
      else atualizarPrecosSpot(currentListGem, 'GEMAS');
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCarteiras();
  }, [activeTab]);

  // --- ATUALIZAÇÃO RECORRENTE DE PREÇOS (SPOT) ---
  const atualizarPrecosSpot = async (specificList?: Ativo[], tabToUpdate?: string) => {
    const targetTab = tabToUpdate || activeTab;
    const list = specificList || (targetTab === 'MEMBRO' ? ativosMembroRef.current : 
                 targetTab === 'MAE' ? ativosMaeRef.current : ativosGemasRef.current);
    
    if (list.length === 0) return; // don't do work if nothing here yet
    
    const novosAtivos = await Promise.all(list.map(async (at) => {
      if (at.status !== 'ATIVO') return at;
      const preco = await buscarPrecoSpot(at.ativo, at.corretora);
      return preco ? { ...at, preco_atual: preco } : at;
    }));
    
    // update only the current tab
    if (targetTab === 'MEMBRO') {
      setAtivosMembro(novosAtivos);
    } else if (targetTab === 'MAE') {
      setAtivosMae(novosAtivos);
    } else {
      setAtivosGemas(novosAtivos);
    }
  };

  useEffect(() => {
    const inv = setInterval(() => atualizarPrecosSpot(), 30000);
    return () => clearInterval(inv);
  }, [activeTab]); //eslint-disable-line

  useMonitoramentoCarteira(ativosMembro, ativosMae, isAdmin);

  // --- CÁLCULOS E FILTROS ---
  const currentList = activeTab === 'MEMBRO' ? ativosMembro : 
                      activeTab === 'MAE' ? ativosMae : ativosGemas;
  
  const filteredList = useMemo(() => {
    return currentList.filter(a => {
      if (filtroStatus !== 'TODOS' && a.status !== filtroStatus.replace('OS', 'O')) return false;
      if (filtroTipo !== 'TODOS' && a.tipo !== filtroTipo) return false;
      if (filtroCorretora !== 'TODAS' && a.corretora.toLowerCase() !== filtroCorretora.toLowerCase()) return false;
      if (busca && !a.ativo.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [currentList, filtroStatus, filtroTipo, filtroCorretora, busca]);

  const calculosResumo = useMemo(() => {
    let investido = 0;
    let valorAtual = 0;
    let melhorAtivo = { nome: '-', pct: -9999, abs: 0 };
    let piorAtivo = { nome: '-', pct: 9999, abs: 0 };

    currentList.forEach(a => {
        if (a.status !== 'ATIVO') return;
        const investedAmount = parseFloat((a.investimento || a.preco_entrada).toString());
        const precoEntrada = parseFloat(a.preco_entrada.toString());
        const precoAtual = parseFloat((a.preco_atual || a.preco_entrada).toString());
        
        let currentAmount = 0;
        if (precoEntrada > 0) {
            currentAmount = (precoAtual / precoEntrada) * investedAmount;
        }

        investido += investedAmount;
        valorAtual += currentAmount;

        const pct = precoEntrada > 0 ? ((precoAtual - precoEntrada) / precoEntrada) * 100 : 0;
        const abs = currentAmount - investedAmount;
        
        if (pct > melhorAtivo.pct) melhorAtivo = { nome: a.ativo, pct, abs };
        if (pct < piorAtivo.pct) piorAtivo = { nome: a.ativo, pct, abs };
    });

    const lucroPreju = valorAtual - investido;
    const lucroPrejuPct = investido > 0 ? (lucroPreju / investido) * 100 : 0;

    return { investido, valorAtual, lucroPreju, lucroPrejuPct, melhorAtivo, piorAtivo };
  }, [currentList]);

  // --- AÇÕES DO MODAL ---
  const handleOpenAdd = () => {
    setEditingAtivo(null);
    setFormData({
      ativo: '', nome_completo: '', corretora: 'Binance', tipo: 'GEMA', 
      preco_entrada: '', data_entrada: format(new Date(), 'yyyy-MM-dd'), alvo_saida: '', alvo_porcentagem: '', investimento: '', observacoes: '',
      alvo_cima: '', alvo_baixo: '', telegram_mensagem: ''
    });
    setFormBuscaAtivo('');
    setFormCurrentPrice(null);
    setIsAddModalOpen(true);
  };

  const handleEdit = (at: Ativo) => {
    setEditingAtivo(at);
    
    let perc = '';
    if (at.alvo_saida && at.preco_entrada) {
      perc = (((at.alvo_saida - at.preco_entrada) / at.preco_entrada) * 100).toFixed(2);
    }
    
    setFormData({
      ativo: at.ativo,
      nome_completo: at.nome_completo || '',
      corretora: at.corretora,
      tipo: at.tipo,
      preco_entrada: at.preco_entrada.toString(),
      data_entrada: at.data_entrada.split('T')[0],
      alvo_saida: at.alvo_saida?.toString() || '',
      alvo_porcentagem: perc,
      investimento: at.investimento?.toString() || '',
      observacoes: at.observacoes || '',
      alvo_cima: at.alvo_cima?.toString() || '',
      alvo_baixo: at.alvo_baixo?.toString() || '',
      telegram_mensagem: at.telegram_mensagem || ''
    });
    setFormBuscaAtivo(at.ativo);
    setIsAddModalOpen(true);
  };

  // --- EFEITOS DO FORMULÁRIO ---
  useEffect(() => {
    // Autocompleta mensagem do telegram baseada nos alvos
    if (activeTab === 'MAE') {
       if (!formData.telegram_mensagem || formData.telegram_mensagem.includes('🚨 Oportunidade')) {
           const cimaStr = formData.alvo_cima ? `\n🎯 Alvo Cima: $${formData.alvo_cima}` : '';
           const baixoStr = formData.alvo_baixo ? `\n🎯 Alvo Baixo: $${formData.alvo_baixo}` : '';
           const msg = `🚨 Oportunidade identificada: ${formData.ativo || '[Ativo]'}\n💰 Entrada: $${formData.preco_entrada || '0.00'}${cimaStr}${baixoStr}`;
           setFormData(prev => ({ ...prev, telegram_mensagem: msg }));
       }
    }
  }, [formData.ativo, formData.preco_entrada, formData.alvo_cima, formData.alvo_baixo, activeTab]);

  const handleAlvoPorcentagemChange = (val: string) => {
    setFormData(prev => {
      const entryPrice = parseFloat(prev.preco_entrada);
      if (!isNaN(entryPrice) && val !== '') {
        const pct = parseFloat(val);
        const novoAlvo = entryPrice * (1 + (pct / 100));
        return { ...prev, alvo_porcentagem: val, alvo_saida: novoAlvo.toFixed(4) };
      }
      return { ...prev, alvo_porcentagem: val };
    });
  };

  const handleAlvoSaidaChange = (val: string) => {
    setFormData(prev => {
       const entryPrice = parseFloat(prev.preco_entrada);
       if (!isNaN(entryPrice) && val !== '') {
         const newAlvo = parseFloat(val);
         const newPct = ((newAlvo - entryPrice) / entryPrice) * 100;
         return { ...prev, alvo_saida: val, alvo_porcentagem: newPct.toFixed(2) };
       }
       return { ...prev, alvo_saida: val };
    });
  };

  const handleOpenSell = (at: Ativo) => {
    setEditingAtivo(at);
    setSellData({
      preco_venda: at.preco_atual?.toString() || '',
      data_venda: format(new Date(), 'yyyy-MM-dd')
    });
    setIsSellModalOpen(true);
  };

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setFormBuscaAtivo(val);
    if (val.length >= 2) {
      const ativos = await buscarListaAtivos(formData.corretora);
      setListaBusca(ativos.filter(a => a.symbol.toUpperCase().includes(val) || a.name.toUpperCase().includes(val)));
    } else {
      setListaBusca([]);
    }
  };

  const selectAtivo = async (symbol: string, name: string) => {
    setFormBuscaAtivo(symbol);
    setFormData(prev => ({ ...prev, ativo: symbol, nome_completo: name }));
    setListaBusca([]);
    const preco = await buscarPrecoSpot(symbol, formData.corretora);
    setFormCurrentPrice(preco);
    if (preco && !formData.preco_entrada) {
      setFormData(prev => ({ ...prev, preco_entrada: preco.toString() }));
    }
  };

  const saveAtivo = async () => {
    try {
      const payload = {
         ...formData,
         preco_entrada: parseFloat(formData.preco_entrada),
         investimento: formData.investimento ? parseFloat(formData.investimento) : null,
         alvo_saida: formData.alvo_saida ? parseFloat(formData.alvo_saida) : null,
         alvo_cima: formData.alvo_cima ? parseFloat(formData.alvo_cima) : null,
         alvo_baixo: formData.alvo_baixo ? parseFloat(formData.alvo_baixo) : null
      };

      let res;
      if (activeTab === 'MEMBRO') {
        res = editingAtivo ? await updateCarteiraMembro(editingAtivo.id, payload) : await storeCarteiraMembro(payload);
      } else if (activeTab === 'MAE') {
        res = editingAtivo ? await updateCarteiraMae(editingAtivo.id, payload) : await storeCarteiraMae(payload);
      } else {
        res = editingAtivo ? await updateCarteiraGemas(editingAtivo.id, payload) : await storeCarteiraGemas(payload);
      }
      if (res && (res.data || res.id)) {
        fetchCarteiras();
        setIsAddModalOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveSell = async () => {
    if (!editingAtivo) return;
    try {
      const payload = {
         status: 'VENDIDO',
         preco_venda: parseFloat(sellData.preco_venda),
         data_venda: sellData.data_venda
      };
      let res;
      if (activeTab === 'MEMBRO') {
        res = await updateCarteiraMembro(editingAtivo.id, payload);
      } else if (activeTab === 'MAE') {
        res = await updateCarteiraMae(editingAtivo.id, payload);
      } else {
        res = await updateCarteiraGemas(editingAtivo.id, payload);
      }
      if (res && (res.data || res.id)) {
        fetchCarteiras();
        setIsSellModalOpen(false);
      }
    } catch(e) { console.error(e); }
  };

  const deleteAtivo = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir?")) return;
    try {
      if (activeTab === 'MEMBRO') {
        await deleteCarteiraMembro(id);
      } else if (activeTab === 'MAE') {
        await deleteCarteiraMae(id);
      } else {
        await deleteCarteiraGemas(id);
      }
      fetchCarteiras();
    } catch(e) { console.error(e); }
  };

  // --- EXPORT ---
  const exportCSV = () => {
    const csv = Papa.unparse(filteredList);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carteira_${activeTab}_${format(new Date(), 'yyyyMMdd')}.csv`;
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Configurações do cabeçalho
    doc.setFillColor(11, 11, 15);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text('GÊNESIS', 15, 20);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Relatório da Carteira: ${activeTab === 'MEMBRO' ? 'Minha Carteira' : activeTab === 'MAE' ? 'Carteira Mãe' : 'Carteira de Gemas'}`, 15, 30);
    doc.text(format(new Date(), 'dd/MM/yyyy HH:mm'), 150, 30);

    // Resumo
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Investido: $${calculosResumo.investido.toFixed(2)}`, 15, 50);
    doc.text(`Valor Atual: $${calculosResumo.valorAtual.toFixed(2)}`, 80, 50);
    
    const isLucro = calculosResumo.lucroPreju >= 0;
    doc.setTextColor(isLucro ? 34 : 220, isLucro ? 197 : 38, isLucro ? 94 : 38);
    doc.text(`Lucro/Prejuízo: $${calculosResumo.lucroPreju.toFixed(2)} (${calculosResumo.lucroPrejuPct.toFixed(2)}%)`, 140, 50);

    // Tabela
    const tableData = filteredList.map(at => {
      const investido = at.investimento || 0;
      return [
        at.ativo, 
        at.corretora,
        `$${investido.toFixed(2)}`,
        `$${at.preco_entrada.toFixed(4)}`,
        at.preco_atual ? `$${at.preco_atual.toFixed(4)}` : 'Buscando...',
        `${((((at.preco_atual || at.preco_entrada) - at.preco_entrada) / at.preco_entrada) * 100).toFixed(2)}%`,
        at.status
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [['Ativo', 'Corretora', 'Investimento', 'Pr. Entrada', 'Pr. Atual', 'Variação', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [139, 92, 246] },
      styles: { fontSize: 8 },
    });

    doc.save(`genesis_carteira_${activeTab}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="w-full flex-1 flex flex-col gap-6 animate-in fade-in duration-500">
        
        {/* RESUMO FINANCEIRO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Total Investido</p>
                <div className="text-xl font-mono text-white">${calculosResumo.investido.toFixed(2)}</div>
            </div>
            <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Valor Atual</p>
                <div className="text-xl font-mono text-white">${calculosResumo.valorAtual.toFixed(2)}</div>
            </div>
            <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner">
                <p className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Lucro/Prejuízo</p>
                <div className={`text-xl font-mono ${calculosResumo.lucroPreju >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                    ${calculosResumo.lucroPreju.toFixed(2)} ({calculosResumo.lucroPrejuPct.toFixed(2)}%)
                </div>
            </div>
            <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner grid grid-cols-2 gap-2">
                <div>
                   <p className="text-[9px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Melhor Ativo</p>
                   {calculosResumo.melhorAtivo.pct === -9999 ? (
                       <div className="text-xs font-mono text-genesis-positive truncate">-</div>
                   ) : (
                       <div className="flex flex-col">
                           <div className="text-xs font-mono text-genesis-positive truncate">
                               {calculosResumo.melhorAtivo.nome} {calculosResumo.melhorAtivo.pct > 0 ? '+' : ''}{calculosResumo.melhorAtivo.pct.toFixed(1)}%
                           </div>
                           <div className="text-[10px] font-mono text-white truncate mt-0.5">
                               {calculosResumo.melhorAtivo.abs >= 0 ? '+' : '-'}${Math.abs(calculosResumo.melhorAtivo.abs).toFixed(2)}
                           </div>
                       </div>
                   )}
                </div>
                <div>
                   <p className="text-[9px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-1">Pior Ativo</p>
                   {calculosResumo.piorAtivo.pct >= 0 ? (
                       <div className="text-xs font-mono text-genesis-negative truncate">-</div>
                   ) : (
                       <div className="flex flex-col">
                           <div className="text-xs font-mono text-genesis-negative truncate">
                               {calculosResumo.piorAtivo.nome} {calculosResumo.piorAtivo.pct.toFixed(1)}%
                           </div>
                           <div className="text-[10px] font-mono text-white truncate mt-0.5">
                               -${Math.abs(calculosResumo.piorAtivo.abs).toFixed(2)}
                           </div>
                       </div>
                   )}
                </div>
            </div>
        </div>

        {/* ABAS */}
        <div className="flex border-b border-white/10 mt-2">
            <button 
               onClick={() => setActiveTab('MEMBRO')}
               className={`py-3 px-6 text-xs uppercase tracking-widest font-bold transition-all ${activeTab === 'MEMBRO' ? 'text-genesis-accent border-b-2 border-genesis-accent bg-genesis-accent/5' : 'text-genesis-text-secondary hover:text-white'}`}
            >
                Minha Carteira
            </button>
            <button 
               onClick={() => setActiveTab('MAE')}
               className={`py-3 px-6 text-xs uppercase tracking-widest font-bold transition-all ${activeTab === 'MAE' ? 'text-green-500 border-b-2 border-green-500 bg-green-500/5' : 'text-genesis-text-secondary hover:text-white'}`}
            >
                Carteira Mãe
            </button>
            <button 
               onClick={() => setActiveTab('GEMAS')}
               className={`py-3 px-6 text-xs uppercase tracking-widest font-bold transition-all ${activeTab === 'GEMAS' ? 'text-yellow-500 border-b-2 border-yellow-500 bg-yellow-500/5' : 'text-genesis-text-secondary hover:text-white'}`}
            >
                Carteira de Gemas
            </button>
        </div>

        {/* FILTROS E AÇÕES */}
        <div className="flex flex-col md:flex-row justify-between gap-4 mt-2">
            <div className="flex gap-3 flex-wrap">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                    <input 
                      type="text"
                      className="bg-[#0b0b0f] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:border-genesis-accent tracking-wide w-48"
                      placeholder="Buscar ativo..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                    />
                </div>
                <select className="bg-[#0b0b0f] border border-white/10 rounded-lg px-4 py-2 text-xs text-white uppercase"
                        value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as any)}>
                    <option value="TODOS">Todos Status</option>
                    <option value="ATIVOS">Ativos</option>
                    <option value="VENDIDOS">Vendidos</option>
                </select>
                <select className="bg-[#0b0b0f] border border-white/10 rounded-lg px-4 py-2 text-xs text-white uppercase"
                        value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}>
                    <option value="TODOS">Todos Tipos</option>
                    <option value="GEMA">GEMA</option>
                    <option value="PRJ">PRJ</option>
                </select>
                <select className="bg-[#0b0b0f] border border-white/10 rounded-lg px-4 py-2 text-xs text-white uppercase"
                        value={filtroCorretora} onChange={e => setFiltroCorretora(e.target.value)}>
                    <option value="TODAS">Todas Corretoras</option>
                    <option value="Binance">Binance</option>
                    <option value="Bybit">Bybit</option>
                    <option value="Bitget">Bitget</option>
                    <option value="OKX">OKX</option>
                </select>
            </div>
            
            <div className="flex gap-3">
                <button onClick={exportCSV} className="bg-white/5 hover:bg-white/10 text-white rounded-lg px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all flex items-center gap-2">
                    <Download size={12} /> CSV
                </button>
                <button onClick={exportPDF} className="bg-white/5 hover:bg-white/10 text-white rounded-lg px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all flex items-center gap-2">
                    <Download size={12} /> PDF
                </button>
                {(activeTab === 'MEMBRO' || isAdmin) && (
                  <button onClick={handleOpenAdd} className={`${activeTab === 'MEMBRO' ? 'bg-genesis-accent hover:bg-purple-600 shadow-[0_0_15px_rgba(139,92,246,0.3)]' : activeTab === 'MAE' ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_15px_rgba(22,163,74,0.3)]' : 'bg-yellow-600 hover:bg-yellow-500 shadow-[0_0_15px_rgba(202,138,4,0.3)]'} text-white rounded-lg px-4 py-2 text-[10px] uppercase font-bold tracking-widest transition-all flex items-center gap-2`}>
                      <Plus size={12} /> Adicionar
                  </button>
                )}
            </div>
        </div>

        {/* TABELA */}
        <div className="bg-[#0b0b0f] rounded-2xl p-4 shadow-inner overflow-x-auto min-h-[300px]">
           <table className="w-full text-left">
              <thead>
                 <tr className="border-b border-white/5 text-[9px] font-bold text-genesis-text-secondary uppercase tracking-widest">
                    <th className="py-4">Ativo</th>
                    <th className="py-4">Corretora</th>
                    <th className="py-4">Investimento</th>
                    <th className="py-4">Preço Entrada</th>
                    <th className="py-4">Preço Atual</th>
                    <th className="py-4">Variação (P/L)</th>
                    <th className="py-4">Progresso/Alvo</th>
                    <th className="py-4">Entrada/Holding</th>
                    <th className="py-4">Status</th>
                    <th className="py-4 text-right">Ação</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                 {filteredList.length === 0 ? (
                    <tr>
                       <td colSpan={10} className="py-12 text-center text-genesis-text-muted text-xs uppercase tracking-widest">Nenhum ativo encontrado.</td>
                    </tr>
                 ) : (
                    filteredList.map(item => {
                       const precoFinal = item.status === 'VENDIDO' && item.preco_venda ? item.preco_venda : item.preco_atual;
                       const lucroPct = precoFinal ? ((precoFinal - item.preco_entrada) / item.preco_entrada) * 100 : 0;
                       const lucroClass = lucroPct >= 0 ? 'text-genesis-positive' : 'text-genesis-negative';
                       const investido = item.investimento || 0;
                       const lucroAbsoluto = investido > 0 && precoFinal ? (lucroPct / 100) * investido : 0;
                       const daysHolding = Math.floor((new Date().getTime() - new Date(item.data_entrada).getTime()) / (1000 * 3600 * 24));
                       const pctProgress = item.alvo_saida && precoFinal ? (lucroPct / (((item.alvo_saida - item.preco_entrada) / item.preco_entrada) * 100)) * 100 : 0;

                       return (
                          <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                             <td className="py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${item.tipo === 'GEMA' ? 'bg-genesis-accent/20 text-genesis-accent' : 'bg-green-500/20 text-green-400'}`}>
                                      {item.tipo}
                                  </span>
                                  <span className="text-white font-bold text-xs">{item.ativo}</span>
                                </div>
                             </td>
                             <td className="py-4 text-xs font-mono text-genesis-text-secondary">{item.corretora}</td>
                             <td className="py-4 text-xs font-mono text-white">${investido > 0 ? investido.toFixed(2) : '-'}</td>
                             <td className="py-4 text-xs font-mono text-genesis-text-secondary">${item.preco_entrada.toFixed(4)}</td>
                             <td className="py-4 text-xs font-mono text-white font-bold">
                                {item.status === 'VENDIDO' && item.preco_venda ? (
                                    '$' + item.preco_venda.toFixed(4)
                                ) : item.preco_atual ? (
                                    '$' + item.preco_atual.toFixed(4)
                                ) : (
                                    <span className="text-gray-600">Buscando...</span>
                                )}
                             </td>
                             <td className="py-4 text-xs font-mono">
                                 <div className={lucroClass}>{lucroPct > 0 ? '+' : ''}{lucroPct.toFixed(2)}%</div>
                                 {investido > 0 && (
                                    <div className="text-[10px] text-white mt-0.5">
                                       {lucroAbsoluto >= 0 ? '+' : '-'}${Math.abs(lucroAbsoluto).toFixed(2)}
                                    </div>
                                 )}
                             </td>
                             <td className="py-4">
                                {item.alvo_saida && item.status !== 'VENDIDO' ? (
                                    <div className="w-24">
                                        <div className="text-[9px] text-gray-500 flex justify-between mb-1 font-mono">
                                            <span>${item.alvo_saida}</span>
                                            <span>{Math.min(100, Math.max(0, pctProgress)).toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full bg-gray-900 rounded-full h-1 overflow-hidden">
                                           <div className="h-full bg-genesis-accent" style={{width: `${Math.min(100, Math.max(0, pctProgress))}%`}} />
                                        </div>
                                    </div>
                                ) : <span className="text-gray-600 text-xs">-</span>}
                             </td>
                             <td className="py-4 text-xs font-mono text-genesis-text-secondary">
                                 <div>{daysHolding} dias</div>
                                 <div className="text-[10px] text-gray-500 mt-0.5">{format(new Date(item.data_entrada), 'dd/MM/yyyy')}</div>
                             </td>
                             <td className="py-4">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${item.status === 'ATIVO' ? 'border-green-500/30 text-green-400 border' : 'bg-gray-800 text-gray-400'}`}>
                                    {item.status}
                                </span>
                             </td>
                             <td className="py-4 flex justify-end gap-2">
                                {(activeTab === 'MEMBRO' || isAdmin) && item.status === 'ATIVO' && (
                                    <>
                                        <button onClick={() => handleEdit(item)} className="text-gray-500 hover:text-white p-1 rounded transition-colors"><Edit2 size={14}/></button>
                                        <button onClick={() => handleOpenSell(item)} className="text-green-500 hover:text-green-400 p-1 rounded transition-colors" title="Marcar como Vendido"><CheckCircle size={14}/></button>
                                    </>
                                )}
                                {(activeTab === 'MEMBRO' || isAdmin) && isAdmin && activeTab === 'MAE' && (
                                    <button onClick={() => deleteAtivo(item.id)} className="text-red-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                                )}
                                {(activeTab === 'MEMBRO' || isAdmin) && item.status === 'VENDIDO' && (
                                     <button onClick={() => deleteAtivo(item.id)} className="text-red-500 hover:text-red-400 p-1 rounded transition-colors"><Trash2 size={14}/></button>
                                )}
                             </td>
                          </tr>
                       );
                    })
                 )}
              </tbody>
           </table>
        </div>

        {/* GRAFICOS */}
        {filteredList.length > 0 && (
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner">
                 <p className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-4">Composição (Top 10)</p>
                 <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                             data={filteredList.map(a => ({ name: a.ativo, value: a.preco_atual || a.preco_entrada })).sort((a,b) => b.value - a.value).slice(0, 10)}
                             cx="50%" cy="50%" innerRadius={80} outerRadius={110} paddingAngle={5}
                             dataKey="value" stroke="none"
                          >
                             {filteredList.map(a => ({ name: a.ativo, value: a.preco_atual || a.preco_entrada })).sort((a,b) => b.value - a.value).slice(0, 10).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6'][index % 7]} />
                             ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-[#12121a] border border-white/10 p-3 rounded-lg shadow-xl">
                                    <p className="text-white font-bold text-[12px] mb-1">{payload[0].name}</p>
                                    <p className="text-[12px] font-mono text-genesis-text-secondary">
                                      Valor: <span className="text-white">${Number(payload[0].value).toFixed(4)}</span>
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
              </div>
              <div className="bg-[#0b0b0f] p-5 rounded-2xl border border-white/5 shadow-inner">
                 <p className="text-[10px] text-genesis-text-secondary uppercase font-bold tracking-widest mb-4">Performance (%)</p>
                 <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={filteredList.map(a => ({ name: a.ativo, lucro: (a.status === 'VENDIDO' && a.preco_venda ? a.preco_venda : a.preco_atual) && a.preco_entrada ? parseFloat(((((a.status === 'VENDIDO' && a.preco_venda ? a.preco_venda : a.preco_atual)! - a.preco_entrada) / a.preco_entrada) * 100).toFixed(2)) : 0 })).sort((a,b) => b.lucro - a.lucro)}>
                          <XAxis dataKey="name" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip
                             cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                             content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                   const value = payload[0].value as number;
                                   return (
                                      <div className="bg-[#12121a] border border-white/10 p-3 rounded-lg shadow-xl">
                                         <p className="text-white font-bold text-[12px] mb-1">{label}</p>
                                         <p className={`text-[12px] font-mono ${value >= 0 ? 'text-genesis-positive' : 'text-genesis-negative'}`}>
                                            Lucro: {value >= 0 ? '+' : ''}{value}%
                                         </p>
                                      </div>
                                   );
                                }
                                return null;
                             }}
                          />
                          <Bar dataKey="lucro" radius={[4, 4, 0, 0]}>
                             {filteredList.map(a => ({ name: a.ativo, lucro: (a.status === 'VENDIDO' && a.preco_venda ? a.preco_venda : a.preco_atual) && a.preco_entrada ? parseFloat(((((a.status === 'VENDIDO' && a.preco_venda ? a.preco_venda : a.preco_atual)! - a.preco_entrada) / a.preco_entrada) * 100).toFixed(2)) : 0 })).sort((a,b) => b.lucro - a.lucro).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.lucro >= 0 ? '#10b981' : '#ef4444'} />
                             ))}
                          </Bar>
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
        )}

        {/* POPUP ALVO ATINGIDO */}
        {alvoAlerta && (
            <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[999999] pointer-events-auto bg-[#0a0a0f] border border-genesis-positive/40 rounded-xl p-5 w-[380px] shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-in slide-in-from-top fade-in duration-500">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-genesis-positive/10 flex items-center justify-center">
                        <TrendingUp size={20} className="text-genesis-positive" />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold text-genesis-positive uppercase tracking-widest block">ALVO ATINGIDO</span>
                        <span className="font-bold text-white text-lg tracking-widest">{alvoAlerta.ativo}</span>
                        <span className="text-[9px] text-gray-500 ml-2 uppercase">{alvoAlerta.corretora}</span>
                    </div>
                    <button onClick={() => setAlvoAlerta(null)} className="ml-auto text-gray-500 hover:text-white transition-colors">
                        <X size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                    <div>
                        <span className="text-[8px] text-gray-500 uppercase block mb-1">Entrada</span>
                        <span className="text-xs font-mono text-white">${alvoAlerta.preco_entrada?.toFixed(4) || '-'}</span>
                    </div>
                    <div>
                        <span className="text-[8px] text-gray-500 uppercase block mb-1">Alvo</span>
                        <span className="text-xs font-mono text-genesis-positive">${alvoAlerta.alvo_saida?.toFixed(4) || alvoAlerta.alvo?.toFixed(4) || '-'}</span>
                    </div>
                    <div>
                        <span className="text-[8px] text-gray-500 uppercase block mb-1">Variacao</span>
                        <span className="text-xs font-mono text-genesis-positive">+{alvoAlerta.variacao || '0'}%</span>
                    </div>
                </div>
                <div className="text-center pt-2 border-t border-white/5">
                    <span className="text-[9px] text-gray-400">Considere realizar o lucro parcial ou total.</span>
                </div>
            </div>
        )}
        {/* MODAIS AQUI */}
        {isAddModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
               <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                  <h3 className="text-lg uppercase tracking-widest font-light mb-6 text-white">
                      {editingAtivo ? 'Editar Ativo' : 'Adicionar Ativo'}
                  </h3>
                  
                  <div className="space-y-4">
                      {/* Corretora */}
                      <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Corretora</label>
                          <select className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none focus:border-genesis-accent"
                                  value={formData.corretora} onChange={(e) => setFormData({...formData, corretora: e.target.value})}>
                              <option>Binance</option><option>Bybit</option><option>Bitget</option><option>OKX</option>
                          </select>
                      </div>

                      {/* Busca Ativo */}
                      <div className="relative">
                          <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Ativo (Busca)</label>
                          <input type="text" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none focus:border-genesis-accent font-mono uppercase"
                                 placeholder="Digite para buscar..."
                                 value={formBuscaAtivo} onChange={handleSearchChange} />
                          {formCurrentPrice && (
                             <div className="absolute right-3 top-8 text-[10px] text-genesis-positive font-mono">Spot: ${formCurrentPrice}</div>
                          )}
                          {listaBusca.length > 0 && (
                              <div className="absolute top-[100%] left-0 w-full mt-1 bg-black border border-white/10 rounded-lg max-h-40 overflow-y-auto z-10">
                                  {listaBusca.map(item => (
                                      <div key={item.symbol} className="p-2 text-xs font-mono text-gray-300 hover:bg-white/10 cursor-pointer flex justify-between"
                                           onClick={() => selectAtivo(item.symbol, item.name)}>
                                          <span className="font-bold">{item.symbol}</span>
                                          <span className="text-[9px] text-gray-500">{item.name}</span>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Tipo</label>
                              <div className="flex bg-black border border-white/5 rounded p-1 gap-1">
                                  <button onClick={() => setFormData({...formData, tipo: 'GEMA'})} className={`flex-1 py-2 text-xs font-bold uppercase transition-all rounded ${formData.tipo==='GEMA' ? 'bg-genesis-accent/20 text-genesis-accent' : 'text-gray-500 hover:text-gray-300'}`}>GEMA</button>
                                  <button onClick={() => setFormData({...formData, tipo: 'PRJ'})} className={`flex-1 py-2 text-xs font-bold uppercase transition-all rounded ${formData.tipo==='PRJ' ? 'bg-green-500/20 text-green-400' : 'text-gray-500 hover:text-gray-300'}`}>PRJ</button>
                              </div>
                          </div>
                          <div>
                              <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Data de Entrada</label>
                              <input type="date" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono"
                                     value={formData.data_entrada} onChange={e => setFormData({...formData, data_entrada: e.target.value})} />
                          </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                          <div>
                             <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Preço de Entrada</label>
                             <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono"
                                    placeholder="Ex: 50000"
                                    value={formData.preco_entrada} onChange={e => setFormData({...formData, preco_entrada: e.target.value})} />
                          </div>
                          <div>
                             <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Alvo (%)</label>
                             <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono"
                                    placeholder="Ex: 50"
                                    value={formData.alvo_porcentagem} onChange={e => handleAlvoPorcentagemChange(e.target.value)} />
                          </div>
                          <div>
                             <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Investimento ($)</label>
                             <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono"
                                    placeholder="Ex: 300"
                                    value={formData.investimento} onChange={e => setFormData({...formData, investimento: e.target.value})} />
                          </div>
                      </div>

                      {activeTab === 'MAE' && isAdmin && (
                          <>
                             <div className="grid grid-cols-2 gap-4">
                                <div>
                                   <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Alvo p/ Cima ($)</label>
                                   <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white font-mono" value={formData.alvo_cima} onChange={e => setFormData({...formData, alvo_cima: e.target.value})} />
                                </div>
                                <div>
                                   <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Alvo p/ Baixo ($)</label>
                                   <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white font-mono" value={formData.alvo_baixo} onChange={e => setFormData({...formData, alvo_baixo: e.target.value})} />
                                </div>
                             </div>
                             <div>
                                 <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Msg Telegram (Op.)</label>
                                 <textarea className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white h-16 resize-none" value={formData.telegram_mensagem} onChange={e => setFormData({...formData, telegram_mensagem: e.target.value})}></textarea>
                             </div>
                          </>
                      )}

                      <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Observações</label>
                          <textarea className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white h-20 resize-none font-mono"
                                    value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})}></textarea>
                      </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                     <button onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">Cancelar</button>
                     <button onClick={saveAtivo} className="px-6 py-3 rounded text-xs font-bold uppercase tracking-widest bg-genesis-accent hover:bg-purple-600 text-white transition-colors">Confirmar</button>
                  </div>
               </div>
            </div>
        )}

        {isSellModalOpen && editingAtivo && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
               <div className="bg-[#0f0f13] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl relative">
                  <h3 className="text-lg uppercase tracking-widest font-light mb-6 text-white text-center">Finalizar Operação</h3>
                  <div className="text-center mb-6">
                      <div className="text-2xl font-mono text-white font-bold">{editingAtivo.ativo}</div>
                      <div className="text-xs text-gray-500 font-mono">Entrada: ${editingAtivo.preco_entrada}</div>
                  </div>
                  <div className="space-y-4">
                      <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Preço de Venda ($)</label>
                          <input type="number" step="any" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono text-center text-lg"
                                 value={sellData.preco_venda} onChange={e => setSellData({...sellData, preco_venda: e.target.value})} />
                      </div>
                      <div>
                          <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mb-1 block">Data da Venda</label>
                          <input type="date" className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none font-mono text-center"
                                 value={sellData.data_venda} onChange={e => setSellData({...sellData, data_venda: e.target.value})} />
                      </div>
                      
                      {sellData.preco_venda && (
                          <div className={`p-4 rounded-lg mt-4 text-center ${parseFloat(sellData.preco_venda) >= editingAtivo.preco_entrada ? 'bg-green-900/10 border border-green-500/20' : 'bg-red-900/10 border border-red-500/20'}`}>
                             <div className="text-[9px] uppercase tracking-widest opacity-60 mb-1">Resultado Realizado</div>
                             <div className={`text-xl font-bold font-mono ${parseFloat(sellData.preco_venda) >= editingAtivo.preco_entrada ? 'text-green-400' : 'text-red-400'}`}>
                                {(((parseFloat(sellData.preco_venda) - editingAtivo.preco_entrada) / editingAtivo.preco_entrada) * 100).toFixed(2)}%
                             </div>
                          </div>
                      )}
                  </div>
                  <div className="mt-8 flex flex-col gap-3">
                     <button onClick={saveSell} className="w-full px-6 py-3 rounded text-xs font-bold uppercase tracking-widest bg-genesis-positive hover:bg-emerald-500 text-black transition-colors">Confirmar Venda</button>
                     <button onClick={() => setIsSellModalOpen(false)} className="w-full px-6 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-colors">Cancelar</button>
                  </div>
               </div>
            </div>
        )}

    </div>
  );
};

export default CarteiraCripto;
