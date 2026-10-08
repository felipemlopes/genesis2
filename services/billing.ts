import { lerToken } from './tokenStorage';

/**
 * Spec genesis-auth-cobranca-centralizada (Fase 6): compra de pacotes de créditos. Tudo no [AUTH]
 * (catálogo, checkout, histórico) — não existe caminho legado pela API v2, então sem
 * VITE_AUTH_API_URL a compra fica indisponível em vez de cair num endpoint que não existe.
 */

export const CLIENTE = 'v2';

export interface Pacote {
  id: number;
  name: string;
  credits: number;
  price_brl: string;
  popular: boolean;
}

export type StatusCompra = 'pending' | 'paid' | 'refunded' | 'failed' | 'expired';

export interface Compra {
  purchase_id: string;
  status: StatusCompra;
  plan_name: string;
  credits: number;
  amount: string;
  billing_type: 'PIX' | 'CREDIT_CARD' | null;
  client: string | null;
  created_at: string | null;
  paid_at: string | null;
}

export interface Pix {
  qr_code: string;
  qr_code_base64: string | null;
  expires_at: string | null;
}

export interface ResultadoCheckout extends Compra {
  approved: boolean;
  pix?: Pix;
}

export interface DadosCartao {
  card_number: string;
  card_name: string;
  card_expiry_month: string;
  card_expiry_year: string;
  card_cvv: string;
  cpf: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export class ErroCobranca extends Error {
  constructor(message: string, public readonly status: number, public readonly compra?: Partial<Compra>) {
    super(message);
    this.name = 'ErroCobranca';
  }
}

export const ROTULO_STATUS: Record<StatusCompra, string> = {
  pending: 'Aguardando pagamento',
  paid: 'Pago',
  refunded: 'Estornado',
  failed: 'Não aprovado',
  expired: 'Expirado',
};

export function baseDoAuth(url: string | undefined = import.meta.env.VITE_AUTH_API_URL): string | null {
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/api`;
}

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json', ...extra };
  const token = lerToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function url(caminho: string): string {
  const base = baseDoAuth();
  if (!base) throw new ErroCobranca('Compra de créditos indisponível no momento.', 0);
  return `${base}${caminho}`;
}

async function pedir<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const destino = url(caminho); // fora do try: "indisponível" não pode virar "sem conexão"
  let res: Response;
  try {
    res = await fetch(destino, { cache: 'no-store', ...init });
  } catch {
    throw new ErroCobranca('Sem conexão. Verifique a internet e tente de novo.', 0);
  }
  const corpo = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ErroCobranca(mensagemDeErro(res.status, corpo), res.status, corpo);
  }
  return corpo as T;
}

export function mensagemDeErro(status: number, corpo: any): string {
  if (status === 401) return 'Sua sessão expirou. Entre de novo para comprar.';
  if (status === 429) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (status === 422 && corpo?.errors) {
    const primeira = Object.values(corpo.errors as Record<string, string[]>)[0];
    if (Array.isArray(primeira) && primeira[0]) return primeira[0];
  }
  return corpo?.message || 'Não foi possível concluir a compra. Tente novamente.';
}

/** Uma chave por clique em "Pagar": protege contra clique duplo sem prender uma nova tentativa. */
export function novaChave(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function listarPacotes(): Promise<Pacote[]> {
  return pedir<Pacote[]>(`/packages?client=${CLIENTE}`, { headers: { Accept: 'application/json' } });
}

export function comprarPix(planId: number, cpf: string, chave: string): Promise<ResultadoCheckout> {
  return pedir<ResultadoCheckout>('/checkout/pix', {
    method: 'POST',
    headers: cabecalhos({ 'Idempotency-Key': chave }),
    body: JSON.stringify({ plan_id: planId, client: CLIENTE, cpf }),
  });
}

export function comprarCartao(planId: number, dados: DadosCartao, chave: string): Promise<ResultadoCheckout> {
  return pedir<ResultadoCheckout>('/checkout/card', {
    method: 'POST',
    headers: cabecalhos({ 'Idempotency-Key': chave }),
    body: JSON.stringify({ plan_id: planId, client: CLIENTE, ...dados }),
  });
}

export async function statusCompra(uuid: string): Promise<Compra> {
  const r = await pedir<{ data: Compra }>(`/purchases/${encodeURIComponent(uuid)}`, { headers: cabecalhos() });
  return r.data;
}

export async function minhasCompras(pagina = 1): Promise<{ compras: Compra[]; ultimaPagina: number }> {
  const r = await pedir<{ data: Compra[]; meta?: { last_page?: number } }>(`/purchases?page=${pagina}`, {
    headers: cabecalhos(),
  });
  return { compras: r.data, ultimaPagina: r.meta?.last_page ?? 1 };
}

const esperarPadrao = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

/**
 * Consulta a compra até sair de `pending` (o webhook do Asaas é quem muda o status). Devolve o
 * último status visto: `pending` se o prazo acabou ou a página foi fechada (signal).
 */
export async function aguardarPagamento(
  uuid: string,
  opcoes: {
    intervaloMs?: number;
    prazoMs?: number;
    signal?: AbortSignal;
    consultar?: (uuid: string) => Promise<Compra>;
    esperar?: (ms: number, signal?: AbortSignal) => Promise<void>;
    agora?: () => number;
  } = {},
): Promise<StatusCompra> {
  const {
    intervaloMs = 5000,
    prazoMs = 30 * 60 * 1000,
    signal,
    consultar = statusCompra,
    esperar = esperarPadrao,
    agora = Date.now,
  } = opcoes;
  const fim = agora() + prazoMs;
  let status: StatusCompra = 'pending';

  while (!signal?.aborted && agora() < fim) {
    await esperar(intervaloMs, signal);
    if (signal?.aborted) break;
    try {
      status = (await consultar(uuid)).status;
    } catch {
      continue; // rede instável: tenta de novo no próximo intervalo
    }
    if (status !== 'pending') return status;
  }
  return status;
}

export function formatarReais(valor: string | number): string {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D+/g, '');
}

/** Validação mínima no front (o Asaas valida de verdade): CPF/CNPJ com 11 ou 14 dígitos. */
export function documentoValido(valor: string): boolean {
  const d = somenteDigitos(valor);
  return d.length === 11 || d.length === 14;
}
