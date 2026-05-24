import { fetchAlternativeMeContext } from './externalContextService';

export interface SentimentEngineResult {
  score: number; // -1.0 to 1.0 (Bearish to Bullish)
  status: string;
  description: string;
}

export const runSentimentEngine = async (): Promise<SentimentEngineResult> => {
  try {
    const rawData = await fetchAlternativeMeContext();
    if (!rawData) {
        return {
            score: 0,
            status: 'Neutro (Fallback)',
            description: 'API de Sentimento retornou vazio. Assumindo neutralidade.'
        };
    }
    // Assuming the format is something like "Fear & Greed Index Score: X"
    const scoreMatch = rawData.match(/\d+/);
    if (scoreMatch) {
      const value = parseInt(scoreMatch[0], 10);
      // F&G index is 0 (Extreme Fear) to 100 (Extreme Greed)
      // Map 0 -> -1.0 (Extreme Bearish), 100 -> +1.0 (Extreme Bullish)
      const normalizedScore = (value - 50) / 50; 
      
      let status = 'Neutro';
      if (normalizedScore > 0.5) status = 'Euforia (Bullish)';
      else if (normalizedScore > 0.1) status = 'Otimismo Real';
      else if (normalizedScore < -0.5) status = 'Pânico (Bearish)';
      else if (normalizedScore < -0.1) status = 'Pessimismo';

      return {
        score: normalizedScore,
        status,
        description: `Sentimento extraído do Fear & Greed (${value}/100). ${status}.`
      };
    }
  } catch(e) {
    console.error("Sentiment Engine ERRO", e);
  }

  return {
    score: 0,
    status: 'Desconhecido',
    description: 'Falha ao recuperar o Sentimento Quantitativo.'
  };
};
