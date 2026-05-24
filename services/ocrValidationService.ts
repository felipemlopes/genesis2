export type OcrValidationInput = {
  currentPrice?: number;
  visibleHigh?: number;
  visibleLow?: number;
  adx?: number;
  plusDi?: number;
  minusDi?: number;
  poc?: number;
  hvn?: number;
  lvn?: number;
  lhm?: number;
  rsi?: number;
};

export type OcrValidationResult = {
  isValid: boolean;
  errors: string[];
};

export function validateOcrExtraction(input: OcrValidationInput): OcrValidationResult {
  const errors: string[] = [];

  if (input.adx !== undefined && input.adx !== null && (input.adx < 0 || input.adx > 100)) {
    errors.push("ADX deve estar entre 0 e 100.");
  }
  if (input.plusDi !== undefined && input.plusDi !== null && (input.plusDi < 0 || input.plusDi > 100)) {
    errors.push("+DI deve estar entre 0 e 100.");
  }
  if (input.minusDi !== undefined && input.minusDi !== null && (input.minusDi < 0 || input.minusDi > 100)) {
    errors.push("-DI deve estar entre 0 e 100.");
  }
  if (input.rsi !== undefined && input.rsi !== null && (input.rsi < 0 || input.rsi > 100)) {
    errors.push("RSI deve estar entre 0 e 100.");
  }
  if (input.visibleLow !== undefined && input.visibleHigh !== undefined && input.visibleLow >= input.visibleHigh) {
    errors.push("visibleLow deve ser menor que visibleHigh.");
  }

  if (input.currentPrice !== undefined && input.visibleLow !== undefined && input.visibleHigh !== undefined) {
    const range = input.visibleHigh - input.visibleLow;
    const expandedLow = input.visibleLow - range * 0.5;
    const expandedHigh = input.visibleHigh + range * 0.5;
    if (input.currentPrice < expandedLow || input.currentPrice > expandedHigh) {
      errors.push("currentPrice está absurdamente fora do range visível.");
    }
  }

  const checkLevel = (level: number | undefined | null, name: string) => {
    if (level !== undefined && level !== null && input.visibleLow !== undefined && input.visibleHigh !== undefined) {
      const range = input.visibleHigh - input.visibleLow;
      const expandedLow = input.visibleLow - range * 1.0;
      const expandedHigh = input.visibleHigh + range * 1.0;
      if (level < expandedLow || level > expandedHigh) {
        errors.push(`${name} está absurdamente fora do range visível.`);
      }
    }
  };

  checkLevel(input.poc, "POC");
  checkLevel(input.hvn, "HVN");
  checkLevel(input.lvn, "LVN");
  checkLevel(input.lhm, "LHM");

  return {
    isValid: errors.length === 0,
    errors
  };
}
