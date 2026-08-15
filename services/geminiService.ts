
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
import { GenesisAnalysisResult, TradeDirection, ChartMetadata, CandidateSetup, ExecutionStatus, PlanoSetup } from "../types";
import { ExchangeData, fetchWithProxy } from "./cryptoApi";
import { normalizarPar } from "./normalizarPar";
import { obterChaveIdempotencia, encerrarChaveIdempotencia, hashDaImagem, type SubmissaoAnalise } from "./analysisIdempotency";
import type { GraphicalAnalysisResult, GraphicalAnalysisPollResult, GraphicalAnalysisTerminalResult } from "../types/graphicalAnalysis";

// V6.8 (CODE-P0-19): newAnalysisIdempotencyKey() gerava uma chave nova a cada chamada — um retry
// do membro (ou um erro de rede) produzia chave diferente e o backend tratava como submissão nova,
// desarmando a proteção de idempotência por completo. Substituída por
// services/analysisIdempotency.ts, cuja chave é derivada do CONTEÚDO da submissão (símbolo,
// timeframe, alavancagem, hash da imagem) e sobrevive a retries até a análise terminar.

// Spec genesis-analise-grafica-fila-assincrona (Fase 5.3): analyzeChart() não distinguia 422/402/409
// entre si — todo mundo virava o mesmo Error genérico, então quem chamasse não tinha como reagir
// diferente (ex.: mostrar "comprar mais créditos" só no 402). O texto em `.message` continua igual
// (mesmo `alert(error.message)` de sempre em GenesisPage.tsx não precisa mudar), mas agora também
// carrega o status HTTP e o reason_code do backend pra quem quiser tratar de forma específica.
export class GraphicalAnalysisRequestError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly reasonCode?: string | null) {
    super(message);
    this.name = 'GraphicalAnalysisRequestError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Spec genesis-analise-grafica-fila-assincrona (Fase 5.2): a análise agora roda num job de fila, fora
// da requisição do POST — em produção (fila de verdade), o POST devolve `PENDING` quase sempre, e é
// preciso consultar GET /analises/{uuid} até chegar num estado terminal. Não reusa o padrão de
// hooks/useAlertas.ts/useRadarNewsAlerts.ts (singleton de app inteiro, cursor incremental de feed) —
// aqui é "1 análise específica até resolver", forma bem mais simples: intervalo curto, para no
// primeiro estado terminal, desiste depois de um tempo com mensagem clara (não fica esperando pra
// sempre se o worker de fila cair em produção).
const POLL_INTERVAL_MS = 3000;
// Spec genesis-devolucao-v6-7-e-migracao-openai, Fase 9 (P1-02, 12/08/2026): 5 minutos era menor
// que o pior prazo real do backend — o frontend desistia e mostrava "demorando" enquanto o backend
// ainda podia concluir a análise e capturar o crédito, sem o membro nunca ver o resultado (só
// atualizando a página por conta própria descobriria).
// Recalculado com os números reais pós Fases 2/5 deste spec (timeout do job passou a ser por
// provedor ATIVO, ver GraphicalAnalysisAttemptJob::__construct() no backend) — o frontend não sabe
// qual provedor está ativo, então precisa cobrir o pior caso dos dois:
//   Gemini:  3 tentativas × ~105s (timeout do job)  = ~315s (~5,25min)
//   OpenAI:  3 tentativas × ~215s (timeout do job)  = ~645s (~10,75min)  ← pior caso real hoje
// 15 minutos dá margem real sobre o pior caso legítimo (OpenAI, ~10,75min) sem esperar
// indefinidamente. O caminho de "análise travada" (worker de fila caiu — ver
// FinalizarAnalisesTravadas.php, agendado a cada 2min) pode passar dessa margem num cenário de
// falha de infraestrutura real; nesse caso o membro vê a mensagem de demora e pode atualizar depois
// — aceitável, é um caminho de falha de infra, não o caso normal.
// Alternativa melhor considerada e adiada de propósito (Fase 9.2): o backend devolver um prazo
// (`poll_expires_at`) no payload PENDING, calculado a partir do provedor/timeout REAIS de cada
// análise, em vez do frontend manter essa conta duplicada e desatualizável independentemente do
// backend. Não implementado nesta entrega — mudaria o contrato do endpoint
// (AsyncAnalysisResponse::lightweightBody()) e o consumo aqui, escopo maior que só ajustar a
// constante. Registrado como item futuro explícito, não esquecido.
const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

// Spec genesis-analise-grafica-fila-assincrona (Fase 5.4): `signal` opcional — o botão "CANCELAR
// ANÁLISE" (antes só visual, sem onClick nenhum) ganha função de verdade parando de esperar pelo
// poll no cliente. Não cancela o job no servidor (ele continua rodando lá, crédito não é
// estornado só por isso) — só para o membro de ficar preso esperando uma resposta que não quer
// mais ver.
async function pollAnalysisUntilTerminal(
  analysisId: string,
  token: string,
  signal?: AbortSignal,
): Promise<GraphicalAnalysisTerminalResult> {
  const startedAt = Date.now();

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Análise cancelada pelo usuário.', 'AbortError');
    }
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error('A análise está demorando mais que o esperado. Tente novamente em instantes.');
    }

    await sleep(POLL_INTERVAL_MS);
    if (signal?.aborted) {
      throw new DOMException('Análise cancelada pelo usuário.', 'AbortError');
    }

    const res = await fetch(`${API_BASE}/v1/analises/${analysisId}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      signal,
    });

    if (!res.ok) {
      // Falha de rede/servidor durante o poll em si (não é o resultado da análise) — mesma
      // tolerância silenciosa que useAlertas/useRadarNewsAlerts já usam pra chamadas de poll:
      // tenta de novo no próximo ciclo em vez de desistir na primeira falha passageira.
      continue;
    }

    const body = (await res.json()) as GraphicalAnalysisPollResult;
    if (body.status === 'PENDING') {
      continue;
    }

    return body;
  }
}

/* INIT: API Key injection */

// --- GOVERNANCE LAYER CACHE ---
let macroGovernanceCache = {
  date: '',
  content: ''
};

// Isolated cache per asset for sentiment
let sentimentCache: Record<string, any> = {};

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ETAPA 1: O "OLHO" (Processamento Visual / OCR)
// Modelo: gemini-3.1-pro-preview (Alta precisão visual)
// ETAPA 1: Leitura Visual Unificada via Laravel backend

/**
 * Verifica se um erro é 503 ou timeout, indicando necessidade de fallback para modelo flash.
 */
export function isModelOverloadOrTimeout(error: unknown, status?: number): boolean {
  if (status === 503) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('503')) return true;
  }
  if (error instanceof TypeError && error.message.includes('fetch')) return true;
  return false;
}

// V6.6 (H01): unifiedChartAnalysis() removida — chamava /v1/unified-scan, rota que não existe mais
// no backend (só o pacote V6.4 arquivado ainda tinha essa rota), e o fallback pra gemini-2.0-flash
// contrariava a regra de modelo único (DET-2 do PO). Nenhum código de produção chamava a função —
// só testes a exercitavam contra a rota morta (removidos junto, ver __tests__/geminiService.test.ts
// e services/__tests__/integration.e2e.test.ts).

// R3.2 — Adendo Secao 28: OCR 1 estrito, somente metadados (symbol/timeframe/
// exchange/market/confidence). Nao chama unifiedChartAnalysis — nao le nem
// devolve elementos visuais. Dispara na selecao do arquivo, antes do clique
// em Analisar (Invariante 2.3.1/2.3.2 do Adendo).
export interface StrictChartMetadata {
  pair: string;
  symbol: string;
  timeframe: string;
  exchange: string;
  // V6.5 (D01): 'market' agora bloqueia o scan no backend (ChartMetadataScanService exige FUTURES) —
  // um gráfico SPOT ou não identificado nunca chega a devolver metadados aqui, cai no catch abaixo como
  // ChartMetadataBlockedError. Este campo nunca mais chega como 'SPOT' ou null quando o scan tem sucesso.
  market: 'SPOT' | 'FUTURES' | null;
  confidence: number;
}

// V6.5 (D01): erro distinguível do genérico "falha no OCR" — sinaliza que o próprio backend recusou
// o gráfico por não ser FUTURES (SPOT detectado ou mercado não identificado com segurança), pra a tela
// bloquear o clique em "Analisar" e não gastar crédito numa análise que já se sabe que vai falhar.
export class ChartMetadataBlockedError extends Error {
  constructor(message: string, public readonly blockedReason: string) {
    super(message);
    this.name = 'ChartMetadataBlockedError';
  }
}

export const scanChartMetadata = async (file: File, selectedExchange?: string): Promise<StrictChartMetadata> => {
  const formData = new FormData();
  formData.append('image', file);
  if (selectedExchange) formData.append('exchange', selectedExchange);

  const token = localStorage.getItem('genesis_token');
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}/v1/scangraph`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    if (errData.blocked_reason === 'MARKET_NOT_FUTURES') {
      throw new ChartMetadataBlockedError(
        errData.error || 'Este gráfico não é de mercado FUTURES.',
        errData.blocked_reason
      );
    }
    throw new Error(errData.error || `Falha no OCR de metadados: HTTP ${response.status}`);
  }

  const payload = await response.json();
  const raw = payload.content ?? payload;
  const parsed = typeof raw === 'string'
    ? JSON.parse(raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim())
    : raw;

  const symbol = normalizarPar(String(parsed.symbol ?? ''));
  // V6.6 (D01): o backend é a autoridade de normalização de timeframe agora (TimeframeNormalizer),
  // capaz de distinguir "1M" (mês, pt-BR) de "1m" (minuto) pelo rótulo. .toLowerCase() aqui destruía
  // essa distinção antes mesmo do valor chegar à API — repassa o valor lido, sem transformar.
  const timeframe = String(parsed.timeframe ?? '').trim();
  const exchange = String(parsed.exchange ?? '').trim().toUpperCase();
  const market = String(parsed.market ?? '').trim().toUpperCase();
  const confidence = Number(parsed.confidence ?? 0);

  if (!symbol || !timeframe || !exchange) {
    throw new Error('Par, timeframe ou corretora não foram identificados com segurança.');
  }

  if (!Number.isFinite(confidence) || confidence < 0.85) {
    throw new Error('A confiança do OCR de metadados ficou abaixo do mínimo.');
  }

  return {
    pair: symbol,
    symbol,
    timeframe,
    exchange,
    market: (market === 'SPOT' || market === 'FUTURES') ? market : null,
    confidence,
  };
};
// Placeholder visual (2026-07-27): o motor V6.4 não calcula entrada/stop/TP (só direção,
// score e contexto informativo) — nenhum valor é calculado no frontend, é literalmente um
// objeto vazio (todos os campos null) só para a Zona de Entrada/Metas/Stop aparecerem na
// tela com "—"/"N/A". Os dados reais entram depois, quando o backend voltar a mandá-los.
const emptyCandidateSetup: CandidateSetup = {
  entrada: null,
  stop: null,
  tp1: null, tp1_fonte: null,
  tp2: null, tp2_fonte: null, tp2_motivo: null,
  tp3: null, tp3_fonte: null, tp3_motivo: null,
  alavancagem: null,
  alavancagem_info: null,
  liquidacao: null,
  liquidacao_rotulo: null,
  risco_preco_pct: null,
  risco_margem_pct: null,
  risco_usd_estimado: null,
  nocional_estimado: null,
  quantidade_base_estimada: null,
  ativo_base: null,
  rr_bruto: null,
  rr_liquido_estimado: null,
  rr_aviso: null,
  rr_minimo_referencia: null,
  rr_abaixo_do_minimo: false,
  custos_bps: {},
  entrada_ts: null,
  qualidade_entrada: null,
  // V6.7 (A-13): placeholder também precisa dos campos novos do contrato do stop.
  stop_status: 'STOP_UNAVAILABLE',
  stop_ancora: null,
  stop_buffer: null,
  stop_motivo: null,
  // V6.7 (B-20): idem, placeholder também precisa dos campos novos de verificação de liquidação.
  verificacao: null,
  verificacao_motivo: null,
};

// Adaptador (2026-07-27): traduz a resposta do motor V6.4 (rota /v1/graphical-analysis) para o
// contrato antigo que AnalysisResult.tsx espera. Restauração pós-entrega (mesmo dia): quando o
// backend manda v64.execution (pipeline restaurado — ExecucaoService/MotorExecucaoService, calculado
// DEPOIS da decisão do Gemini, sem alterar direção/score), usa os dados reais; senão cai no
// placeholder vazio (motor sem dado disponível para essa análise específica).
const mapGraphicalToLegacy = (v64: GraphicalAnalysisResult): GenesisAnalysisResult => {
  const ctx = v64.informative_context;
  const macroNarrative = ctx?.macro?.narrative?.value ?? null;
  const sentimentNarrative = ctx?.sentiment?.narrative?.value ?? null;
  const exec = v64.execution;

  // V6.8 (spec genesis-v6-8-correcao-tecnica, Fase 7, CODE-P1-06/P1-08, 14/08/2026): este adaptador
  // descartava VIX/DXY/S&P 500 (macro) e Fear&Greed/dominância do BTC (sentimento) — a API sempre
  // devolveu esses números em informative_context.macro/sentiment (EvidenceValue), só a narrativa
  // (macro.narrative/sentiment.narrative) chegava até a tela. Achado real: os dois nunca dependem um
  // do outro (a narrativa pode faltar com os números presentes, e vice-versa), por isso os stats
  // brutos entram como objeto próprio, mesclado com a narrativa quando ela existe, em vez de
  // condicionados à presença dela.
  const macroStats = {
    vix: ctx?.macro?.vix?.value ?? null,
    dxy_change_pct: ctx?.macro?.dxy_change_pct?.value ?? null,
    sp500_change_pct: ctx?.macro?.sp500_change_pct?.value ?? null,
  };
  const sentimentStats = {
    fear_greed: ctx?.sentiment?.fear_greed?.value ?? null,
    btc_dominance: ctx?.sentiment?.btc_dominance?.value ?? null,
  };
  const macroTemDado = macroNarrative != null || Object.values(macroStats).some((v) => v != null);
  const sentimentoTemDado = sentimentNarrative != null || Object.values(sentimentStats).some((v) => v != null);

  return {
    analysis_id: v64.analysis_id,
    pair: v64.pair,
    analysis_version: v64.analysis_version,
    market_price: v64.market_price,
    snapshot_observed_at: v64.snapshot_observed_at,
    analysis: {
      direction: v64.direction,
      status: 'CONCLUIDA',
      conviccao_modelo: v64.score,
      reason_code: null,
      justificativa_score: v64.score_description,
      score_justification: v64.score_description,
      narrativa_tecnica: v64.technical_analysis,
      technical_analysis: v64.technical_analysis,
      conviction: v64.score,
      coverage: v64.coverage_percent ?? undefined,
      // V6.5 (G14): antes leitura_fraca vinha chumbado em false e base_conviction reintroduzia o
      // score final com outro nome — nenhum dos dois refletia dado real. cobertura_baixa é derivado
      // de coverage_percent de verdade.
      // V6.7 (H-47): limiar recalibrado de 70 para 75 no MESMO commit que mudou o denominador de
      // coverage_percent (EvidenceManifestBuilder.php) de "tudo menos DISPLAY_ONLY" (66 itens, ainda
      // contava os 20 CONTEXT) para "só DECISION" (46 itens) — o documento descreve que isso sobe a
      // cobertura estruturalmente 4-6 pontos pra qualquer análise (itens CONTEXT tendem a faltar mais
      // que os DECISION: fontes macro/sentimento/derivativos secundários). 75 é o meio da faixa
      // estimada — **valor provisório, precisa de confirmação com cobertura real de análises pós-
      // correção antes do gate final (seção 25)**, não uma medição própria (não rodei análise real
      // nesta sessão).
      cobertura_baixa: v64.coverage_percent != null ? v64.coverage_percent < 75 : undefined,
    },
    execution: exec ? {
      status: exec.status as ExecutionStatus,
      executable: exec.executable,
      // V6.5 (E02): campo novo do backend — default true (equivalente ao comportamento antigo, onde
      // executable já implicava recomendado) só quando a resposta vier de uma decisão cacheada antes
      // deste campo existir.
      recommended: exec.recommended ?? exec.executable,
      action: exec.action,
      direction_reference: exec.direction_reference,
      reason_code: exec.reason_code,
      motivo: exec.motivo,
      // V6.7 (G-44): tipos unificados com o contrato real do backend (types/graphicalAnalysis.ts) —
      // ExecutionCandidateSetup/ExecutionPlanoSetup/ExecutionPlanB são estruturalmente compatíveis com
      // CandidateSetup/PlanoSetup/ExecutionPlanB (types.ts) depois da correção, sem precisar de cast.
      candidate_setup: exec.candidate_setup ?? emptyCandidateSetup,
      executable_setup: exec.executable_setup,
      planoB: exec.planoB,
      // V6.5 (E08): campo novo do backend — vazio quando a resposta vier de uma decisão cacheada
      // antes deste campo existir (a tela cai no fallback de candidate_setup/planoB nesse caso).
      planos: exec.planos ?? [],
      zonaInteresse: exec.zonaInteresse,
      avisos: exec.avisos,
      stop_ancora: exec.stop_ancora,
    } : {
      status: 'INDISPONIVEL',
      executable: false,
      recommended: false,
      action: null,
      direction_reference: v64.direction,
      reason_code: 'V6_4_EXECUCAO_INDISPONIVEL',
      motivo: 'Não foi possível calcular o setup de entrada/stop/TP para esta análise (preço ou ATR indisponível).',
      candidate_setup: emptyCandidateSetup,
      executable_setup: null,
      planoB: null,
      planos: [],
      zonaInteresse: null,
      avisos: [],
      stop_ancora: null,
    },
    contexto_informativo: (macroTemDado || sentimentoTemDado) ? {
      macro: macroTemDado ? { ...(macroNarrative ?? {}), ...macroStats } : null,
      sentimento: sentimentoTemDado ? { ...(sentimentNarrative ?? {}), ...sentimentStats } : null,
    } : null,
    ai_meta: {},
    indicadores: {
      rsi: ctx?.indicators?.rsi14?.value ?? null,
      adx: ctx?.indicators?.adx14?.value ?? null,
      // V6.8 (Fase 7, CODE-P1-07): DMI completo — +DI/-DI/inclinação do ADX, publicados pelo
      // backend desde a Fase 6.1 (AnalysisPublicResponseBuilder.php), nunca lidos aqui até agora.
      plus_di: ctx?.indicators?.plus_di14?.value ?? null,
      minus_di: ctx?.indicators?.minus_di14?.value ?? null,
      adx_subindo: ctx?.indicators?.adx_rising?.value ?? null,
      atr: ctx?.indicators?.atr14?.value ?? null,
      ema21: ctx?.indicators?.ema21?.value ?? null,
      ema50: ctx?.indicators?.ema50?.value ?? null,
      ema200: ctx?.indicators?.ema200?.value ?? null,
    },
    // V6.8 (Fase 7, CODE-P1-06): contexto de derivativos (força/risco de squeeze) sempre chegou
    // pronto em GraphicalAnalysisResult.derivatives_context e nunca era repassado.
    derivatives_context: v64.derivatives_context ?? null,
    wyckoff: (ctx?.indicators?.wyckoff?.value as Record<string, unknown> | null) ?? undefined,
    sessao: ctx?.indicators?.session?.value
      ? { nome: ctx.indicators.session.value.name, cor: 'text-white' }
      : undefined,
    multiTimeframe: (ctx?.indicators?.multi_timeframe?.value as { timeframe: string; bias: string }[] | null) ?? [],
    // V6.7 (G-44): ScoreBasis importado do contrato real, sem cast.
    score_basis: v64.score_basis,
    // V6.6 (A04): visual_observations.patterns chegava na resposta e era descartado aqui — nenhum
    // componente da tela renderizava figura, mesmo com o Gemini identificando um padrão claro.
    // V6.8 (Fase 7, CODE-P1-06): objects/fibonacci/vrvp tinham o mesmo destino — descartados aqui,
    // apesar de a API sempre devolvê-los prontos em visual_observations.
    visual_observations: {
      patterns: v64.visual_observations?.patterns ?? [],
      objects: v64.visual_observations?.objects ?? [],
      fibonacci: v64.visual_observations?.fibonacci ?? [],
      vrvp: v64.visual_observations?.vrvp ?? null,
    },
  };
};

// ETAPA 2: Analise completa via Laravel backend (motor V6.4)
export const analyzeChart = async (
  file: File,
  metadata: ChartMetadata,
  equity: string,
  marketData: ExchangeData,
  activeExchange: string,
  userLeverage: number,
  cvdDataParam: { delta: number, priceChangePercent: number } | null,
  entryValue: number | '' = '',
  // Spec genesis-analise-grafica-fila-assincrona (Fase 5.4): opcional de propósito — só afeta a fase
  // de poll (depois que o job já foi despachado e o crédito já foi debitado). Cancelar o POST em si
  // não faz sentido: nesse ponto o crédito já pode ter sido reservado no backend, abortar o fetch só
  // deixaria o cliente sem saber o resultado, sem realmente desfazer nada do lado do servidor.
  signal?: AbortSignal,
): Promise<GenesisAnalysisResult> => {
  // R3.2 — Adendo Secao 28: sem defaults silenciosos. Par e timeframe
  // precisam ter sido resolvidos antes de enviar a analise.
  if (!metadata.pair || !metadata.timeframe) {
    throw new Error('Metadados obrigatórios ausentes. Refaça a leitura do gráfico.');
  }

  const token = localStorage.getItem('genesis_token');
  if (!token) {
    throw new Error('Sessão expirada. Entre novamente.');
  }

  const fd = new FormData();
  fd.append('image', file);
  fd.append('symbol', metadata.pair);
  fd.append('timeframe', metadata.timeframe);
  // V6.7 (B-18/B-23): antes só enviava quando > 0 — se o estado de alavancagem no app zerasse por
  // qualquer motivo, o campo simplesmente sumia da requisição e o backend caía no default
  // silencioso (0). Agora sempre envia; leverage <= 0 volta como erro de requisição explícito do
  // backend (GraphicalAnalysisRequest::rules()), nunca um 1x aplicado sem avisar.
  fd.append('leverage', String(userLeverage));
  if (equity && Number(equity) > 0) fd.append('equity', equity);

  // V6.8 (CODE-P0-19): a chave é derivada do conteúdo da submissão, não gerada às cegas a cada
  // chamada — um retry do MESMO gráfico (símbolo, timeframe, alavancagem, hash da imagem iguais)
  // reutiliza a mesma chave em vez de abrir uma segunda análise/cobrança.
  const submissao: SubmissaoAnalise = {
    symbol: metadata.pair,
    timeframe: metadata.timeframe,
    alavancagem: userLeverage,
    imagemHash: await hashDaImagem(file),
  };

  const res = await fetch(`${API_BASE}/v1/graphical-analysis`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': obterChaveIdempotencia(submissao),
    },
    body: fd,
  });

  if (!res.ok) {
    // Erros síncronos (validação do formulário, crédito insuficiente, Idempotency-Key já encerrada)
    // — acontecem ANTES do job ser despachado, resposta HTTP de erro de verdade (422/402/409),
    // igual sempre foi. A chave NÃO é encerrada aqui de propósito: se o erro for de rede (fetch
    // nunca chega a responder, cai no catch de quem chamou analyzeChart) ou um 5xx passageiro, o
    // próximo envio do mesmo gráfico precisa cair na mesma chave — é exatamente o cenário que
    // CODE-P0-19 existe para cobrir.
    const errData = await res.json().catch(() => ({}));
    // V6.6 (D01): num 422 o Laravel devolve { message, errors }, não { error } — a leitura antiga
    // sempre caía no fallback genérico e o membro nunca descobria qual campo falhou (ex.: timeframe
    // não reconhecido).
    const detalhe =
      errData.error ??
      errData.message ??
      (errData.errors ? Object.values(errData.errors).flat().join(' ') : null);
    throw new GraphicalAnalysisRequestError(
      detalhe || `Falha ao processar a análise técnica (HTTP ${res.status})`,
      res.status,
      errData.reason_code ?? null,
    );
  }

  // Spec genesis-analise-grafica-fila-assincrona (Fase 5.2): a análise passou a rodar num job de
  // fila, fora desta requisição — a resposta do POST pode já vir resolvida (`COMPLETED`/
  // `REJECTED_IMAGE`/`FAILED`, comum em dev com fila síncrona) ou `PENDING` (comum em produção com
  // fila de verdade, até o worker processar), caso em que aguardamos via poll. `const` + ternário
  // em vez de reatribuir `let` — o TypeScript perde o estreitamento de `status` depois de uma
  // reatribuição dentro de um `if`, então `resolved` nunca chegaria tipado como só os estados
  // finais lá embaixo.
  const initial = (await res.json()) as GraphicalAnalysisPollResult;
  const resolved: GraphicalAnalysisTerminalResult = initial.status === 'PENDING'
    ? await pollAnalysisUntilTerminal(initial.analysis_id, token, signal)
    : initial;

  // V6.8 (CODE-P0-19): estado terminal atingido — sucesso ou falha, tanto faz. O ciclo de vida
  // desta submissão acabou; reenviar o mesmo gráfico a partir daqui é uma análise NOVA.
  encerrarChaveIdempotencia(submissao);

  if (resolved.status !== 'COMPLETED') {
    throw new GraphicalAnalysisRequestError(
      resolved.motivo || 'Não foi possível concluir a análise.',
      resolved.status === 'REJECTED_IMAGE' ? 422 : 503,
      resolved.reason_code,
    );
  }

  return mapGraphicalToLegacy(resolved);
};
