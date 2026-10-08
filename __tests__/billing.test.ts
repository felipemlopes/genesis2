import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  aguardarPagamento,
  baseDoAuth,
  comprarCartao,
  comprarPix,
  documentoValido,
  ErroCobranca,
  listarPacotes,
  mensagemDeErro,
  minhasCompras,
  novaChave,
  statusCompra,
  type Compra,
} from '../services/billing';

/**
 * Spec genesis-auth-cobranca-centralizada (Fase 6): serviço de compra da v2 contra o [AUTH].
 */

const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

function respostaJson(corpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

const compra = (status: Compra['status']): Compra => ({
  purchase_id: 'uuid-1', status, plan_name: 'PLANO 3', credits: 8000, amount: '162.00',
  billing_type: 'PIX', client: 'v2', created_at: null, paid_at: null,
});

describe('services/billing', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.teste/');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const armazenamento = new Map<string, string>([['genesis_token', 'tok-123']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => armazenamento.get(k) ?? null,
      setItem: (k: string, v: string) => armazenamento.set(k, v),
      removeItem: (k: string) => armazenamento.delete(k),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('monta a base do [AUTH] sem barra dupla e devolve null sem URL', () => {
    expect(baseDoAuth('https://auth.genesislabs.com.br/')).toBe('https://auth.genesislabs.com.br/api');
    expect(baseDoAuth('')).toBeNull();
  });

  it('lista os pacotes da v2', async () => {
    fetchMock.mockResolvedValue(respostaJson([{ id: 7, name: 'PLANO 3', credits: 8000, price_brl: '162.00', popular: true }]));

    const pacotes = await listarPacotes();

    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.teste/api/packages?client=v2');
    expect(pacotes[0].price_brl).toBe('162.00');
  });

  it('PIX vai com token, chave de idempotência e client v2', async () => {
    fetchMock.mockResolvedValue(respostaJson({ ...compra('pending'), approved: false, pix: { qr_code: 'x' } }, 201));

    await comprarPix(7, '123.456.789-00', 'chave-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.teste/api/checkout/pix');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok-123');
    expect(init.headers['Idempotency-Key']).toBe('chave-1');
    expect(JSON.parse(init.body)).toEqual({ plan_id: 7, client: 'v2', cpf: '123.456.789-00' });
  });

  it('cartão manda os dados do formulário junto com plano e client', async () => {
    fetchMock.mockResolvedValue(respostaJson({ ...compra('pending'), approved: true }, 201));

    await comprarCartao(7, {
      card_number: '4111', card_name: 'A', card_expiry_month: '12', card_expiry_year: '2030', card_cvv: '123',
      cpf: '1', phone: '1', cep: '1', street: 'R', number: '1', neighborhood: 'B', city: 'C', state: 'SP',
    }, 'chave-2');

    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.teste/api/checkout/card');
    expect(corpo.plan_id).toBe(7);
    expect(corpo.client).toBe('v2');
    expect(corpo.card_number).toBe('4111');
  });

  it('erro do servidor vira ErroCobranca com a mensagem certa', async () => {
    fetchMock.mockResolvedValue(respostaJson({ message: 'Pacote indisponível.' }, 409));

    await expect(comprarPix(7, '1', 'k')).rejects.toMatchObject({ name: 'ErroCobranca', status: 409, message: 'Pacote indisponível.' });
  });

  it('falha de rede vira mensagem amigável', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listarPacotes()).rejects.toBeInstanceOf(ErroCobranca);
  });

  it('sem VITE_AUTH_API_URL a compra fica indisponível e nada é chamado', async () => {
    vi.stubEnv('VITE_AUTH_API_URL', '');

    await expect(listarPacotes()).rejects.toThrow('indisponível');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mensagens de erro por status', () => {
    expect(mensagemDeErro(401, {})).toContain('sessão');
    expect(mensagemDeErro(429, {})).toContain('Aguarde');
    expect(mensagemDeErro(422, { errors: { cpf: ['O campo cpf é obrigatório.'] } })).toBe('O campo cpf é obrigatório.');
    expect(mensagemDeErro(500, {})).toContain('Tente novamente');
  });

  it('status e histórico leem o envelope data', async () => {
    fetchMock
      .mockResolvedValueOnce(respostaJson({ data: compra('paid') }))
      .mockResolvedValueOnce(respostaJson({ data: [compra('paid')], meta: { last_page: 3 } }));

    expect((await statusCompra('uuid-1')).status).toBe('paid');
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.teste/api/purchases/uuid-1');
    expect(await minhasCompras(2)).toMatchObject({ ultimaPagina: 3 });
    expect(fetchMock.mock.calls[1][0]).toBe('https://auth.teste/api/purchases?page=2');
  });

  it('chave de idempotência nova a cada chamada', () => {
    expect(novaChave()).not.toBe(novaChave());
  });

  it('valida CPF (11) ou CNPJ (14)', () => {
    expect(documentoValido('123.456.789-00')).toBe(true);
    expect(documentoValido('12.345.678/0001-90')).toBe(true);
    expect(documentoValido('123')).toBe(false);
  });
});

describe('aguardarPagamento', () => {
  const semEspera = async () => {};

  it('para assim que a compra sai de pending', async () => {
    const consultar = vi.fn()
      .mockResolvedValueOnce(compra('pending'))
      .mockResolvedValueOnce(compra('paid'));

    expect(await aguardarPagamento('uuid-1', { consultar, esperar: semEspera })).toBe('paid');
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('erro de rede não interrompe o acompanhamento', async () => {
    const consultar = vi.fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce(compra('expired'));

    expect(await aguardarPagamento('uuid-1', { consultar, esperar: semEspera })).toBe('expired');
  });

  it('desiste no prazo e devolve pending', async () => {
    let relogio = 0;
    const consultar = vi.fn().mockResolvedValue(compra('pending'));

    const status = await aguardarPagamento('uuid-1', {
      consultar,
      intervaloMs: 1000,
      prazoMs: 3000,
      agora: () => relogio,
      esperar: async (ms) => { relogio += ms; },
    });

    expect(status).toBe('pending');
    expect(consultar).toHaveBeenCalledTimes(3);
  });

  it('para quando a página sai (abort)', async () => {
    const controle = new AbortController();
    const consultar = vi.fn().mockImplementation(async () => {
      controle.abort();
      return compra('pending');
    });

    expect(await aguardarPagamento('uuid-1', { consultar, esperar: semEspera, signal: controle.signal })).toBe('pending');
    expect(consultar).toHaveBeenCalledTimes(1);
  });
});

describe('página de compra ligada ao app', () => {
  it('rota /dashboard/creditos, item no menu e botão no cabeçalho', () => {
    expect(source('router/index.tsx')).toContain("{ path: 'creditos', element: <SuspenseWrapper><CreditsPage /></SuspenseWrapper> }");
    expect(source('components/Sidebar.tsx')).toContain("credits: '/dashboard/creditos'");
    expect(source('layouts/AppLayout.tsx')).toContain("navigate('/dashboard/creditos')");
  });

  it('saldo insuficiente leva para a compra', () => {
    expect(source('pages/GenesisPage.tsx')).toContain("if (error?.statusCode === 402) navigate('/dashboard/creditos')");
    expect(source('components/MicroRadarPanel.tsx')).toContain("navigate('/dashboard/creditos')");
  });

  it('pagamento confirmado atualiza o saldo do cabeçalho', () => {
    expect(source('pages/CreditsPage.tsx')).toContain("window.dispatchEvent(new Event('refreshCredits'))");
  });
});
