import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ErroSenha,
  lerLinkDeRedefinicao,
  pedirRecuperacaoSenha,
  redefinirSenha,
  validarNovaSenha,
} from '../services/recuperacaoSenha';

/**
 * Spec genesis-auth-recuperacao-senha (Fase 2): recuperação de senha da v2 pelo [AUTH].
 */

const source = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

function resposta(corpo: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo } as Response;
}

describe('services/recuperacaoSenha', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.teste/');
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('pede o link no [AUTH] informando client v2', async () => {
    fetchMock.mockResolvedValue(resposta({ message: 'Se o e-mail estiver cadastrado, ...' }));

    const msg = await pedirRecuperacaoSenha('  ana@teste.com ');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.teste/api/auth/forgot-password');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'ana@teste.com', client: 'v2' });
    expect(msg).toBe('Se o e-mail estiver cadastrado, ...');
  });

  it('sem VITE_AUTH_API_URL fica indisponível, sem chamar ninguém', async () => {
    vi.stubEnv('VITE_AUTH_API_URL', '');
    await expect(pedirRecuperacaoSenha('a@b.com')).rejects.toThrow('indisponível');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('429 vira "aguarde um minuto"', async () => {
    fetchMock.mockResolvedValue(resposta({ message: 'Too Many Attempts.' }, 429));
    await expect(pedirRecuperacaoSenha('a@b.com')).rejects.toThrow('Aguarde um minuto');
  });

  it('falha de rede vira "sem conexão"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(pedirRecuperacaoSenha('a@b.com')).rejects.toThrow('Sem conexão');
  });

  it('redefinir envia token, e-mail e as duas senhas', async () => {
    fetchMock.mockResolvedValue(resposta({ message: 'Senha redefinida. Entre com a senha nova.' }));

    const msg = await redefinirSenha({ token: 't1', email: 'a@b.com', password: 'senha-123', password_confirmation: 'senha-123' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.teste/api/auth/reset-password');
    expect(JSON.parse(init.body)).toEqual({ token: 't1', email: 'a@b.com', password: 'senha-123', password_confirmation: 'senha-123' });
    expect(msg).toContain('Senha redefinida');
  });

  it('400 marca o link como inválido (a tela oferece pedir outro)', async () => {
    fetchMock.mockResolvedValue(resposta({ message: 'Link inválido ou expirado. Peça um novo link de recuperação.' }, 400));

    const erro = await redefinirSenha({ token: 'x', email: 'a@b.com', password: 'senha-123', password_confirmation: 'senha-123' })
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ErroSenha);
    expect(erro.linkInvalido).toBe(true);
    expect(erro.message).toContain('Link inválido');
  });

  it('422 mostra a primeira mensagem de validação do [AUTH]', async () => {
    fetchMock.mockResolvedValue(resposta({
      message: 'x',
      errors: { password: ['Esta senha já apareceu em um vazamento de dados. Escolha outra.'] },
    }, 422));

    const erro = await redefinirSenha({ token: 't', email: 'a@b.com', password: 'senha-123', password_confirmation: 'senha-123' })
      .catch((e) => e);

    expect(erro.linkInvalido).toBe(false);
    expect(erro.message).toBe('Esta senha já apareceu em um vazamento de dados. Escolha outra.');
  });

  it('validarNovaSenha: mínimo 8 e confirmação igual', () => {
    expect(validarNovaSenha('abc1234', 'abc1234')).toContain('8 caracteres');
    expect(validarNovaSenha('senha-123', 'senha-124')).toBe('As senhas não coincidem.');
    expect(validarNovaSenha('senha-123', 'senha-123')).toBeNull();
  });

  it('lerLinkDeRedefinicao exige token e e-mail', () => {
    expect(lerLinkDeRedefinicao('?token=abc&email=a%2Bb%40c.com')).toEqual({ token: 'abc', email: 'a+b@c.com' });
    expect(lerLinkDeRedefinicao('?token=abc')).toBeNull();
    expect(lerLinkDeRedefinicao('')).toBeNull();
  });
});

describe('tela e rota', () => {
  it('/redefinir-senha é pública (fora do ProtectedRoute)', () => {
    const router = source('router/index.tsx');
    const rota = router.indexOf("path: '/redefinir-senha'");
    const protegida = router.indexOf('element: <ProtectedRoute />');
    expect(rota).toBeGreaterThan(-1);
    expect(rota).toBeLessThan(protegida);
  });

  it('a página tira o token da barra de endereço', () => {
    const pagina = source('pages/ResetPasswordPage.tsx');
    expect(pagina).toMatch(/history\.replaceState\([^)]*window\.location\.pathname\)/);
    expect(pagina).not.toMatch(/console\.log/);
  });

  it('o login tem "Esqueci minha senha" ligado ao [AUTH]', () => {
    const landing = source('components/LandingPage.tsx');
    expect(landing).toContain('Esqueci minha senha');
    expect(landing).toContain('pedirRecuperacaoSenha(emailInput)');
  });
});
