/**
 * Spec genesis-auth-recuperacao-senha (Fase 2): "esqueci minha senha" e "nova senha" da v2,
 * sempre pelo [AUTH] (a genesis-api não tem essas rotas). O `client: 'v2'` faz o e-mail trazer
 * o link de volta para cá (/redefinir-senha).
 */
import { baseDoAuth } from './billing';

export const CLIENTE = 'v2';
export const SENHA_MINIMA = 8;

export class ErroSenha extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** Link vencido ou já usado: a tela oferece pedir outro. */
    public readonly linkInvalido = false,
  ) {
    super(message);
    this.name = 'ErroSenha';
  }
}

function destino(caminho: string): string {
  const base = baseDoAuth();
  if (!base) throw new ErroSenha('Recuperação de senha indisponível no momento.', 0);
  return `${base}${caminho}`;
}

async function enviar(caminho: string, corpo: Record<string, string>): Promise<string> {
  const url = destino(caminho); // fora do try: "indisponível" não pode virar "sem conexão"
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroSenha('Sem conexão. Verifique a internet e tente de novo.', 0);
  }

  const dados: any = await res.json().catch(() => ({}));
  if (res.ok) return dados?.message ?? '';

  if (res.status === 429) {
    throw new ErroSenha('Muitas tentativas. Aguarde um minuto e tente de novo.', 429);
  }
  if (res.status === 400) {
    throw new ErroSenha(dados?.message || 'Link inválido ou expirado. Peça um novo link de recuperação.', 400, true);
  }
  if (res.status === 422) {
    const erros = dados?.errors ? Object.values(dados.errors).flat() : [];
    throw new ErroSenha(String(erros[0] ?? dados?.message ?? 'Confira os dados informados.'), 422);
  }
  throw new ErroSenha('Não foi possível concluir agora. Tente de novo em instantes.', res.status);
}

/** Resposta é sempre a mesma, exista ou não a conta (o [AUTH] não revela quem é cadastrado). */
export async function pedirRecuperacaoSenha(email: string): Promise<string> {
  const msg = await enviar('/auth/forgot-password', { email: email.trim(), client: CLIENTE });
  return msg || 'Se o e-mail estiver cadastrado, você vai receber um link de recuperação.';
}

export async function redefinirSenha(dados: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}): Promise<string> {
  const msg = await enviar('/auth/reset-password', dados);
  return msg || 'Senha redefinida. Entre com a senha nova.';
}

/** Conferência no front antes de enviar. Devolve a mensagem de erro ou null. */
export function validarNovaSenha(senha: string, confirmacao: string): string | null {
  if (senha.length < SENHA_MINIMA) return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  if (senha !== confirmacao) return 'As senhas não coincidem.';
  return null;
}

/** Lê token e e-mail do link do e-mail (`?token=...&email=...`). */
export function lerLinkDeRedefinicao(search: string): { token: string; email: string } | null {
  const p = new URLSearchParams(search);
  const token = p.get('token')?.trim();
  const email = p.get('email')?.trim();
  return token && email ? { token, email } : null;
}
