export interface DadosScore {
    preco?: number;
    bookImbalanceRatio?: number;
    ema21?: number;
    ema50?: number;
    ema200?: number;
    ema21Subindo?: boolean;
    ema50Subindo?: boolean;
    ema200Subindo?: boolean;
    rsi?: number;
    divergenciaRSI?: string;
    adx?: number;
    adxSubindo?: boolean;
    macdAcimaSignal?: boolean;
    histogramaSubindo?: boolean;
    atrAtual?: number;
    atrMedia20?: number;
    bollingerLarguraSubindo?: boolean;
    compressaoDetectada?: boolean;
    nivelCompressao?: string;
    cvdSlope?: number;
    divergenciaCVD?: string;
    fundingMedio?: number;
    oiVariacao?: number;
    oiSubindo?: boolean;
    precoSubindo?: boolean;
    lsRatioLongs?: number;
    clusterLiquidacaoAcima?: number;
    clusterLiquidacaoAbaixo?: number;
    vix?: number;
    dxyVariacao?: number;
    sp500Variacao?: number;
    btcDominanciaVariacao?: number;
    usdtDominanciaVariacao?: number;
    fearGreed?: number;
    geopoliticaScore?: number;
    sentimentoMoedaScore?: number;
    correlacaoBtc?: {
        correlacaoAtual: number;
        forca: string;
        descorrelacaoDetectada: boolean;
        tipoDescorrelacao: string;
    } | null;
}

export interface ResultadoScore {
    scoreFinal: number;
    vies: string;
    blocoTecnico: { pontos: number; maximo: number; percentual: number };
    blocoDerivativos: { pontos: number; maximo: number; percentual: number };
    blocoMacro: { pontos: number; maximo: number; percentual: number };
    blocoSentimento: { pontos: number; maximo: number; percentual: number };
    flags: string[];
    confiabilidade: string;
}

export const calcularScore = (dados: DadosScore): ResultadoScore => {
    const isTechnicalPresent = dados.ema200 !== undefined || dados.rsi !== undefined || dados.adx !== undefined;

    let pontosBullish = 0;
    let pontosBearish = 0;
    let flags: string[] = [];

    // BLOCO TÉCNICO (Máx 35)
    let tcBullish = 0;
    let tcBearish = 0;
    
    if (isTechnicalPresent) {
        if (dados.preco && dados.ema200) {
            const dist = Math.abs(dados.preco - dados.ema200) / dados.ema200;
            if (dist < 0.003) {
                // Zona neutra (2 pontos mas distribui para ambos para neutralizar sem viés forte)
                tcBullish += 1;
                tcBearish += 1;
            } else if (dados.preco > dados.ema200) {
                if (dados.ema200Subindo) tcBullish += 8;
                else tcBullish += 5;
            } else {
                if (!dados.ema200Subindo) tcBearish += 8;
                else tcBearish += 5;
            }
        }
        
        if (dados.rsi !== undefined) {
            if (dados.rsi >= 50 && dados.rsi <= 65) tcBullish += 7;
            else if (dados.rsi >= 35 && dados.rsi < 50) tcBearish += 7;
            else if (dados.rsi > 70) tcBearish += 3;
            else if (dados.rsi < 30) tcBullish += 3;
        }
        
        if (dados.divergenciaRSI === 'BULLISH') tcBullish += 3;
        else if (dados.divergenciaRSI === 'BEARISH') tcBearish += 3;
        
        if (dados.adx !== undefined) {
            if (dados.adx > 25 && dados.precoSubindo) tcBullish += 6;
            else if (dados.adx > 25 && !dados.precoSubindo) tcBearish += 6;
            else if (dados.adx < 20) {
                tcBullish += 1; tcBearish += 1;
                flags.push('RANGING_SEM_TENDENCIA');
            }
        }
        
        if (dados.macdAcimaSignal !== undefined) {
            if (dados.macdAcimaSignal && dados.histogramaSubindo) tcBullish += 7;
            else if (!dados.macdAcimaSignal && !dados.histogramaSubindo) tcBearish += 7;
        }
        
        if (dados.compressaoDetectada) {
            if (dados.nivelCompressao === 'SEVERA') {
                flags.push('ROMPIMENTO_IMINENTE');
            }
            tcBullish += 2; tcBearish += 2;
        } else {
            if (dados.precoSubindo) tcBullish += 7;
            else tcBearish += 7;
        }
    }

    // BLOCO DERIVATIVOS (Máx 35)
    let drBullish = 0;
    let drBearish = 0;
    
    if (dados.cvdSlope !== undefined) {
        if (dados.cvdSlope > 0 && dados.precoSubindo) drBullish += 10;
        else if (dados.cvdSlope < 0 && !dados.precoSubindo) drBearish += 10;
    }
    
    if (dados.bookImbalanceRatio !== undefined) {
        if (dados.bookImbalanceRatio > 0.35) {
            drBullish += 5;
            flags.push('PRESSAO_COMPRADORA_BOOK');
        } else if (dados.bookImbalanceRatio < -0.35) {
            drBearish += 5;
            flags.push('PRESSAO_VENDEDORA_BOOK');
        }
    }
    
    if (dados.divergenciaCVD === 'BEARISH') {
        drBearish += 10;
        flags.push('CVD_DIVERGENCIA_BEARISH');
    } else if (dados.divergenciaCVD === 'BULLISH') {
        drBullish += 10;
        flags.push('CVD_DIVERGENCIA_BULLISH');
    }
    
    if (dados.fundingMedio !== undefined) {
        if (dados.fundingMedio >= -0.01 && dados.fundingMedio <= 0.01) {
            drBullish += 2; drBearish += 2;
        } else if (dados.fundingMedio > 0.05) {
            drBearish += 8;
            flags.push('LONG_SQUEEZE_IMINENTE');
        } else if (dados.fundingMedio > 0.03) {
            drBearish += 6;
        } else if (dados.fundingMedio < -0.03) {
            drBullish += 8;
            flags.push('SHORT_SQUEEZE_IMINENTE');
        } else if (dados.fundingMedio < -0.02) {
            drBullish += 6;
        }
    }
    
    if (dados.oiSubindo && dados.precoSubindo) drBullish += 8;
    else if (dados.oiSubindo && !dados.precoSubindo) drBearish += 8;
    else if (!dados.oiSubindo && dados.precoSubindo) {
        drBullish += 3;
        flags.push('RALLY_FRACO');
    } else if (!dados.oiSubindo && !dados.precoSubindo) {
        drBearish += 3;
        flags.push('CORRECAO_FRACA');
    }
    
    if (dados.lsRatioLongs !== undefined) {
        if (dados.lsRatioLongs > 0.60) {
            drBearish += 5;
            flags.push('MERCADO_SOBRECOMPRADO');
        } else if (dados.lsRatioLongs < 0.40) {
            drBullish += 5;
            flags.push('MERCADO_SOBREVENDIDO');
        } else if (dados.lsRatioLongs >= 0.45 && dados.lsRatioLongs <= 0.55) {
            drBullish += 1; drBearish += 1;
        }
    }
    
    if (dados.clusterLiquidacaoAcima !== undefined && dados.preco) {
        if (Math.abs(dados.clusterLiquidacaoAcima - dados.preco)/dados.preco < 0.01) {
            drBearish += 2;
            flags.push('CLUSTER_ACIMA');
        }
    }
    if (dados.clusterLiquidacaoAbaixo !== undefined && dados.preco) {
        if (Math.abs(dados.preco - dados.clusterLiquidacaoAbaixo)/dados.preco < 0.01) {
            drBullish += 2;
            flags.push('CLUSTER_ABAIXO');
        }
    }
    
    // Ajustar o total do bloco proporcionalmente para manter a soma de 100 (35 max)
    drBullish = drBullish * (35 / 40);
    drBearish = drBearish * (35 / 40);

    // BLOCO MACRO (Máx 20)
    let mcBullish = 0;
    let mcBearish = 0;
    
    if (dados.vix !== undefined) {
        if (dados.vix < 15) mcBullish += 6;
        else if (dados.vix >= 15 && dados.vix < 20) { mcBullish += 2; mcBearish += 2; }
        else if (dados.vix >= 20 && dados.vix < 25) mcBearish += 2;
        else if (dados.vix >= 25 && dados.vix <= 30) {
            mcBearish += 4; flags.push('VIX_ELEVADO');
        } else if (dados.vix > 30) {
            mcBearish += 6; flags.push('VIX_CRITICO');
        }
    }
    
    if (dados.dxyVariacao !== undefined) {
        if (dados.dxyVariacao < -0.3) mcBullish += 6;
        else if (dados.dxyVariacao >= -0.3 && dados.dxyVariacao <= 0.3) { mcBullish += 1.5; mcBearish += 1.5; }
        else if (dados.dxyVariacao > 0.3 && dados.dxyVariacao <= 0.7) mcBearish += 4;
        else if (dados.dxyVariacao > 0.7) {
            mcBearish += 6; flags.push('DXY_FORTE');
        }
    }
    
    if (dados.sp500Variacao !== undefined) {
        if (dados.sp500Variacao > 0.5) mcBullish += 4;
        else if (dados.sp500Variacao >= -0.5 && dados.sp500Variacao <= 0.5) { mcBullish += 1; mcBearish += 1; }
        else if (dados.sp500Variacao < -0.5) mcBearish += 4;
    }
    
    if (dados.btcDominanciaVariacao !== undefined) {
        if (dados.btcDominanciaVariacao > 0) mcBearish += 4; // Para altcoins
        else if (dados.btcDominanciaVariacao < 0) mcBullish += 4; // Para altcoins
    }
    if (dados.usdtDominanciaVariacao !== undefined && dados.usdtDominanciaVariacao > 0.2) {
        mcBearish += 4;
        flags.push('SAIDA_DO_MERCADO');
    }
    if (dados.correlacaoBtc && dados.correlacaoBtc.descorrelacaoDetectada) {
        if (dados.correlacaoBtc.tipoDescorrelacao === 'FORCA_RELATIVA') {
            mcBullish += 8;
            flags.push('ACUMULACAO_INSTITUCIONAL');
        } else if (dados.correlacaoBtc.tipoDescorrelacao === 'FRAQUEZA_RELATIVA') {
            mcBearish += 8;
            flags.push('DISTRIBUICAO_INSTITUCIONAL');
        }
    }

    // Ajustar o total do bloco proporcionalmente para manter a soma de 100 (20 max)
    mcBullish = mcBullish * (20 / 28);
    mcBearish = mcBearish * (20 / 28);

    // BLOCO SENTIMENTO (Máx 10)
    let stBullish = 0;
    let stBearish = 0;
    
    if (dados.fearGreed !== undefined) {
        if (dados.fearGreed > 80) { stBearish += 4; flags.push('EUFORIA_EXTREMA'); }
        else if (dados.fearGreed >= 60 && dados.fearGreed <= 80) { stBullish += 2; flags.push('CAUTELA_EUFORIA'); }
        else if (dados.fearGreed >= 40 && dados.fearGreed < 60) { stBullish += 1; stBearish += 1; }
        else if (dados.fearGreed >= 20 && dados.fearGreed < 40) { stBullish += 2; }
        else if (dados.fearGreed < 20) { stBullish += 4; flags.push('PANICO_EXTREMO_OPORTUNIDADE'); }
    }
    
    if (dados.geopoliticaScore === 3) stBullish += 3;
    else if (dados.geopoliticaScore === -3) stBearish += 3;
    
    if (dados.sentimentoMoedaScore === 3) stBullish += 3;
    else if (dados.sentimentoMoedaScore === -3) stBearish += 3;

    pontosBullish = tcBullish + drBullish + mcBullish + stBullish;
    pontosBearish = tcBearish + drBearish + mcBearish + stBearish;
    
    // Calcula score final sem normalização artificial
    let scoreFinal = 50;
    if (pontosBullish > pontosBearish) {
        scoreFinal = Math.min(50 + ((pontosBullish - pontosBearish) / 2), 100);
    } else if (pontosBearish > pontosBullish) {
        scoreFinal = Math.max(50 - ((pontosBearish - pontosBullish) / 2), 0);
    }
    
    // Cap score em 65 quando dados técnicos estão ausentes (evita inflação artificial)
    if (!isTechnicalPresent) {
        if (scoreFinal > 65) scoreFinal = 65;
        if (scoreFinal < 35) scoreFinal = 35;
        flags.push('CONFIANCA_REDUZIDA_SEM_TECNICO');
    }
    
    let vies = 'NEUTRO';
    if (scoreFinal > 84) vies = 'LONG_FORTE';
    else if (scoreFinal >= 70 && scoreFinal <= 84) vies = 'LONG_MODERADO';
    else if (scoreFinal >= 55 && scoreFinal <= 69) vies = 'LONG_LEVE';
    else if (scoreFinal >= 45 && scoreFinal <= 54) vies = 'NEUTRO';
    else if (scoreFinal >= 31 && scoreFinal <= 44) vies = 'SHORT_LEVE';
    else if (scoreFinal >= 16 && scoreFinal <= 30) vies = 'SHORT_MODERADO';
    else if (scoreFinal < 16) vies = 'SHORT_FORTE';
    
    let confiabilidade = 'BAIXA';
    const techDir = tcBullish > tcBearish ? 'BULL' : 'BEAR';
    const derivDir = drBullish > drBearish ? 'BULL' : 'BEAR';
    
    if (Math.abs(tcBullish - tcBearish) > 5 && Math.abs(drBullish - drBearish) > 5) {
        if (techDir === derivDir) confiabilidade = 'ALTA';
        else confiabilidade = 'BAIXA';
    } else {
        confiabilidade = 'MEDIA';
    }

    return {
        scoreFinal: Math.round(scoreFinal),
        vies,
        blocoTecnico: { pontos: Math.max(tcBullish, tcBearish), maximo: 35, percentual: Math.min((Math.max(tcBullish, tcBearish)/35)*100, 100) },
        blocoDerivativos: { pontos: Math.max(drBullish, drBearish), maximo: 35, percentual: Math.min((Math.max(drBullish, drBearish)/35)*100, 100) },
        blocoMacro: { pontos: Math.max(mcBullish, mcBearish), maximo: 20, percentual: Math.min((Math.max(mcBullish, mcBearish)/20)*100, 100) },
        blocoSentimento: { pontos: Math.max(stBullish, stBearish), maximo: 10, percentual: Math.min((Math.max(stBullish, stBearish)/10)*100, 100) },
        flags: [...new Set(flags)],
        confiabilidade
    };
};
