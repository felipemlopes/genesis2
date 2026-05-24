
import { Type } from "@google/genai";
import { TradeSetup, TradeDirection, ChartMetadata } from "../types";
import { ExchangeData } from "./cryptoApi";
import { generateAdvancedContext } from "./advancedAnalytics";
import { fetchDexScreenerContext, fetchFredMacroContext, fetchDefiLlamaContext, fetchAlternativeMeContext, fetchCryptoCompareContext } from "./externalContextService";
import { fetchMarketConsensus } from "./marketConsensusService";
import { getRecentSpoofs } from "./spoofingService";
import { detectMarketPhase } from "./marketPhaseService";
import { evaluateLocationQuality } from "./locationQualityService";
import { evaluateExhaustionRisk } from "./exhaustionRiskService";
import { evaluateFlowConfirmation } from "./flowConfirmationService";
import { buildEntryPlan } from "./entryPlannerService";
import { calculateProbabilityScore } from "./probabilityScoreEngine";
import { buildAnalysisGovernance } from "./analysisGovernor";
import { detectLiquiditySweep, SweepDetectionOutput } from "./liquiditySweepDetector";
import { calculateMaturityPenalty, MaturityOutput } from "./maturityPenalty";
import { analyzeCvdDivergence, CvdAnalysisOutput } from "./cvdDivergenceAnalyzer";
import { validateOcrExtraction } from "./ocrValidationService";
import { buildLiquidityMap, LiquidityMapResult } from "./liquidityMapService";
import { classifyRegime, RegimeClassifierResult } from "./regimeClassifierService";
import { classifyVolatilityRegime, VolatilityRegimeResult } from "./volatilityRegimeService";
import { buildPredictiveEntryPlan, PredictiveEntryPlannerResult } from "./predictiveEntryPlannerService";
import { fetchWithProxy } from "./cryptoApi";
import { fetchInstitutionalFlow, InstitutionalFlowData } from "./institutionalDataService";
import { fetchIntermarketCorrelations, IntermarketData } from "./intermarketCorrelationService";
import { runSentimentEngine } from "./sentimentEngine";
import { runQuantitativeEngine } from "./quantitativeEngine";
import { runOnChainEngine } from "./onChainEngine";

export type FinalOperationalContext = {
  structuralBias: "long" | "short";
  currentEntryStatus: "valid" | "weak" | "invalid";
  bestPointAlreadyPassed: boolean;
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
  finalScore: number;
  nearestDefense?: number;
  nearestAcceptanceZone?: number;
  nextLiquidityZone?: number;
  nextActionableZone?: number;
  nextActionCondition?: string;
  noTradeReason?: string;
};

export type ExecutionContext = {
  marketPhase: ReturnType<typeof detectMarketPhase>;
  locationQuality: ReturnType<typeof evaluateLocationQuality>;
  exhaustionRisk: ReturnType<typeof evaluateExhaustionRisk>;
  flowConfirmation: ReturnType<typeof evaluateFlowConfirmation>;
  entryPlan: ReturnType<typeof buildEntryPlan>;
  probabilityScore: ReturnType<typeof calculateProbabilityScore>;
  analysisGovernance: ReturnType<typeof buildAnalysisGovernance>;
  sweepDetection: SweepDetectionOutput;
  maturityPenalty: MaturityOutput;
  cvdDivergence: CvdAnalysisOutput;
  liquidityMap: LiquidityMapResult;
  predictiveEntryPlan: PredictiveEntryPlannerResult;
  regimeClassifierResult: RegimeClassifierResult;
  volatilityRegimeResult: VolatilityRegimeResult;
  finalOperationalContext?: FinalOperationalContext;
  institutionalFlow?: InstitutionalFlowData;
  intermarketCorrelations?: IntermarketData;
};

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

// Robust generation without Fallback to lower models
const generateWithRetry = async (
    modelName: string, 
    params: any, 
    retries = 3, 
    delay = 2000
): Promise<any> => {
  try {
    const response = await fetch('/api/gemini-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        contents: params.contents,
        config: params.config
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try { errorData = JSON.parse(errorText); } catch(e) {}
      
      const errorObj = new Error(errorData?.error || errorData?.message || errorText || `HTTP error ${response.status}`);
      (errorObj as any).status = response.status;
      (errorObj as any).code = errorData?.code || response.status;
      (errorObj as any).error = errorData;
      throw errorObj;
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Gemini Error (${modelName}):`, error);
    
    // Check for 429 (Quota) or 503 (Overloaded)
    const isQuotaError = error.status === 429 || 
                         error.code === 429 || 
                         error.status === 'RESOURCE_EXHAUSTED' ||
                         (error.error && error.error.code === 429) ||
                         (error.message && error.message.includes('429')) ||
                         (error.message && error.message.includes('RESOURCE_EXHAUSTED'));
    
    // Check for 404 (Model Not Found)
    const isNotFoundError = error.status === 404 || 
                            error.code === 404 || 
                            error.status === 'NOT_FOUND' ||
                            (error.error && error.error.code === 404);

    if (retries > 0 && !isQuotaError) {
      const waitTime = delay;
      console.warn(`Retrying... (${retries} attempts left) in ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return generateWithRetry(modelName, params, retries - 1, waitTime * 1.5);
    }
    
    if (isQuotaError) {
        throw new Error("Limite de cota da API do Gemini excedido (Erro 429: RESOURCE_EXHAUSTED). Por favor, verifique o faturamento do seu projeto no Google Cloud ou aguarde a renovação da cota.");
    }
    
    if (isNotFoundError) {
        throw new Error(`Modelo ${modelName} não disponível.`);
    }

    throw error;
  }
};

// ETAPA 1: O "OLHO" (Processamento Visual / OCR)
// Modelo: gemini-3.1-pro-preview (Alta precisão visual)
export const scanChartMetadata = async (file: File): Promise<ChartMetadata> => {
  
  const base64Image = await fileToGenerativePart(file);
  
  const prompt = `Você é um scanner visual especializado em gráficos de trading. Sua ÚNICA função é extrair metadados reais e os elementos GRÁFICOS desenhados pelo usuário.
AVISO CRÍTICO: VOCÊ DEVE LER O NOME DO ATIVO/PAR DE MOEDAS ESCRITO NA IMAGEM (geralmente no canto superior esquerdo ou na marca d'água do fundo). NÃO ALUCINE O NOME DO ATIVO. Se você estiver vendo a moeda PEPE, retorne PEPEUSDT. NUNCA RETORNE BTCUSDT SE A IMAGEM NÃO ESTIVER CLARAMENTE ESCRITO BITCOIN/BTC.

Você DEVE extrair APENAS estes elementos em JSON:

{
  "symbol": "SUIUSDT", // Nome do par (ex: SUIUSDT, BTCUSD, EIGENUSDT) extraído da imagem
  "timeframe": "1D", // Timeframe (ex: 1D, 4H, 1H, 15m) extraído da imagem
  "exchange": "Binance", // Corretora (ex: Bybit, Binance, BitGet, OKX) identificada pelo logo/layout
  "linhas_tendencia": [
    {"tipo": "LTA|LTB|HORIZONTAL", "pontos": [[x1,y1],[x2,y2]], "cor": "string"}
  ],
  "caixas": [
    {"label": "string", "top": float, "bottom": float, "left": float, "right": float}
  ],
  "suportes": [float, float],
  "resistencias": [float, float],
  "fibonacci": [float, float, float],
  "anotacoes": [
    {"texto": "string", "posicao": [x,y]}
  ],
  "padroes_monitorados": ["string"],
  "setas": [
    {"direcao": "UP|DOWN", "origem": [x,y], "destino": [x,y]}
  ]
}

Se não houver elementos desenhados, retorne os metadados (symbol, timeframe, exchange) e arrays vazios.

NUNCA retorne valores de RSI, ADX, MACD, preço atual, ou qualquer número que apareça em indicadores do painel inferior. Esses dados virão de APIs separadas.

AVISO EXTREMAMENTE IMPORTANTE: VOCÊ DEVE OBRIGATORIAMENTE IDENTIFICAR O NOME DA CRIPTOMOEDA SENDO MOSTRADA. OLHE NO CANTO SUPERIOR ESQUERDO DO GRÁFICO DA IMAGEM OU NA MARCA D'ÁGUA E IDENTIFIQUE A MOEDA. NUNCA DEVOLVA "BTCUSDT" OU "UNKNOWN" SE VOCÊ ESTIVER VENDO OUTRA MOEDA ESCRITA, COMO PEPE, WIF, SOL, SUI, ETC. SE FOR SÓ O NOME (EX: PEPE), DEVOLVA PEPEUSDT.`;

  try {
    const response = await generateWithRetry("gemini-3.1-pro-preview", {
      contents: {
        parts: [{ inlineData: { mimeType: file.type, data: base64Image } }, { text: prompt }]
      },
      config: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    });
    
    if (!response.text) return { pair: '', timeframe: '' };
    
    let jsonText = response.text.trim();
    
    let tempText = jsonText;
    const jsonMatch = tempText.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonMatch) {
        tempText = jsonMatch[1];
    } else {
        tempText = tempText.replace(/^```json\s*/i, "").replace(/```\s*$/, "");
        const firstBrace = tempText.indexOf('{');
        const lastBrace = tempText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            tempText = tempText.slice(firstBrace, lastBrace + 1);
        } else if (firstBrace !== -1) {
            tempText = tempText.slice(firstBrace);
        }
    }
    jsonText = tempText.trim();
    
    let parsed: any;
    try {
        parsed = JSON.parse(jsonText);
    } catch (parseError: any) {
        console.warn("Scan JSON parse failed, repairing...", parseError.message);
        try {
            let temp = jsonText.trim();
            let inString = false;
            let escape = false;
            for (let i = 0; i < temp.length; i++) {
                if (escape) { escape = false; continue; }
                if (temp[i] === '\\') { escape = true; continue; }
                if (temp[i] === '"') { inString = !inString; continue; }
            }
            if (inString) temp += '"';
            
            temp = temp.trim();
            if (temp.endsWith(',')) temp = temp.slice(0, -1);
            if (temp.endsWith(':')) temp += ' null';
            
            let openBraces = 0, closeBraces = 0;
            let openBrackets = 0, closeBrackets = 0;
            inString = false;
            escape = false;
            for (let i = 0; i < temp.length; i++) {
                if (escape) { escape = false; continue; }
                if (temp[i] === '\\') { escape = true; continue; }
                if (temp[i] === '"') { inString = !inString; continue; }
                if (!inString) {
                    if (temp[i] === '{') openBraces++;
                    if (temp[i] === '}') closeBraces++;
                    if (temp[i] === '[') openBrackets++;
                    if (temp[i] === ']') closeBrackets++;
                }
            }
            
            while (closeBrackets < openBrackets) { temp += ']'; closeBrackets++; }
            while (closeBraces < openBraces) { temp += '}'; closeBraces++; }
            
            parsed = JSON.parse(temp);
        } catch (repairError) {
             throw new Error(`Unexpected end of JSON input. Raw output: ${jsonText.slice(0, 1000)}...`);
        }
    }
    const symbolClean = parsed.symbol 
        ? parsed.symbol.toUpperCase().replace('/', '').replace('PERP', '').replace('.P', '').trim() 
        : '';
    
    // Extract EMAs from detectedIndicators for backward compatibility if needed
    const indicators = parsed.detectedIndicators || [];
    const emas = indicators
        .filter((ind: string) => ind.toUpperCase().includes('EMA'))
        .map((ind: string) => ind.replace(/[^0-9]/g, ''))
        .filter((val: string) => val !== '');

    return {
        pair: symbolClean,
        exchange: parsed.exchange || 'Binance',
        timeframe: parsed.timeframe || '4h',
        symbol: symbolClean,
        price: parsed.price,
        detectedIndicators: indicators,
        visualMarkings: parsed.visualMarkings || [],
        detectedEMAs: emas.length > 0 ? emas : (parsed.detectedEMAs || []),
        adx: parsed.adx !== undefined ? parsed.adx : null,
        pdi: parsed.pdi !== undefined ? parsed.pdi : null,
        mdi: parsed.mdi !== undefined ? parsed.mdi : null,
        pocPrice: parsed.pocPrice !== undefined ? parsed.pocPrice : null,
        hvmNodes: parsed.hvmNodes || [],
        lvmNodes: parsed.lvmNodes || []
    } as ChartMetadata;

  } catch (e) { 
    console.error("Scan Error:", e);
    return { pair: '', timeframe: '' }; 
  }
};

// ETAPA 2: A "MENTE" (Interpretação e Análise)
// Modelo: gemini-3.1-pro-preview (Raciocínio lógico avançado e contexto visual)
import { buscarDadosAdaptados } from './adaptedDataFetcher';

export const analyzeChart = async (
  file: File,
  metadata: ChartMetadata,
  equity: string,
  marketData: ExchangeData,
  activeExchange: string,
  userLeverage: number,
  cvdDataParam: { delta: number, priceChangePercent: number } | null,
  entryValue: number | '' = ''
): Promise<TradeSetup> => {
  const userPair = metadata.pair || "BTCUSDT";
  const userTimeframe = metadata.timeframe || "1D"; 
  const currentExchange = activeExchange || metadata.exchange || "Binance";

  const base64Image = await fileToGenerativePart(file);

  // ETAPA 1 DO NOVO MOTOR - LEITURA INTELIGENTE DO GRÁFICO
  const promptVisual = `Você receberá a imagem de um gráfico de criptomoeda. O par de negociação é ${userPair}, a corretora é ${currentExchange} e o timeframe é ${userTimeframe}, esses dados já foram confirmados pelo sistema. Analise a imagem e retorne APENAS um objeto JSON válido sem nenhum texto adicional antes ou depois, com a seguinte estrutura. O campo indicadores_visiveis deve ser um array com objetos contendo nome e periodos para cada indicador visível no gráfico como EMAs médias móveis RSI MACD ADX Bandas de Bollinger e outros. O campo figuras_graficas deve ser um array com objetos contendo tipo e descricao para cada figura gráfica identificada como triângulo cunha bandeira canal ombro-cabeça-ombro e outros. O campo padroes_candle deve ser um array com objetos contendo tipo e relevancia para padrões de candle relevantes nos últimos 3 candles como engolfo martelo doji estrela e outros. O campo zonas_visuais deve ser um array com objetos contendo tipo que pode ser suporte ou resistencia ou demanda ou oferta e nivel_aproximado em valor numérico estimado do preço naquele nível. O campo estrutura deve ser um objeto com campo tendencia que pode ser alta ou baixa ou lateral e campo topos_e_fundos que pode ser ascendente ou descendente ou indefinido. Retorne apenas o JSON.`;

  let jsonVisual = {};
  try {
    const responseVisual = await generateWithRetry("gemini-2.0-flash", {
      contents: {
        parts: [{ inlineData: { mimeType: file.type, data: base64Image } }, { text: promptVisual }]
      },
      config: {
        temperature: 0,
        responseMimeType: "application/json"
      }
    });

    if (responseVisual.text) {
        let text = responseVisual.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        jsonVisual = JSON.parse(text);
    }
  } catch (e) {
      console.error("Erro na leitura inteligente do gráfico:", e);
  }

  // Lógica de busca dinâmica via API
  const dadosAdaptados = await buscarDadosAdaptados(jsonVisual, userPair, userTimeframe);

  // NÍVEL 2 FALLBACK VIA GRÁFICO (somente se algum falhar na API)
  const missingIndicators = [];
  if (dadosAdaptados.indicadores_calculados) {
      for (const key of Object.keys(dadosAdaptados.indicadores_calculados)) {
          if (dadosAdaptados.indicadores_calculados[key].fonte === 'INDISPONIVEL') {
              missingIndicators.push(key);
          }
      }
  }
  if (!dadosAdaptados.dados_mercado?.atr || dadosAdaptados.dados_mercado.atr.fonte === 'INDISPONIVEL') {
      missingIndicators.push('ATR');
  }

  if (missingIndicators.length > 0) {
      const fallbackPrompt = `Analise esta imagem de gráfico e retorne APENAS um JSON com os valores numéricos visíveis dos seguintes indicadores se aparecerem na imagem. Para cada EMA ou média móvel visível retorne o período e o valor numérico aproximado em dólar ou na moeda do par. Para RSI retorne o valor numérico atual visível no painel do indicador. Para ADX retorne o valor numérico atual. Para ATR retorne o valor numérico atual. Retorne apenas o JSON sem texto adicional. Se um indicador não estiver visível na imagem omita ele do JSON.`;
      try {
          const fallbackResponse = await generateWithRetry("gemini-2.0-flash", { 
              contents: {
                  parts: [{ inlineData: { mimeType: file.type, data: base64Image } }, { text: fallbackPrompt }]
              },
              config: {
                  temperature: 0,
                  responseMimeType: "application/json"
              }
          });
          if (fallbackResponse.text) {
              const cleanedText = fallbackResponse.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
              const fallbackJson = JSON.parse(cleanedText);
              
              // Map fallback values
              if (fallbackJson) {
                 for (const key of Object.keys(fallbackJson)) {
                     const keyUp = key.toUpperCase();
                     if (keyUp.includes('EMA') && fallbackJson[key].valor) {
                        const p = fallbackJson[key].periodo || key.match(/\d+/)?.[0] || 21;
                        if (dadosAdaptados.indicadores_calculados[`EMA_${p}`] && dadosAdaptados.indicadores_calculados[`EMA_${p}`].fonte === 'INDISPONIVEL') {
                            dadosAdaptados.indicadores_calculados[`EMA_${p}`].valor_atual = fallbackJson[key].valor;
                            dadosAdaptados.indicadores_calculados[`EMA_${p}`].fonte = 'OCR';
                        }
                     } else if (keyUp.includes('RSI') && fallbackJson[key]) {
                        const val = typeof fallbackJson[key] === 'object' ? fallbackJson[key].valor : fallbackJson[key];
                        const p = 14; 
                        if (dadosAdaptados.indicadores_calculados[`RSI_${p}`] && dadosAdaptados.indicadores_calculados[`RSI_${p}`].fonte === 'INDISPONIVEL') {
                            dadosAdaptados.indicadores_calculados[`RSI_${p}`].valor_atual = val;
                            dadosAdaptados.indicadores_calculados[`RSI_${p}`].fonte = 'OCR';
                        }
                     } else if (keyUp.includes('ADX') && fallbackJson[key]) {
                        const val = typeof fallbackJson[key] === 'object' ? fallbackJson[key].valor : fallbackJson[key];
                        if (dadosAdaptados.indicadores_calculados[`ADX`] && dadosAdaptados.indicadores_calculados[`ADX`].fonte === 'INDISPONIVEL') {
                            dadosAdaptados.indicadores_calculados[`ADX`].valor_atual = val;
                            dadosAdaptados.indicadores_calculados[`ADX`].fonte = 'OCR';
                        }
                     } else if (keyUp.includes('ATR') && fallbackJson[key]) {
                        const val = typeof fallbackJson[key] === 'object' ? fallbackJson[key].valor : fallbackJson[key];
                        if (dadosAdaptados.dados_mercado.atr && dadosAdaptados.dados_mercado.atr.fonte === 'INDISPONIVEL') {
                            dadosAdaptados.dados_mercado.atr.value = val;
                            dadosAdaptados.dados_mercado.atr.fonte = 'OCR';
                        }
                     }
                 }
              }
          }
      } catch (e) {
          console.error("Erro no fallback OCR:", e);
      }
  }

  // Calcular ATR padrão para o final (fallback caso nao venha mapeado perfeitamente)
  const atrBase = dadosAdaptados.dados_mercado.atr?.value || 0;
  const currentPriceNum = dadosAdaptados.zonas_liquidez_estrutural.pdh ? dadosAdaptados.zonas_liquidez_estrutural.pdh * 0.99 : 1.0; // Approximation just to avoid crash, will correctly use result from prompt fallback logic later

  // ETAPA 2 DO NOVO MOTOR - ANÁLISE COMPLETA COM CONFLUÊNCIA TOTAL
  let contextoGeminiStr = dadosAdaptados.contextoGemini && typeof dadosAdaptados.contextoGemini === 'string' ? dadosAdaptados.contextoGemini.trim() : "";
  if (!contextoGeminiStr) {
      console.warn("[geminiService] Contexto gerado para o Gemini vazio. Aplicando contexto padrão de fallback.");
      contextoGeminiStr = "Os dados de mercado não estavam disponíveis no momento da análise. Prossiga a interpretação com base no gráfico e nas informações visuais.";
  }

  const introducaoContexto = "Você receberá a seguir dados calculados matematicamente via API em tempo real. Estes dados são fatos irrefutáveis e devem ser usados como base absoluta para sua análise. Em caso de conflito entre estes dados e a imagem do gráfico, estes dados prevalecem sempre. Use o gráfico apenas para identificar figuras gráficas, padrões de candle e zonas visuais que não podem ser calculados matematicamente. \n\n" + contextoGeminiStr + "\n\n";

  const promptAnalysis = `${introducaoContexto}Você é um especialista sênior em trading de derivativos e futuros de criptomoedas com 15 anos de experiência em fundos quantitativos. Você está analisando o par ${userPair} na corretora ${currentExchange} no timeframe ${userTimeframe}.

HIERARQUIA DE DADOS - SIGA RIGOROSAMENTE: Os dados abaixo foram calculados matematicamente via API com os candles brutos e são a verdade absoluta, a menos que marcados com fonte="GRAFICO". O sistema possui um motor de fallback. Se a fonte de um indicador for "GRAFICO", trate-o com peso levemente menor ao calcular a confluência, pois é uma estimativa visual. Dados com fonte="API" são exatos e absolutos.

DADOS DA API COM FONTES INJETADAS: 
${JSON.stringify(dadosAdaptados, null, 2)}

O QUE O GRÁFICO CONFIRMOU VISUALMENTE - USE APENAS COMO CONVERGÊNCIA: 
${JSON.stringify(jsonVisual, null, 2)}

INFORMAÇÕES DO FORMULÁRIO PREENCHIDAS PELO USUÁRIO:
Alavancagem Selecionada: ${userLeverage}x
Valor de Entrada (Margem em USD): ${entryValue ? '$' + entryValue : 'Nenhum valor informado'}

CONFLITOS IDENTIFICADOS - RESOLVA ASSIM: Se algum dado visual do gráfico contradizer os dados da API (que tenham fonte "API"), use o dado da API como base para o setup. Se os dados da API tiverem fonte "GRAFICO" ou "INDISPONIVEL", confie totalmente na sua análise da imagem se ela for clara.

Com base em tudo acima, produza uma análise completa com os seguintes blocos obrigatórios. 
Primeiro o bloco de Direção Provável com o viés final sendo LONG ou SHORT ou NEUTRO, use OBRIGATORIAMENTE a alavancagem de ${userLeverage}x selecionada pelo usuário, o score de confluência de 0 a 100 baseado no alinhamento de todos os dados, e uma síntese em até 3 linhas explicando o racional do score. 
Segundo o bloco de Pipeline de Execução com a Zona de Entrada detalhando Plano A de entrada a mercado e Plano B de entrada em pullback com os níveis exatos calculados usando os dados da API, o Stop Loss posicionado atrás do próximo nível de liquidez ou estrutura relevante identificado pelos dados da API acrescido de metade do ATR como buffer, e os alvos TP1 TP2 e TP3 usando clusters de liquidação PDH PDL PWH PWL e zonas de oferta e demanda identificadas. 
Terceiro o bloco de Gestão com o Risco Retorno calculado, o Risco Máximo em percentual, o nível de Liquidação estimado e o Perfil da Operação. Se o Valor de Entrada (${entryValue}) foi informado, calcule e apresente na análise o Tamanho Sugerido (Valor de Entrada * Alavancagem) em dólares.
Quarto o bloco de Visão Quantitativa e Macro com o racional técnico detalhado cruzando indicadores da API com estrutura visual, o contexto macro atual com VIX DXY e S&P500 interpretados.
Quinto o bloco de Alertas de Confluência listando explicitamente quais dados estão alinhados com o viés e quais estão em conflito, para que o trader entenda o nível de confiança do setup.

O SEU OUTPUT FINAL DEVE SER EXCLUSIVAMENTE O JSON ABAIXO, PREENCHENDO-O COMPLETAMENTE. Você DEVE REPASSAR os 5 blocos descritos dentro dos campos desse JSON: (Coloque a Visão Quantitativa no campo analiseTecnica, e o restante mapeie logicamente).

{
  "pair": "${userPair}",
  "direcaoProvavel": "LONG", // LONG ou SHORT
  "scoreProbabilidade": 85,
  "confianca": 85,
  "regime": "Estrutura do gráfico e API",
  "alerta": "Alertas de confluência (Quinto bloco)",
  "entradaSugerida": {
    "planoA": 0,
    "planoB": 0,
    "descricaoPlanoA": "Plano A de entrada a mercado...",
    "descricaoPlanoB": "Plano B de entrada em pullback..."
  },
  "execucao": {
    "motivo": "Síntese racional do score de confluência",
    "setup": {
      "entrada": 0,
      "stop": 0,
      "tp1": 0,
      "tp2": 0,
      "tp3": 0,
      "alavancagem": 0, // Inteiro
      "liquidacao": 0,
      "riscoPct": 0,
      "rr1": 0,
      "verificacao": "✓ SEGURO",
      "tamanhoSugerido": "$0.00",
      "riscoMaximoUsd": "$0.00",
      "tp1Usd": "$0.00",
      "tp2Usd": "$0.00",
      "tp3Usd": "$0.00"
    }
  },
  "ensemble": {
    "motorTecnico": {"status": "Alinhado", "score": 85},
    "motorDerivativos": {"status": "Atenção", "score": 45},
    "motorMacro": {"status": "Neutro", "score": 60},
    "motorSentimento": {"status": "Misto", "score": 50}
  },
  "analiseTecnica": "Quarto bloco de Visão Quantitativa e Macro com racional técnico detalhado",
  "macroGeopolitica": {
    "resumo": "Descrição curta com no máximo 300 caracteres do cenário macroeconômico e geopolítico global.",
    "eventos": [
      "Descrição de um acontecimento ou dado econômico importante (abrangendo regiões e potências importantes como EUA, China, UE ou Japão se houver dados relevantes para essas áreas)",
      "Outro acontecimento macro ou geopolítico relevante...",
      "Mais um bullet point..."
    ]
  },
  "sentimentoNarrativa": {
    "score": 0,
    "sentimento": "OTIMISTA",
    "narrativa": "Conteúdo exclusivamente sobre o projeto/ativo analisado. Deve incluir redes sociais sobre o projeto, notícias relevantes específicas do projeto, narrativas atuais e sentimento da comunidade do ativo. NADA de sentimento genérico de mercado.",
    "gatilhosPositivos": [],
    "gatilhosNegativos": []
  },
  "indicadores": {
    "rsi": 0,
    "adx": 0,
    "plusDI": 0,
    "minusDI": 0,
    "macdHist": 0,
    "ema21": 0,
    "ema50": 0,
    "ema200": 0,
    "atr": 0,
    "cvd": 0
  },
  "zonaInteresse": {
    "tipo": "Demanda/Oferta",
    "zona": "Nível de preço",
    "invalidacao": "Motivo"
  }
}
`;

  let attempt = 0;
  const maxAttempts = 3;
  let result: TradeSetup | null = null;
  
  while (attempt < maxAttempts) {
      try {
          const response = await generateWithRetry("gemini-3.1-pro-preview", {
            contents: {
              parts: [{ inlineData: { mimeType: file.type, data: base64Image } }, { text: promptAnalysis }]
            },
            config: {
                temperature: attempt > 0 ? 0.3 : 0,
                maxOutputTokens: 8192,
                responseMimeType: "application/json"
            }
          });
          
          if (!response.text) throw new Error("Sem resposta do motor");
          
          let jsonText = response.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
          result = JSON.parse(jsonText) as TradeSetup;
          break;
      } catch (err: any) {
          console.error(`Attempt ${attempt + 1} failed:`, err.message);
          attempt++;
          if (attempt >= maxAttempts) {
              throw new Error(`Falha ao gerar análise após ${maxAttempts} tentativas. Último erro: ${err.message}`);
          }
          await new Promise(r => setTimeout(r, 2000));
      }
  }

  if (!result) throw new Error("Could not parse result.");

  if (dadosAdaptados.multi_timeframe && Array.isArray(dadosAdaptados.multi_timeframe)) {
      result.multiTimeframe = dadosAdaptados.multi_timeframe;
  }

  // Forçar as fontes calculadas para dentro do resultado final para exibição na UI
  if (result.indicadores) {
      result.indicadores.fontes = {
          rsi: dadosAdaptados.indicadores_calculados?.['RSI_14']?.fonte || 'INDISPONIVEL',
          adx: dadosAdaptados.indicadores_calculados?.['ADX']?.fonte || 'INDISPONIVEL',
          atr: dadosAdaptados.dados_mercado?.atr?.fonte || 'INDISPONIVEL',
          ema21: dadosAdaptados.indicadores_calculados?.['EMA_21']?.fonte || 'INDISPONIVEL',
          ema50: dadosAdaptados.indicadores_calculados?.['EMA_50']?.fonte || 'INDISPONIVEL',
          ema200: dadosAdaptados.indicadores_calculados?.['EMA_200']?.fonte || 'INDISPONIVEL'
      };
      
      // Override os valores usando a nossa fonte da verdade se existirem
      if (dadosAdaptados.indicadores_calculados?.['RSI_14']?.valor_atual) result.indicadores.rsi = dadosAdaptados.indicadores_calculados['RSI_14'].valor_atual;
      if (dadosAdaptados.indicadores_calculados?.['ADX']?.valor_atual) result.indicadores.adx = dadosAdaptados.indicadores_calculados['ADX'].valor_atual;
      if (dadosAdaptados.dados_mercado?.atr?.value) result.indicadores.atr = dadosAdaptados.dados_mercado.atr.value;
      if (dadosAdaptados.indicadores_calculados?.['EMA_21']?.valor_atual) result.indicadores.ema21 = dadosAdaptados.indicadores_calculados['EMA_21'].valor_atual;
      if (dadosAdaptados.indicadores_calculados?.['EMA_50']?.valor_atual) result.indicadores.ema50 = dadosAdaptados.indicadores_calculados['EMA_50'].valor_atual;
      if (dadosAdaptados.indicadores_calculados?.['EMA_200']?.valor_atual) result.indicadores.ema200 = dadosAdaptados.indicadores_calculados['EMA_200'].valor_atual;
      
      // Inject compression info directly from API calculations
      if (dadosAdaptados.compressaoInfo?.compressaoDetectada !== undefined) {
          result.indicadores.compressaoDetectada = dadosAdaptados.compressaoInfo.compressaoDetectada;
          result.indicadores.nivelCompressao = dadosAdaptados.compressaoInfo.nivelCompressao;
      }
  }

  if (dadosAdaptados.score) {
      (result as any).scoreDetalhado = dadosAdaptados.score;
  }

  // Multiply score by session rules
  const currentUtcHour = new Date().getUTCHours();
  let sessionMultiplier = 1.0;
  if (currentUtcHour >= 0 && currentUtcHour < 8) sessionMultiplier = 0.85;      // Asian
  else if (currentUtcHour >= 8 && currentUtcHour < 13) sessionMultiplier = 0.95; // London
  else if (currentUtcHour >= 13 && currentUtcHour < 21) sessionMultiplier = 1.0; // NY
  else sessionMultiplier = 0.90; // Transition
  
  if (result.scoreProbabilidade) {
      result.scoreProbabilidade = Math.round(result.scoreProbabilidade * sessionMultiplier);
  }

  return result;
};
