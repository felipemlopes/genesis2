import { SweepDetectionOutput } from './liquiditySweepDetector';
import { MaturityOutput } from './maturityPenalty';
import { CvdAnalysisOutput } from './cvdDivergenceAnalyzer';

export type AnalysisGovernorInput = {
  structuralBias: "long" | "short" | "neutral";
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
  isLatePhase: boolean;
  locationScore: number;
  isEfficientLocation: boolean;
  isTooFarFromDefense: boolean;
  exhaustionRiskScore: number;
  flowScore: number;
  flowDirection: "bullish" | "bearish" | "neutral";
  cvdState: "confirming" | "diverging" | "ambiguous";
  fundingState: "supportive" | "contrarian" | "neutral";
  oiState: "supportive" | "weak" | "unknown";
  finalScore: number;
  bestPointAlreadyPassed: boolean;
  planAValidity?: "valid" | "weak" | "invalid";
  planBValidity?: "valid" | "weak" | "invalid";
  sweepDetection: SweepDetectionOutput;
  maturityPenalty: MaturityOutput;
  cvdDivergence: CvdAnalysisOutput;
  currentEntryStatus?: "valid" | "weak" | "invalid";
  nextActionableZone?: number;
  shouldWaitForLiquidityTarget?: boolean;
};

export type AnalysisGovernorResult = {
  governanceSummary: string[];
  hardRules: string[];
  narrativeBias: "conservative" | "balanced" | "aggressive";
  shouldReduceConfidence: boolean;
  shouldAvoidContinuationLanguage: boolean;
  shouldFlagLateEntry: boolean;
};

export function buildAnalysisGovernance(input: AnalysisGovernorInput): AnalysisGovernorResult {
  const governanceSummary: string[] = [];
  const hardRules: string[] = [];
  let narrativeBias: "conservative" | "balanced" | "aggressive" = "balanced";
  let shouldReduceConfidence = false;
  let shouldAvoidContinuationLanguage = false;
  let shouldFlagLateEntry = false;

  if (input.marketPhase === "stretched" || input.marketPhase === "exhausted") {
    governanceSummary.push("Movimento em fase tardia");
    shouldReduceConfidence = true;
    shouldAvoidContinuationLanguage = true;
    shouldFlagLateEntry = true;
  }

  if (input.bestPointAlreadyPassed) {
    governanceSummary.push("Melhor ponto de entrada já passou");
    shouldReduceConfidence = true;
    shouldAvoidContinuationLanguage = true;
    shouldFlagLateEntry = true;
  }

  if (input.isTooFarFromDefense) {
    governanceSummary.push("Preço distante da defesa estrutural");
    shouldReduceConfidence = true;
  }

  if (!input.isEfficientLocation || input.locationScore < 60) {
    governanceSummary.push("Localização operacional ineficiente");
    shouldReduceConfidence = true;
  }

  if (input.exhaustionRiskScore >= 60) {
    governanceSummary.push("Risco elevado de esticamento ou exaustão");
    shouldReduceConfidence = true;
    shouldAvoidContinuationLanguage = true;
  }

  if (input.cvdState === "ambiguous") {
    governanceSummary.push("CVD sem confirmação suficiente");
    hardRules.push("Não afirmar absorção ou continuidade com base apenas no CVD");
  }

  if (input.cvdState === "diverging") {
    governanceSummary.push("Fluxo divergente em relação ao preço");
    hardRules.push("Não tratar divergência como continuação automática");
  }

  if (input.fundingState !== "neutral") {
    hardRules.push("Funding é apenas contexto, não gatilho");
  }

  if (input.oiState === "unknown" || input.oiState === "weak") {
    governanceSummary.push("Open Interest sem confirmação forte");
  }

  if (input.planAValidity === "weak" || input.planAValidity === "invalid") {
    governanceSummary.push("Plano A com vantagem reduzida");
  }

  if (input.planBValidity === "weak" || input.planBValidity === "invalid") {
    governanceSummary.push("Plano B depende de confirmação adicional");
  }

  if (input.sweepDetection.blockEntry) {
    governanceSummary.push(input.sweepDetection.suggestedAction);
    shouldReduceConfidence = true;
    shouldAvoidContinuationLanguage = true;
  }

  if (input.currentEntryStatus === "invalid") {
    const zoneText = input.nextActionableZone ? ` em $${input.nextActionableZone}` : "";
    governanceSummary.push(`Entrada atual ruim. Próxima zona de interesse${zoneText}`);
    hardRules.push(`O texto não pode terminar apenas com negação`);
    hardRules.push(`O texto deve obrigatoriamente mencionar a próxima zona provável de liquidez`);
    hardRules.push(`O texto deve obrigatoriamente mencionar a condição de reentrada`);
    hardRules.push(`O texto deve obrigatoriamente separar: direção provável de qualidade da entrada atual`);
  }

  if (input.nextActionableZone) {
    hardRules.push(`Mencionar explicitamente o nível $${input.nextActionableZone} como próxima zona operacional`);
  }

  if (input.shouldWaitForLiquidityTarget) {
    const zoneText = input.nextActionableZone ? ` em $${input.nextActionableZone}` : "";
    governanceSummary.push(`Esperar visita${zoneText}`);
    hardRules.push(`Priorizar "esperar visita${zoneText}" em vez de apenas "não operar"`);
  }

  hardRules.push("Nunca encerrar a análise apenas com 'sem vantagem operacional'");
  hardRules.push("Sempre informar próxima zona provável de liquidez quando a entrada estiver inválida");
  hardRules.push("Sempre informar condição objetiva para nova entrada");
  hardRules.push("Nunca apagar a direção provável por causa de timing ruim");

  hardRules.push("Não usar EMA distante como justificativa operacional");
  hardRules.push("Não usar o termo LVM");
  hardRules.push("Não chamar entrada tardia de antecipação");
  hardRules.push("Não inflar score ou convicção quando a localização for ruim");
  hardRules.push("Separar direção estrutural de timing de execução");

  if (shouldReduceConfidence) {
    narrativeBias = "conservative";
  } else if (input.finalScore >= 80 && input.locationScore >= 70 && !input.bestPointAlreadyPassed) {
    narrativeBias = "aggressive";
  }

  return {
    governanceSummary,
    hardRules,
    narrativeBias,
    shouldReduceConfidence,
    shouldAvoidContinuationLanguage,
    shouldFlagLateEntry
  };
}
