/**
 * V6.8 (CODE-P0-19) — chave de idempotência estável por submissão.
 *
 * A versão anterior (`newAnalysisIdempotencyKey()` em `geminiService.ts`) gerava a chave DENTRO do
 * próprio fetch, então todo retry gerava chave nova e o backend tratava como submissão nova. A
 * cadeia inteira de reserva e captura de crédito depende de idempotência, e o mecanismo estava
 * desarmado no ponto de entrada.
 *
 * A chave agora é derivada do CONTEÚDO da submissão (símbolo, timeframe, alavancagem e hash da
 * imagem) e persiste em sessionStorage até a análise atingir estado terminal. O mesmo gráfico,
 * reenviado após um erro, reutiliza a chave; um gráfico diferente gera chave nova.
 */
const PREFIXO = 'genesis:idem:';
const VALIDADE_MS = 30 * 60 * 1000;

export interface SubmissaoAnalise {
  symbol: string;
  timeframe: string;
  alavancagem: number;
  imagemHash: string;
}

interface RegistroIdem {
  chave: string;
  criadaEm: number;
}

function assinatura(s: SubmissaoAnalise): string {
  return [s.symbol, s.timeframe, String(s.alavancagem), s.imagemHash].join('|');
}

function gerarChave(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `ga_${crypto.randomUUID()}`;
  }
  return `ga_${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Hash estável do arquivo enviado, para a assinatura da submissão. SHA-256 via Web Crypto quando
 * disponível (contexto seguro/https ou localhost); em contexto inseguro (http puro fora de
 * localhost, onde `crypto.subtle` não existe) cai para um identificador derivado de
 * tamanho+data de modificação — mais fraco, mas nunca lança, e a submissão continua funcionando.
 */
export async function hashDaImagem(arquivo: Blob): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buffer = await arquivo.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return `${arquivo.size}-${(arquivo as File).lastModified ?? 0}`;
}

/**
 * Devolve a chave da submissão. Reutiliza a existente enquanto ela não expirar; cria uma nova
 * quando a submissão muda (símbolo, timeframe, alavancagem ou imagem diferentes) ou quando a
 * anterior já passou da validade.
 */
export function obterChaveIdempotencia(submissao: SubmissaoAnalise): string {
  const id = PREFIXO + assinatura(submissao);

  try {
    const bruto = sessionStorage.getItem(id);
    if (bruto) {
      const registro = JSON.parse(bruto) as RegistroIdem;
      if (registro?.chave && Date.now() - registro.criadaEm < VALIDADE_MS) {
        return registro.chave;
      }
    }
  } catch {
    // sessionStorage indisponível (modo privado, storage cheio, contexto sem Web Storage): segue
    // para gerar uma chave nova. Pior caso volta ao comportamento anterior a esta correção, nunca
    // a um erro que impeça o envio da análise.
  }

  const chave = gerarChave();

  try {
    sessionStorage.setItem(id, JSON.stringify({ chave, criadaEm: Date.now() } satisfies RegistroIdem));
  } catch {
    // idem — sem persistência, a próxima chamada gera outra chave nova; não é o caminho feliz,
    // mas não trava o envio.
  }

  return chave;
}

/**
 * Chamada quando a análise atinge estado terminal (COMPLETED, FAILED, REJECTED_IMAGE) — sucesso ou
 * falha terminal, tanto faz: o ciclo de vida desta tentativa acabou. A partir daí, reenviar o mesmo
 * gráfico é uma análise NOVA e deve gerar chave nova. Não é chamada em erro síncrono (rede caiu,
 * HTTP nunca respondeu) de propósito — nesse caso a chave precisa sobreviver para o retry reusar.
 */
export function encerrarChaveIdempotencia(submissao: SubmissaoAnalise): void {
  try {
    sessionStorage.removeItem(PREFIXO + assinatura(submissao));
  } catch {
    // idem — nada para limpar se sessionStorage não está disponível.
  }
}
