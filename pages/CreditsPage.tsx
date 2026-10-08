import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, Coins, CreditCard, Loader2, QrCode, Receipt, Star, XCircle } from 'lucide-react';
import {
  aguardarPagamento,
  Compra,
  comprarCartao,
  comprarPix,
  DadosCartao,
  documentoValido,
  ErroCobranca,
  formatarReais,
  listarPacotes,
  minhasCompras,
  novaChave,
  Pacote,
  ResultadoCheckout,
  ROTULO_STATUS,
  StatusCompra,
} from '../services/billing';

/**
 * Spec genesis-auth-cobranca-centralizada (Fase 6): compra de pacotes de créditos na v2. Catálogo,
 * cobrança e histórico vêm do [AUTH]. O crédito entra pelo webhook do Asaas; esta página só
 * acompanha o status da compra e pede a atualização do saldo do cabeçalho quando ela é paga.
 */

type Metodo = 'pix' | 'cartao';

const CARTAO_VAZIO: DadosCartao = {
  card_number: '', card_name: '', card_expiry_month: '', card_expiry_year: '', card_cvv: '',
  cpf: '', phone: '', cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '',
};

const COR_STATUS: Record<StatusCompra, string> = {
  pending: 'text-yellow-400',
  paid: 'text-genesis-positive',
  refunded: 'text-gray-400',
  failed: 'text-genesis-negative',
  expired: 'text-gray-500',
};

const campo = 'w-full bg-black/40 rounded-lg py-2.5 px-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-genesis-positive/60';
const rotulo = 'text-[10px] uppercase font-bold text-gray-400 tracking-wide mb-1 block';

const Campo: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  maxLength?: number;
}> = ({ label, value, onChange, className = '', ...resto }) => (
  <label className={className}>
    <span className={rotulo}>{label}</span>
    <input className={campo} value={value} onChange={(e) => onChange(e.target.value)} {...resto} />
  </label>
);

const CreditsPage: React.FC = () => {
  const [pacotes, setPacotes] = useState<Pacote[] | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState<string | null>(null);
  const [selecionado, setSelecionado] = useState<Pacote | null>(null);
  const [metodo, setMetodo] = useState<Metodo>('pix');
  const [cpf, setCpf] = useState('');
  const [cartao, setCartao] = useState<DadosCartao>(CARTAO_VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoCheckout | null>(null);
  const [status, setStatus] = useState<StatusCompra | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [compras, setCompras] = useState<Compra[]>([]);
  const acompanhamento = useRef<AbortController | null>(null);

  const carregarHistorico = useCallback(async () => {
    try {
      setCompras((await minhasCompras()).compras);
    } catch {
      /* histórico é secundário: falha aqui não bloqueia a compra */
    }
  }, []);

  useEffect(() => {
    listarPacotes()
      .then(setPacotes)
      .catch((e: ErroCobranca) => setErroCatalogo(e.message));
    void carregarHistorico();
    return () => acompanhamento.current?.abort();
  }, [carregarHistorico]);

  const acompanhar = useCallback(async (compra: ResultadoCheckout) => {
    acompanhamento.current?.abort();
    const controle = new AbortController();
    acompanhamento.current = controle;
    const final = await aguardarPagamento(compra.purchase_id, { signal: controle.signal });
    if (controle.signal.aborted) return;
    setStatus(final);
    if (final === 'paid') window.dispatchEvent(new Event('refreshCredits'));
    void carregarHistorico();
  }, [carregarHistorico]);

  const escolher = (p: Pacote) => {
    acompanhamento.current?.abort();
    setSelecionado(p);
    setResultado(null);
    setStatus(null);
    setErro(null);
  };

  const pagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selecionado || enviando) return;

    const documento = metodo === 'pix' ? cpf : cartao.cpf;
    if (!documentoValido(documento)) {
      setErro('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    setEnviando(true);
    setErro(null);
    try {
      const r = metodo === 'pix'
        ? await comprarPix(selecionado.id, documento, novaChave())
        : await comprarCartao(selecionado.id, cartao, novaChave());
      setResultado(r);
      setStatus(r.status);
      if (metodo === 'cartao') setCartao({ ...CARTAO_VAZIO, cpf: cartao.cpf });
      void carregarHistorico();
      if (r.status === 'pending') void acompanhar(r);
    } catch (err) {
      setErro(err instanceof ErroCobranca ? err.message : 'Não foi possível concluir a compra. Tente novamente.');
      void carregarHistorico();
    } finally {
      setEnviando(false);
    }
  };

  const copiarPix = async () => {
    if (!resultado?.pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(resultado.pix.qr_code);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* navegador sem permissão de área de transferência: o código continua visível para copiar */
    }
  };

  const mudarCartao = (k: keyof DadosCartao) => (v: string) => setCartao((c) => ({ ...c, [k]: v }));

  return (
    <div className="max-w-6xl w-full mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Coins className="text-genesis-positive" />
        <h2 className="text-xl font-light text-white tracking-widest uppercase">Comprar créditos</h2>
      </div>

      {erroCatalogo && <p className="text-genesis-negative text-sm">{erroCatalogo}</p>}
      {!pacotes && !erroCatalogo && (
        <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={16} className="animate-spin" /> Carregando pacotes...</div>
      )}

      {pacotes && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pacotes.map((p) => {
            const ativo = selecionado?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => escolher(p)}
                className={`relative text-left rounded-[10px] p-5 transition-all bg-white/[0.03] hover:bg-white/[0.06] ${
                  ativo ? 'ring-2 ring-genesis-positive' : p.popular ? 'ring-1 ring-genesis-positive/40' : 'ring-1 ring-white/5'
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-2 right-3 flex items-center gap-1 bg-genesis-positive text-black text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded">
                    <Star size={10} /> Mais escolhido
                  </span>
                )}
                <div className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-3">{p.name}</div>
                <div className="text-2xl font-mono font-bold text-white">{p.credits.toLocaleString('pt-BR')}</div>
                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-4">créditos</div>
                <div className="text-lg font-bold text-genesis-positive">{formatarReais(p.price_brl)}</div>
              </button>
            );
          })}
        </div>
      )}

      {selecionado && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={pagar} className="bg-white/[0.03] rounded-[10px] p-5 flex flex-col gap-4">
            <div className="text-sm text-gray-300">
              <span className="text-white font-bold">{selecionado.name}</span> · {selecionado.credits.toLocaleString('pt-BR')} créditos ·{' '}
              <span className="text-genesis-positive font-bold">{formatarReais(selecionado.price_brl)}</span>
            </div>

            <div className="flex gap-1 bg-black/40 p-1 rounded-lg w-fit">
              {([['pix', 'PIX', QrCode], ['cartao', 'Cartão', CreditCard]] as const).map(([id, nome, Icone]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { setMetodo(id); setErro(null); }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${
                    metodo === id ? 'bg-genesis-positive text-black' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Icone size={14} /> {nome}
                </button>
              ))}
            </div>

            {metodo === 'pix' ? (
              <Campo label="CPF ou CNPJ" value={cpf} onChange={setCpf} inputMode="numeric" placeholder="000.000.000-00" maxLength={18} />
            ) : (
              <div className="grid grid-cols-6 gap-3">
                <Campo className="col-span-6" label="Número do cartão" value={cartao.card_number} onChange={mudarCartao('card_number')} inputMode="numeric" autoComplete="cc-number" maxLength={23} />
                <Campo className="col-span-6" label="Nome impresso no cartão" value={cartao.card_name} onChange={mudarCartao('card_name')} autoComplete="cc-name" />
                <Campo className="col-span-2" label="Mês" value={cartao.card_expiry_month} onChange={mudarCartao('card_expiry_month')} inputMode="numeric" placeholder="MM" maxLength={2} autoComplete="cc-exp-month" />
                <Campo className="col-span-2" label="Ano" value={cartao.card_expiry_year} onChange={mudarCartao('card_expiry_year')} inputMode="numeric" placeholder="AAAA" maxLength={4} autoComplete="cc-exp-year" />
                <Campo className="col-span-2" label="CVV" value={cartao.card_cvv} onChange={mudarCartao('card_cvv')} inputMode="numeric" maxLength={4} autoComplete="cc-csc" />
                <Campo className="col-span-3" label="CPF ou CNPJ do titular" value={cartao.cpf} onChange={mudarCartao('cpf')} inputMode="numeric" maxLength={18} />
                <Campo className="col-span-3" label="Telefone" value={cartao.phone} onChange={mudarCartao('phone')} inputMode="tel" autoComplete="tel" />
                <Campo className="col-span-2" label="CEP" value={cartao.cep} onChange={mudarCartao('cep')} inputMode="numeric" autoComplete="postal-code" maxLength={9} />
                <Campo className="col-span-4" label="Rua" value={cartao.street} onChange={mudarCartao('street')} autoComplete="address-line1" />
                <Campo className="col-span-2" label="Número" value={cartao.number} onChange={mudarCartao('number')} />
                <Campo className="col-span-4" label="Complemento" value={cartao.complement ?? ''} onChange={mudarCartao('complement')} />
                <Campo className="col-span-3" label="Bairro" value={cartao.neighborhood} onChange={mudarCartao('neighborhood')} />
                <Campo className="col-span-2" label="Cidade" value={cartao.city} onChange={mudarCartao('city')} autoComplete="address-level2" />
                <Campo className="col-span-1" label="UF" value={cartao.state} onChange={(v) => mudarCartao('state')(v.toUpperCase())} maxLength={2} />
              </div>
            )}

            {erro && (
              <div className="flex items-center gap-2 text-genesis-negative text-xs"><XCircle size={14} /> {erro}</div>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full bg-genesis-positive hover:bg-emerald-500 disabled:opacity-50 text-black font-bold py-3 rounded text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {enviando && <Loader2 size={14} className="animate-spin" />}
              {metodo === 'pix' ? 'Gerar PIX' : `Pagar ${formatarReais(selecionado.price_brl)}`}
            </button>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Pagamento processado pelo Asaas. Os créditos entram no seu saldo assim que o pagamento é confirmado.
            </p>
          </form>

          <div className="bg-white/[0.03] rounded-[10px] p-5 flex flex-col items-center justify-center text-center gap-4 min-h-[260px]">
            {!resultado && <p className="text-gray-500 text-sm">Escolha a forma de pagamento e conclua ao lado.</p>}

            {resultado && status === 'paid' && (
              <>
                <CheckCircle2 size={48} className="text-genesis-positive" />
                <div className="text-white font-bold">Pagamento confirmado</div>
                <div className="text-sm text-gray-400">{resultado.credits.toLocaleString('pt-BR')} créditos adicionados ao seu saldo.</div>
              </>
            )}

            {resultado && status === 'pending' && resultado.pix && (
              <>
                {resultado.pix.qr_code_base64 && (
                  <img src={`data:image/png;base64,${resultado.pix.qr_code_base64}`} alt="QR Code PIX" className="w-48 h-48 bg-white p-2 rounded-lg" />
                )}
                <div className="w-full">
                  <span className={rotulo}>PIX copia e cola</span>
                  <div className="flex gap-2">
                    <input readOnly value={resultado.pix.qr_code} className={`${campo} font-mono text-[11px]`} onFocus={(e) => e.target.select()} />
                    <button type="button" onClick={copiarPix} className="px-3 rounded-lg bg-genesis-positive text-black flex items-center gap-1 text-xs font-bold">
                      <Copy size={14} /> {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-yellow-400 text-xs"><Loader2 size={14} className="animate-spin" /> Aguardando pagamento...</div>
              </>
            )}

            {resultado && status === 'pending' && !resultado.pix && (
              <>
                <Loader2 size={40} className="animate-spin text-genesis-positive" />
                <div className="text-white font-bold">{resultado.approved ? 'Pagamento aprovado' : 'Pagamento em análise'}</div>
                <div className="text-sm text-gray-400">Os créditos entram no seu saldo em instantes.</div>
              </>
            )}

            {resultado && status && ['failed', 'expired', 'refunded'].includes(status) && (
              <>
                <XCircle size={48} className="text-genesis-negative" />
                <div className="text-white font-bold">{ROTULO_STATUS[status]}</div>
                <div className="text-sm text-gray-400">Nenhum crédito foi adicionado. Você pode tentar de novo.</div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/[0.03] rounded-[10px] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Receipt size={16} className="text-gray-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Minhas compras</h3>
        </div>
        {compras.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma compra ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-gray-500 text-left">
                  <th className="py-2 pr-4">Data</th>
                  <th className="py-2 pr-4">Pacote</th>
                  <th className="py-2 pr-4 text-right">Créditos</th>
                  <th className="py-2 pr-4 text-right">Valor</th>
                  <th className="py-2 pr-4">Forma</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {compras.map((c) => (
                  <tr key={c.purchase_id} className="border-t border-white/5 text-gray-300">
                    <td className="py-2 pr-4 whitespace-nowrap">{c.created_at ? new Date(c.created_at).toLocaleString('pt-BR') : '--'}</td>
                    <td className="py-2 pr-4">{c.plan_name}</td>
                    <td className="py-2 pr-4 text-right font-mono">{c.credits.toLocaleString('pt-BR')}</td>
                    <td className="py-2 pr-4 text-right font-mono">{formatarReais(c.amount)}</td>
                    <td className="py-2 pr-4">{c.billing_type === 'PIX' ? 'PIX' : c.billing_type === 'CREDIT_CARD' ? 'Cartão' : '--'}</td>
                    <td className={`py-2 font-bold ${COR_STATUS[c.status]}`}>{ROTULO_STATUS[c.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreditsPage;
