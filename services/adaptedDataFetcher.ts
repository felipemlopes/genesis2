import { fetchMarketKlines, fetchOpenInterestHist, fetchLSRData, fetchCVDData, fetchYahooData, fetchBinanceData } from './cryptoApi';
import { calculatePDH_PDL, calculatePWH_PWL, calculateATR } from './technicalAnalysis';
import { calcularEMA as calcEMA_IE, calcularRSI as calcRSI_IE, calcularATR as calcATR_IE, calcularADX, calcularMACD, calcularBollinger, detectarCompressaoVolatilidade, calcularCVDSlope, detectarDivergenciaRSI } from './indicatorEngine';
import { calcularScore, DadosScore } from './scoringEngine';
import { gerarContextoParaGemini, gerarFlagsVisuais, gerarSinteseScore } from './interpretationEngine';
import { RealtimeCVDService } from './realtimeCVDService';
import { OrderBookImbalanceService } from './orderBookImbalanceService';
import { calcularCorrelacaoDinamica, CorrelacaoDinamicaResult } from './intermarketCorrelationService';
import { classificarEMAs, EMADetectada } from './emaClassifier';

// Mínimo de candles necessários para calcular MACD com Signal Line via EMA(9):
// 26 (EMA slow period) + 9 (Signal EMA period) = 35
export const MACD_MIN_CANDLES = 35;

// Helper to calculate EMA
export const calculateEMA = (closes: number[], period: number) => {
    if (closes.length < period) return null;
    const k = 2 / (period + 1);
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] - ema) * k + ema;
    }
    return ema;
};

// Helper to calculate RSI
export const calculateRSI = (closes: number[], period: number) => {
    if (closes.length <= period) return null;
    let gains = 0;
    let losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gains += diff;
        else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;

    for (let i = period + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) {
            avgGain = (avgGain * (period - 1) + diff) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - diff) / period;
        }
    }
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
};

// Helper setup
const hasPriceVariation = (closes: number[], period: number) => {
    if (closes.length <= period) return false;
    const recent = closes.slice(-period);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    return max > min;
};

// Helper for Boolean interpretation
const evalRsi = (rsi: number) => {
    if (rsi > 70) return 'Sobrecompra';
    if (rsi < 30) return 'Sobrevenda';
    return 'Neutro';
}

const parseVisualValue = (jsonVisual: any, nome: string) => {
    // Tenta encontrar em indicadores_visiveis ou zonas_visuais
    if (jsonVisual && jsonVisual.indicadores_visiveis) {
        for (let ind of jsonVisual.indicadores_visiveis) {
            const vNome = String(ind.nome).toUpperCase();
            if (vNome.includes(nome) && ind.valor_estimado) return Number(ind.valor_estimado);
        }
    }
    return null;
};

export const obterIndicadorComFallback = (
    nome: string, 
    period: number, 
    closes: number[], 
    klinesData: any[], 
    jsonVisual: any
): { valor: any, fonte: string, nota?: string } => {
    
    const apiFonte = "API";
    const graficoFonte = "GRAFICO";
    const ndFonte = "INDISPONIVEL";
    
    let calculado: any = null;
    let fallbackNecessario = false;

    try {
        if (nome === 'EMA') {
            if (closes.length > period * 2 && hasPriceVariation(closes, closes.length)) {
                const emaVal = calculateEMA(closes, period);
                const currentPrice = closes[closes.length - 1];
                if (emaVal !== null && isFinite(emaVal) && emaVal > 0 && currentPrice > 0) {
                    const ratio = emaVal / currentPrice;
                    if (ratio >= 0.5 && ratio <= 2.0) {
                        calculado = emaVal;
                    } else {
                        fallbackNecessario = true;
                    }
                } else {
                    fallbackNecessario = true;
                }
            } else fallbackNecessario = true;
        } 
        else if (nome === 'RSI') {
            if (closes.length >= Math.max(15, period) && hasPriceVariation(closes, Math.max(15, period))) {
                const rsi = calculateRSI(closes, period);
                if (rsi !== null && isFinite(rsi) && rsi > 1 && rsi < 99) {
                    calculado = rsi;
                } else fallbackNecessario = true;
            } else fallbackNecessario = true;
        }
        else if (nome === 'MACD') {
            // Exige ≥ 35 candles (26 para EMA slow + 9 para Signal EMA) antes de calcular
            if (klinesData.length >= MACD_MIN_CANDLES) {
                const candlesForMACD = klinesData.map((k: any) => ({
                    timestamp: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
                const macdResult = calcularMACD(candlesForMACD);
                if (macdResult !== null) {
                    calculado = { linha_macd: macdResult.macd, linha_sinal: macdResult.signal };
                } else fallbackNecessario = true;
            } else fallbackNecessario = true;
        }
        else if (nome === 'BOLLINGER') {
            if (closes.length > period * 2) {
                const p = 20;
                const recentCloses = closes.slice(-p);
                const sma = recentCloses.reduce((a,b)=>a+b,0)/p;
                let sqSum = 0;
                for(let pr of recentCloses) sqSum += Math.pow(pr - sma, 2);
                const stdev = Math.sqrt(sqSum / p);
                if (isFinite(sma) && isFinite(stdev)) {
                    calculado = { banda_media: sma, banda_superior: sma + (stdev * 2), banda_inferior: sma - (stdev * 2) };
                } else fallbackNecessario = true;
            } else fallbackNecessario = true;
        }
        else if (nome === 'ADX') {
            if (klinesData.length >= 28) {
                // Convert klinesData to Candle[] format for indicatorEngine
                const candlesForADX = klinesData.map((k: any) => ({
                    timestamp: k[0],
                    open: parseFloat(k[1]),
                    high: parseFloat(k[2]),
                    low: parseFloat(k[3]),
                    close: parseFloat(k[4]),
                    volume: parseFloat(k[5])
                }));
                const adxResult = calcularADX(candlesForADX, period);
                if (adxResult !== null) {
                    calculado = { adx: adxResult.adx, diPlus: adxResult.diPlus, diMinus: adxResult.diMinus };
                } else {
                    fallbackNecessario = true;
                }
            } else fallbackNecessario = true;
        }
        else if (nome === 'ATR') {
            if (klinesData.length >= 15) {
                const atrVal = calculateATR(klinesData, 14);
                if (atrVal && isFinite(atrVal.value) && atrVal.value > 0) {
                    calculado = atrVal.value;
                } else fallbackNecessario = true;
            } else fallbackNecessario = true;
        }
    } catch(e) {
        fallbackNecessario = true;
    }

    if (!fallbackNecessario && calculado !== null) {
        return { valor: calculado, fonte: apiFonte };
    }

    // Nível 2 - Fallback Gráfico
    const valorOcr = parseVisualValue(jsonVisual, nome);
    if (valorOcr !== null) {
        return { valor: valorOcr, fonte: graficoFonte, nota: "valor extraído visualmente, precisão aproximada" };
    }

    return { valor: null, fonte: ndFonte };
};

export const buscarDadosAdaptados = async (jsonVisual: any, confirmedPair: string, confirmedTimeframe: string) => {
    // Carregar Klines para cálculo de indicadores
    let klinesData = await fetchMarketKlines(confirmedPair, confirmedTimeframe, 200).catch(() => []);
    let closes: number[] = [];
    let highs: number[] = [];
    let lows: number[] = [];
    let currentPrice = 0;

    if (!klinesData || !Array.isArray(klinesData) || klinesData.length === 0) {
        console.warn(`[adaptedDataFetcher] Falha na validação em klinesData: esperado array não vazio, recebido:`, klinesData);
        klinesData = [];
    }

    if (Array.isArray(klinesData) && klinesData.length > 0) {
        closes = klinesData.map((k: any) => parseFloat(k[4]));
        highs = klinesData.map((k: any) => parseFloat(k[2]));
        lows = klinesData.map((k: any) => parseFloat(k[3]));
        currentPrice = closes[closes.length - 1];

        const pastDeltas = klinesData.slice(-10).map((k: any) => {
            const totalVol = parseFloat(k[5]) || 0;
            const buyVol = parseFloat(k[9]) || 0;
            const sellVol = totalVol - buyVol;
            return buyVol - sellVol;
        });
        RealtimeCVDService.getInstance(confirmedPair).populateHistory(pastDeltas);

    } else {
        // Fallback básico se a API falhar
        currentPrice = 1.0;
        for (let i=0; i<200; i++) { closes.push(1); highs.push(1.01); lows.push(0.99); }
    }

    const resultadosIndicadores: Record<string, any> = {};

    const indVisiveis = jsonVisual && jsonVisual.indicadores_visiveis ? jsonVisual.indicadores_visiveis : [];
    // Process identified visual indicators
    for (const ind of indVisiveis) {
        const nome = String(ind.nome).toUpperCase();
        
        // --- EMA / MEDIA MOVEL --- //
        if (nome.includes('EMA') || nome.includes('MM ') || nome.includes('MEDIA') || nome.includes('MÉDIA')) {
            const match = nome.match(/\d+/);
            const period = match ? parseInt(match[0]) : (typeof ind.periodos === 'number' ? ind.periodos : 21);
            const fallbackInfo = obterIndicadorComFallback('EMA', period, closes, klinesData, jsonVisual);
            
            if (fallbackInfo.fonte !== 'INDISPONIVEL') {
                resultadosIndicadores[`${nome}_${period}`] = {
                    valor_atual: fallbackInfo.valor,
                    sinal: currentPrice > fallbackInfo.valor ? 'Preço Acima' : 'Preço Abaixo',
                    fonte: fallbackInfo.fonte,
                    nota: fallbackInfo.nota
                };
            }
        }
        
        // --- RSI --- //
        else if (nome.includes('RSI') || nome.includes('IFR')) {
            const period = Array.isArray(ind.periodos) ? ind.periodos[0] : (typeof ind.periodos === 'number' ? ind.periodos : 14);
            const fallbackInfo = obterIndicadorComFallback('RSI', period, closes, klinesData, jsonVisual);
            
            if (fallbackInfo.fonte !== 'INDISPONIVEL') {
                resultadosIndicadores[`RSI_${period}`] = {
                    valor_atual: fallbackInfo.valor,
                    estado: evalRsi(fallbackInfo.valor),
                    fonte: fallbackInfo.fonte,
                    nota: fallbackInfo.nota
                };
            }
        }
        // --- MACD --- //
        else if (nome.includes('MACD')) {
            const fallbackInfo = obterIndicadorComFallback('MACD', 0, closes, klinesData, jsonVisual);
            if (fallbackInfo.fonte !== 'INDISPONIVEL' && fallbackInfo.valor) {
                const macdLine = fallbackInfo.valor.linha_macd || fallbackInfo.valor; // Se veio OCR, é só um numero estimado
                const isObj = typeof fallbackInfo.valor === 'object';
                resultadosIndicadores['MACD'] = {
                    linha_macd: isObj ? fallbackInfo.valor.linha_macd : fallbackInfo.valor,
                    linha_sinal: isObj ? fallbackInfo.valor.linha_sinal : 0,
                    histograma: isObj ? fallbackInfo.valor.linha_macd - fallbackInfo.valor.linha_sinal : 0,
                    estado: macdLine > 0 ? "Acima da linha zero" : "Abaixo da linha zero",
                    fonte: fallbackInfo.fonte,
                    nota: fallbackInfo.nota
                };
            }
        }
        // --- Bollinger --- //
        else if (nome.includes('BOLLINGER')) {
            const fallbackInfo = obterIndicadorComFallback('BOLLINGER', 20, closes, klinesData, jsonVisual);
            if (fallbackInfo.fonte !== 'INDISPONIVEL' && typeof fallbackInfo.valor === 'object') {
                let posText = "Dentro da Banda";
                const upper = fallbackInfo.valor.banda_superior;
                const lower = fallbackInfo.valor.banda_inferior;
                if (currentPrice >= upper) posText = "Rompendo Superior";
                else if (currentPrice <= lower) posText = "Rompendo Inferior";
                
                resultadosIndicadores['BOLLINGER'] = {
                    banda_superior: upper,
                    banda_media: fallbackInfo.valor.banda_media,
                    banda_inferior: lower,
                    posicao_preco: posText,
                    fonte: fallbackInfo.fonte,
                    nota: fallbackInfo.nota
                };
            }
        }
         // --- ADX --- //
         else if (nome.includes('ADX')) {
             const period = Array.isArray(ind.periodos) ? ind.periodos[0] : (typeof ind.periodos === 'number' ? ind.periodos : 14);
             const fallbackInfo = obterIndicadorComFallback('ADX', period, closes, klinesData, jsonVisual);
             if (fallbackInfo.fonte !== 'INDISPONIVEL') {
                 resultadosIndicadores['ADX'] = {
                     valor_atual: fallbackInfo.valor,
                     regime: fallbackInfo.valor > 25 ? 'Tendência forte' : (fallbackInfo.valor > 20 ? 'Tendência fraca' : 'Ranging'),
                     fonte: fallbackInfo.fonte,
                     nota: fallbackInfo.nota
                 };
             }
         }
    }

    // Extrair EMAs detectadas de resultadosIndicadores e classificar
    const emasDetectadas: EMADetectada[] = [];
    for (const key of Object.keys(resultadosIndicadores)) {
        if (key.includes('EMA') || key.includes('MM') || key.includes('MEDIA') || key.includes('MÉDIA')) {
            const match = key.match(/(\d+)$/);
            if (match) {
                const periodo = parseInt(match[1]);
                const valor = resultadosIndicadores[key].valor_atual;
                if (periodo > 0 && typeof valor === 'number' && isFinite(valor) && valor > 0) {
                    emasDetectadas.push({ periodo, valor });
                }
            }
        }
    }
    const emasClassificadas = classificarEMAs(emasDetectadas);

    // Always fetch contextual items
    const [binanceData, cvd3h, dKlines, wKlines, lsData, oi1h, oi4h, vixData, dxyData, sp500Data] = await Promise.all([
        fetchBinanceData(confirmedPair).catch(()=>null),
        fetchCVDData(confirmedPair).catch(()=>null), 
        fetchMarketKlines(confirmedPair, '1d', 3).catch(()=>[]),
        fetchMarketKlines(confirmedPair, '1w', 3).catch(()=>[]),
        fetchLSRData(confirmedPair, 'Binance').catch(()=>null),
        fetchOpenInterestHist(confirmedPair, '1h', 3).catch(()=>null),
        fetchOpenInterestHist(confirmedPair, '4h', 3).catch(()=>null),
        fetchYahooData('^VIX').catch(()=>({price:0, change:0})),
        fetchYahooData('DX-Y.NYB').catch(()=>({price:0, change:0})),
        fetchYahooData('^GSPC').catch(()=>({price:0, change:0}))
    ]);

    // LÓGICA DE MULTI-TIMEFRAME
    const getHigherTimeframes = (tf: string) => {
        if (tf === '15m' || tf === '15M') return ['1h', '4h', '1d'];
        if (tf === '1h' || tf === '1H') return ['4h', '1d', '1w'];
        if (tf === '4h' || tf === '4H') return ['1d', '1w', '1M'];
        if (tf === '1d' || tf === '1D') return ['1w', '1M'];
        return ['1d', '1w'];
    };
    
    // Obter EMA de menor período identificada ou 21 por padrão
    let shortestEMAPeriod = 21;
    for (const key of Object.keys(resultadosIndicadores)) {
        if (key.includes('EMA_')) {
            const p = parseInt(key.split('_')[1]);
            if (p > 0 && p < shortestEMAPeriod) {
                shortestEMAPeriod = p;
            }
        }
    }

    const hTfs = getHigherTimeframes(confirmedTimeframe);
    const multiTimeframeResult: { timeframe: string; bias: string }[] = [];
    
    await Promise.all(hTfs.map(async (tf) => {
        try {
            const data = await fetchMarketKlines(confirmedPair, tf, Math.max(shortestEMAPeriod * 2, 50)).catch(() => []);
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.warn(`[adaptedDataFetcher - fetchMarketKlines hTfs] Falha na validação em data: esperado array não vazio, recebido:`, data);
            }
            if (Array.isArray(data) && data.length >= shortestEMAPeriod) {
                const c = data.map((k: any) => parseFloat(k[4]));
                const lastClose = c[c.length - 1];
                const tfEma = calculateEMA(c, shortestEMAPeriod);
                if (tfEma > 0) {
                    const diffPercent = Math.abs(lastClose - tfEma) / tfEma * 100;
                    if (diffPercent < 0.3) {
                        multiTimeframeResult.push({ timeframe: tf, bias: 'NEUTRO' });
                    } else if (lastClose > tfEma) {
                        multiTimeframeResult.push({ timeframe: tf, bias: 'BULLISH' });
                    } else {
                        multiTimeframeResult.push({ timeframe: tf, bias: 'BEARISH' });
                    }
                } else {
                    multiTimeframeResult.push({ timeframe: tf, bias: 'N/D' });
                }
            } else {
                multiTimeframeResult.push({ timeframe: tf, bias: 'N/D' });
            }
        } catch (e) {
            multiTimeframeResult.push({ timeframe: tf, bias: 'N/D' });
        }
    }));
    
    // Sort array in the order of higher timeframes requested
    const sortedMultiTfResult = hTfs.map(tf => multiTimeframeResult.find(r => r.timeframe === tf) || { timeframe: tf, bias: 'N/D' });

    const realtimeCvd = RealtimeCVDService.getInstance(confirmedPair).getSnapshot();
    const orderBookImbalance = OrderBookImbalanceService.getInstance(confirmedPair).getSnapshot();

    const cvdData = {
        cvd_3h_crescendo: cvd3h ? cvd3h.delta > 0 : false,
        cvd_24h_crescendo: cvd3h ? cvd3h.delta > 0 : false, // Proxy 24h as well
        divergencia_preco: cvd3h ? (cvd3h.delta > 0 && cvd3h.priceChangePercent < 0) || (cvd3h.delta < 0 && cvd3h.priceChangePercent > 0) : false,
        cvdTempoReal: realtimeCvd.currentCandleDelta,
        cvdSlopeTempoReal: realtimeCvd.cvdSlope,
        cvdDivergenciaAtiva: realtimeCvd.isDivergenceActive,
        cvdDirecaoDivergencia: realtimeCvd.divergenceDirection,
        bookImbalanceRatio: orderBookImbalance.ratio,
        bookImbalanceSinal: orderBookImbalance.sinal,
        bookImbalanceAtivo: orderBookImbalance.ativo,
        fonteInfo: "VIA WEBSOCKET TEMPO REAL"
    };

    let oi_var_1h = 0;
    if (oi1h && oi1h.length >= 2) oi_var_1h = ((parseFloat(oi1h[oi1h.length-1].sumOpenInterest) - parseFloat(oi1h[0].sumOpenInterest))/parseFloat(oi1h[0].sumOpenInterest))*100;
    
    let oi_var_4h = 0;
    if (oi4h && oi4h.length >= 2) oi_var_4h = ((parseFloat(oi4h[oi4h.length-1].sumOpenInterest) - parseFloat(oi4h[0].sumOpenInterest))/parseFloat(oi4h[0].sumOpenInterest))*100;

    let lsRatio = 50;
    if (lsData && lsData.length) {
        lsRatio = parseFloat(lsData[0].longAccount || lsData[0].longShortRatio || '50');
        if (lsRatio < 10) lsRatio = lsRatio * 50; // simple fallback mapping
    }

    const { pdh, pdl } = calculatePDH_PDL(dKlines);
    const { pwh, pwl } = calculatePWH_PWL(wKlines);
    
    // Always calculate ATR
    const atrFallback = obterIndicadorComFallback('ATR', 14, closes, klinesData, jsonVisual);
    const atrInfo = atrFallback.fonte !== 'INDISPONIVEL' 
        ? { value: atrFallback.valor, percent: (atrFallback.valor / currentPrice) * 100, fonte: atrFallback.fonte }
        : { value: 0, percent: 0, fonte: 'INDISPONIVEL' };

    const heatmapAbove = currentPrice * 1.01;
    const heatmapBelow = currentPrice * 0.99;

    // Converte Klines para formato do IndicatorEngine
    const candlesForIE = Array.isArray(klinesData) ? klinesData.map((k: any) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5])
    })) : [];

    let correlacaoDinamicaInfo: CorrelacaoDinamicaResult | null = null;
    if (confirmedPair !== 'BTCUSDT' && confirmedPair !== 'BTCUSD') {
        const btcKlinesData = await fetchMarketKlines('BTCUSDT', confirmedTimeframe, 200).catch(() => []);
        if (Array.isArray(btcKlinesData) && btcKlinesData.length > 0) {
            const btcCandlesForIE = btcKlinesData.map((k: any) => ({
                timestamp: k[0],
                open: parseFloat(k[1]),
                high: parseFloat(k[2]),
                low: parseFloat(k[3]),
                close: parseFloat(k[4]),
                volume: parseFloat(k[5])
            }));
            correlacaoDinamicaInfo = calcularCorrelacaoDinamica(candlesForIE, btcCandlesForIE);
        }
    }

    // Chama IndicatorEngine
    const ema21 = calcEMA_IE(candlesForIE, 21);
    const ema50 = calcEMA_IE(candlesForIE, 50);
    const ema200 = calcEMA_IE(candlesForIE, 200);
    const prevEma21 = calcEMA_IE(candlesForIE.slice(0, -1), 21);
    const prevEma50 = calcEMA_IE(candlesForIE.slice(0, -1), 50);
    const prevEma200 = calcEMA_IE(candlesForIE.slice(0, -1), 200);

    // EMAs dinâmicas: usar classificação como fonte primária quando disponível
    const usarEmaCurta = emasClassificadas.curta !== null;
    const usarEmaMedia = emasClassificadas.media !== null;
    const usarEmaLonga = emasClassificadas.longa !== null;

    // Fallback: quando nenhuma EMA é detectada no gráfico, usar EMAs fixas 21/50/200
    // calculadas a partir dos candles (comportamento original como referência secundária)
    const nenhumaEmaDetectada = !usarEmaCurta && !usarEmaMedia && !usarEmaLonga;
    if (nenhumaEmaDetectada) {
        console.info('[adaptedDataFetcher] Nenhuma EMA detectada no gráfico. Usando fallback: EMAs fixas 21/50/200.');
    }

    // Valores finais para DadosScore: EMAs dinâmicas como primárias, fixas 21/50/200 como fallback
    const emaScoreCurta = usarEmaCurta ? emasClassificadas.curta!.valor : (ema21 || undefined);
    const emaScoreMedia = usarEmaMedia ? emasClassificadas.media!.valor : (ema50 || undefined);
    const emaScoreLonga = usarEmaLonga ? emasClassificadas.longa!.valor : (ema200 || undefined);

    // Calcular emaSubindo para EMAs dinâmicas
    let emaCurtaSubindo = false;
    let emaMediaSubindo = false;
    let emaLongaSubindo = false;

    if (usarEmaCurta) {
        // Para EMA dinâmica: calcular EMA do período detectado sobre candles atuais vs candles sem último
        const periodoC = emasClassificadas.curta!.periodo;
        const emaAtualC = calcEMA_IE(candlesForIE, periodoC);
        const emaPrevC = calcEMA_IE(candlesForIE.slice(0, -1), periodoC);
        emaCurtaSubindo = emaAtualC !== null && emaPrevC !== null ? emaAtualC > emaPrevC : false;
    } else {
        emaCurtaSubindo = ema21 !== null && prevEma21 !== null ? ema21 > prevEma21 : false;
    }

    if (usarEmaMedia) {
        const periodoM = emasClassificadas.media!.periodo;
        const emaAtualM = calcEMA_IE(candlesForIE, periodoM);
        const emaPrevM = calcEMA_IE(candlesForIE.slice(0, -1), periodoM);
        emaMediaSubindo = emaAtualM !== null && emaPrevM !== null ? emaAtualM > emaPrevM : false;
    } else {
        emaMediaSubindo = ema50 !== null && prevEma50 !== null ? ema50 > prevEma50 : false;
    }

    if (usarEmaLonga) {
        const periodoL = emasClassificadas.longa!.periodo;
        const emaAtualL = calcEMA_IE(candlesForIE, periodoL);
        const emaPrevL = calcEMA_IE(candlesForIE.slice(0, -1), periodoL);
        emaLongaSubindo = emaAtualL !== null && emaPrevL !== null ? emaAtualL > emaPrevL : false;
    } else {
        emaLongaSubindo = ema200 !== null && prevEma200 !== null ? ema200 > prevEma200 : false;
    }

    const rsi = calcRSI_IE(candlesForIE, 14);
    const rsiArray = [];
    for (let i = Math.max(0, candlesForIE.length - 30); i < candlesForIE.length; i++) {
        rsiArray.push(calcRSI_IE(candlesForIE.slice(0, i + 1), 14) || 50);
    }
    const divergenciaRSI = detectarDivergenciaRSI(candlesForIE, rsiArray);

    const adxObj = calcularADX(candlesForIE, 14);
    const prevAdxObj = calcularADX(candlesForIE.slice(0, -1), 14);
    
    const macdObj = calcularMACD(candlesForIE);
    const prevMacdObj = calcularMACD(candlesForIE.slice(0, -1));

    const atrAtual = calcATR_IE(candlesForIE, 14);
    
    const compressaoInfo = detectarCompressaoVolatilidade(candlesForIE) || {
        compressaoDetectada: false,
        nivelCompressao: "NENHUMA",
        volumeDecrescente: false,
        probabilidadeRompimento: 0
    };
    
    // Calcula Score
    const dadosScore: DadosScore = {
        preco: currentPrice,
        bookImbalanceRatio: cvdData.bookImbalanceRatio,
        ema21: emaScoreCurta,
        ema50: emaScoreMedia,
        ema200: emaScoreLonga,
        ema21Subindo: emaCurtaSubindo,
        ema50Subindo: emaMediaSubindo,
        ema200Subindo: emaLongaSubindo,
        rsi: rsi || undefined,
        divergenciaRSI,
        adx: adxObj ? adxObj.adx : undefined,
        adxSubindo: adxObj !== null && prevAdxObj !== null ? adxObj.adx > prevAdxObj.adx : false,
        macdAcimaSignal: macdObj ? macdObj.macd > macdObj.signal : false,
        histogramaSubindo: macdObj !== null && prevMacdObj !== null ? macdObj.histogram > prevMacdObj.histogram : false,
        atrAtual: atrAtual || undefined,
        compressaoDetectada: compressaoInfo.compressaoDetectada,
        nivelCompressao: compressaoInfo.nivelCompressao,
        cvdSlope: 0, // Mock
        divergenciaCVD: 'NENHUMA',
        fundingMedio: binanceData ? parseFloat(binanceData.fundingRate) : undefined,
        oiVariacao: oi_var_1h,
        oiSubindo: oi_var_1h > 0,
        precoSubindo: closes.length >= 2 ? closes[closes.length - 1] > closes[closes.length - 2] : false,
        lsRatioLongs: typeof lsRatio === 'number' ? (lsRatio > 1 ? lsRatio / 100 : lsRatio) : undefined,
        clusterLiquidacaoAcima: heatmapAbove,
        clusterLiquidacaoAbaixo: heatmapBelow,
        vix: vixData ? vixData.price : undefined,
        dxyVariacao: dxyData ? dxyData.change : undefined,
        sp500Variacao: sp500Data ? sp500Data.change : undefined,
        btcDominanciaVariacao: 0,
        usdtDominanciaVariacao: 0,
        fearGreed: 50,
        geopoliticaScore: 0,
        sentimentoMoedaScore: 0,
        correlacaoBtc: correlacaoDinamicaInfo || null
    };

    let resultadoScore = null;
    try {
        resultadoScore = calcularScore(dadosScore);
    } catch(e) {
        console.error("[adaptedDataFetcher] Erro em calcularScore:", e);
    }
    
    if (!resultadoScore) {
        resultadoScore = { pontuacao: 0, recomendacao: "Neutro", motivos: [], flags: [] };
    }

    let contextoGemini = "";
    try {
        contextoGemini = gerarContextoParaGemini(resultadoScore, dadosScore);
    } catch(e) {
        console.error("[adaptedDataFetcher] Erro em gerarContextoParaGemini:", e);
    }
    
    // Injeta Compressão de Volatilidade
    if (compressaoInfo.compressaoDetectada) {
        contextoGemini += `\n\nCOMPRESSAO DE VOLATILIDADE VIA CALCULO LOCAL:\n`;
        contextoGemini += `- Compressão Ativa: SIM (Nível: ${compressaoInfo.nivelCompressao})\n`;
        contextoGemini += `- Probabilidade de Rompimento Iminente: ${compressaoInfo.probabilidadeRompimento}%\n`;
        contextoGemini += `\nINSTRUÇÃO OBRIGATÓRIA PARA SETUP: O mercado está em compressão de volatilidade (acumulando energia). O setup recomendado deve considerar entrada agressiva na direção do rompimento (breakout), com stop-loss curto posicionado dentro da zona de compressão. Como rompimentos após compressões severas tendem a gerar movimentos de grande amplitude, projete alvos amplos e esticados (elevado R:R).`;
    }

    // Injeta Correlação BTC
    if (correlacaoDinamicaInfo && correlacaoDinamicaInfo.descorrelacaoDetectada) {
        contextoGemini += `\n\nCORRELACAO DINAMICA BTC:\n`;
        contextoGemini += `- Descorrelação Detectada: SIM\n`;
        contextoGemini += `- Tipo: ${correlacaoDinamicaInfo.tipoDescorrelacao}\n`;
        contextoGemini += `- Força Atual: ${correlacaoDinamicaInfo.forca} (Valor: ${correlacaoDinamicaInfo.correlacaoAtual.toFixed(2)})\n`;
        
        if (correlacaoDinamicaInfo.tipoDescorrelacao === 'FORCA_RELATIVA') {
            contextoGemini += `\nINSTRUÇÃO OBRIGATÓRIA PARA SETUP: Foi detectada uma descorrelação indicando FORÇA RELATIVA. O Bitcoin caiu nos últimos períodos, mas este ativo resistiu à queda (ficou lateral ou subiu). Isso é uma fortíssima evidência de ACUMULAÇÃO INSTITUCIONAL. O mercado está absorvendo as vendas e impedindo que o preço caia. O setup deve considerar viés de ALTA (BULLISH) com bastante peso devido a esta acumulação clara.`;
        } else if (correlacaoDinamicaInfo.tipoDescorrelacao === 'FRAQUEZA_RELATIVA') {
            contextoGemini += `\nINSTRUÇÃO OBRIGATÓRIA PARA SETUP: Foi detectada uma descorrelação indicando FRAQUEZA RELATIVA. O Bitcoin subiu nos últimos períodos, mas este ativo não acompanhou a alta (caiu ou ficou lateral). Isso é uma fortíssima evidência de DISTRIBUIÇÃO INSTITUCIONAL. Os vendedores estão aproveitando liquidez para descarregar posições e impedindo a alta. O setup deve considerar viés de BAIXA (BEARISH) com bastante peso devido a esta distribuição.`;
        }
    }

    if (!contextoGemini || contextoGemini.trim() === "") {
        console.warn("[adaptedDataFetcher] Contexto gerado para o Gemini está vazio. Usando fallback padrão.");
        contextoGemini = "Os dados de mercado não estavam disponíveis no momento da análise. Prossiga a interpretação com base no gráfico e em informações visuais, se houver.";
    }

    let flagsVisuais = [];
    try {
        flagsVisuais = gerarFlagsVisuais(resultadoScore.flags);
    } catch(e) {
        console.error("[adaptedDataFetcher] Erro em gerarFlagsVisuais:", e);
    }

    let sinteseScore = "Sem dados suficientes para síntese.";
    try {
        sinteseScore = gerarSinteseScore(resultadoScore) || sinteseScore;
    } catch(e) {
        console.error("[adaptedDataFetcher] Erro em gerarSinteseScore:", e);
    }

    return {
        indicadores_calculados: resultadosIndicadores,
        dados_macro: {
            vix: vixData,
            dxy: dxyData,
            sp500: sp500Data
        },
        dados_mercado: {
            funding_rate: binanceData ? binanceData.fundingRate : '0.0001',
            cvd: cvdData,
            open_interest_var_1h: oi_var_1h,
            open_interest_var_4h: oi_var_4h,
            long_short_ratio: lsRatio,
            atr: atrInfo
        },
        multi_timeframe: sortedMultiTfResult,
        zonas_liquidez_estrutural: {
            pdh,
            pdl,
            pwh,
            pwl,
            cluster_liquidez_acima: heatmapAbove,
            cluster_liquidez_abaixo: heatmapBelow
        },
        indicators: {
            ema21, ema50, ema200, rsi, adx: adxObj, macd: macdObj, atr: atrAtual
        },
        compressaoInfo,
        score: {
            ...resultadoScore,
            flagsVisuais,
            sintese: sinteseScore
        },
        contextoGemini
    };
};
