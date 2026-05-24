import { ResultadoScore } from './scoringEngine';

export const gerarContextoParaGemini = (score: ResultadoScore, dados: any): string => {
    let contexto = "DADOS MATEMÁTICOS CALCULADOS EM TEMPO REAL. CONSIDERAR COMO VERDADE ABSOLUTA.\n\n";
    
    contexto += "DADOS TÉCNICOS:\n";
    if (dados.preco) contexto += `Preço Atual: ${dados.preco}\n`;
    if (dados.ema21) contexto += `EMA 21: ${dados.ema21} (${dados.ema21Subindo ? 'Subindo' : 'Caindo'})\n`;
    if (dados.ema50) contexto += `EMA 50: ${dados.ema50} (${dados.ema50Subindo ? 'Subindo' : 'Caindo'})\n`;
    if (dados.ema200) contexto += `EMA 200: ${dados.ema200} (${dados.ema200Subindo ? 'Subindo' : 'Caindo'})\n`;
    if (dados.rsi) contexto += `RSI (14): ${dados.rsi}\n`;
    if (dados.divergenciaRSI) contexto += `Divergência RSI: ${dados.divergenciaRSI}\n`;
    if (dados.adx) contexto += `ADX: ${dados.adx} (${dados.adxSubindo ? 'Subindo' : 'Caindo'})\n`;
    if (dados.atrAtual) contexto += `ATR Atual: ${dados.atrAtual}\n`;
    if (dados.compressaoDetectada !== undefined) contexto += `Compressão Volatilidade: ${dados.compressaoDetectada}\n`;
    
    contexto += "\nDADOS DE DERIVATIVOS:\n";
    if (dados.cvdSlope) contexto += `Inclinacao CVD: ${dados.cvdSlope}\n`;
    if (dados.divergenciaCVD) contexto += `Divergência CVD: ${dados.divergenciaCVD}\n`;
    if (dados.fundingMedio) contexto += `Funding Rate Médio: ${dados.fundingMedio}\n`;
    if (dados.oiVariacao) contexto += `Variação Open Interest: ${dados.oiVariacao}%\n`;
    if (dados.lsRatioLongs) contexto += `Long/Short Ratio: ${dados.lsRatioLongs}\n`;
    
    if (dados.clusterLiquidacaoAcima) contexto += `Cluster Liquidação Acima: ${dados.clusterLiquidacaoAcima}\n`;
    if (dados.clusterLiquidacaoAbaixo) contexto += `Cluster Liquidação Abaixo: ${dados.clusterLiquidacaoAbaixo}\n`;

    contexto += "\nDADOS MACRO:\n";
    if (dados.vix) contexto += `VIX: ${dados.vix}\n`;
    if (dados.dxyVariacao) contexto += `Variação DXY: ${dados.dxyVariacao}\n`;
    if (dados.sp500Variacao) contexto += `Variação S&P500: ${dados.sp500Variacao}\n`;
    if (dados.btcDominanciaVariacao) contexto += `Dominância BTC Variação: ${dados.btcDominanciaVariacao}\n`;
    
    contexto += "\nSENTIMENTO:\n";
    if (dados.fearGreed) contexto += `Fear & Greed Index: ${dados.fearGreed}\n`;

    contexto += "\nRESULTADOS DO MOTOR DO SCORE FINAL:\n";
    contexto += `Score Final Calculado: ${score.scoreFinal}\n`;
    contexto += `Viés Principal: ${score.vies}\n`;
    contexto += `Confiabilidade do Setup: ${score.confiabilidade}\n`;
    
    contexto += "\nFLAGS ATIVAS:\n";
    if (score.flags && score.flags.length > 0) {
        contexto += score.flags.join(", ");
    } else {
        contexto += "Nenhuma flag extrema detectada.";
    }

    return contexto;
};

export const gerarFlagsVisuais = (flags: string[]): { texto: string; tipo: 'ALERTA' | 'OPORTUNIDADE' | 'INFO' }[] => {
    return flags.map(flag => {
        let tipo: 'ALERTA' | 'OPORTUNIDADE' | 'INFO' = 'INFO';
        const txt = flag.replace(/_/g, ' ');

        if (flag.includes('IMINENTE') || flag.includes('OPORTUNIDADE') || flag.includes('CLUSTER')) {
            tipo = 'OPORTUNIDADE';
        }
        if (flag.includes('EXTREMA') || flag.includes('CRITICO') || flag.includes('BEARISH') || flag.includes('FRACA') || flag.includes('FRACO')) {
            tipo = 'ALERTA';
        }
        
        return { texto: txt, tipo };
    });
};

export const gerarSinteseScore = (score: ResultadoScore): string => {
    if (score.scoreFinal > 80) return "Forte alinhamento de múltiplos fatores apontando continuação de tendência. Alta convicção.";
    if (score.scoreFinal < 20) return "Forte alinhamento institucional de distribuição e correção profunda iminente. Extrema cautela em longs.";
    if (score.confiabilidade === 'BAIXA') return "Técnico e derivativos em direções opostas. O mercado está indeciso, recomendação de aguardar.";
    if (score.flags.includes('ROMPIMENTO_IMINENTE')) return "Compressão de volatilidade indica rompimento massivo prestes a ocorrer.";
    if (score.flags.includes('LONG_SQUEEZE_IMINENTE')) return "Excesso de alavancagem em longs cria alto risco de liquidação em cascata (Long Squeeze).";
    if (score.flags.includes('SHORT_SQUEEZE_IMINENTE')) return "Acúmulo de shorts e funding negativo abrem espaço para forte rali de cobertura (Short Squeeze).";
    
    if (score.scoreFinal >= 60) return "Alinhamento construtivo entre força técnica e contexto de fluxo, favorecendo operações de compra.";
    if (score.scoreFinal <= 40) return "Estrutura fraca com fluxo desfavorável, risco significativo de perda de suportes chave.";
    
    return "Mercado em consolidação ou sem viés de direção claro. Privilegiar operações de scalp ou fora das zonas médias.";
};
