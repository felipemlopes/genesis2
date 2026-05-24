export type EntryPlannerInput = {
  currentPrice: number;
  structuralBias: "long" | "short" | "neutral";
  marketPhase: "building" | "breakout" | "executing" | "stretched" | "exhausted" | "range" | "neutral";
  locationScore: number;
  isEfficientLocation: boolean;
  isTooFarFromDefense: boolean;
  nearestDefense?: number;
  nearestAcceptanceZone?: number;
  exhaustionScore: number;
  hvn?: number;
  lvn?: number;
  lhm?: number;
  ema21?: number;
};

export type EntryPlanItem = {
  price: number;
  rationale: string;
  validity: "valid" | "weak" | "invalid";
};

export type EntryPlannerResult = {
  planA?: EntryPlanItem;
  planB?: EntryPlanItem;
  bestPointAlreadyPassed: boolean;
};

export function buildEntryPlan(input: EntryPlannerInput): EntryPlannerResult {
  const {
    currentPrice,
    structuralBias,
    marketPhase,
    locationScore,
    isEfficientLocation,
    isTooFarFromDefense,
    nearestDefense,
    nearestAcceptanceZone,
    exhaustionScore,
    hvn,
    lvn,
    lhm,
    ema21
  } = input;

  const result: EntryPlannerResult = {
    bestPointAlreadyPassed: false
  };

  const isLate = marketPhase === "stretched" || marketPhase === "exhausted";
  const highExhaustion = exhaustionScore >= 60;

  if (isLate) {
     result.bestPointAlreadyPassed = true;
  }

  // Force direction: If neutral, fallback to momentum of current price relative to moving averages / defense
  const forcedBias = structuralBias === "neutral" ? (currentPrice > (ema21 || currentPrice * 0.99) ? "long" : "short") : structuralBias;

  if (forcedBias === "long") {
    if (nearestAcceptanceZone && !isLate && locationScore >= 60) {
      result.planA = {
        price: nearestAcceptanceZone,
        rationale: "Antecipação em zona de valor com fluxo forte.\nRisco elevado de liquidação precoce.",
        validity: "valid"
      };
    } else if (nearestAcceptanceZone) {
      result.planA = {
        price: nearestAcceptanceZone,
        rationale: "Antecipação de continuidade do movimento atual.\nRisco alto por timing esticado.",
        validity: "weak"
      };
    }

    const longPlanBBase =
      typeof hvn === "number" ? hvn :
      typeof lvn === "number" ? lvn :
      typeof lhm === "number" ? lhm :
      typeof nearestDefense === "number" ? nearestDefense :
      undefined;

    if (typeof longPlanBBase === "number") {
      result.planB = {
        price: longPlanBBase,
        rationale: "Confirmação via reteste no suporte estrutural.\nAguardar rejeição de volume na região.",
        validity: isTooFarFromDefense || highExhaustion ? "weak" : "valid"
      };
    }
  }

  if (forcedBias === "short") {
    if (nearestAcceptanceZone && !isLate && locationScore >= 60) {
      result.planA = {
        price: nearestAcceptanceZone,
        rationale: "Antecipação do despejo na zona de valor.\nRisco de squeeze direcional alto.",
        validity: "valid"
      };
    } else if (nearestAcceptanceZone) {
      result.planA = {
        price: nearestAcceptanceZone,
        rationale: "Antecipação na fraqueza do impulso.\nRisco de violação caso haja repique.",
        validity: "weak"
      };
    } else {
        result.planA = {
           price: currentPrice * 1.01,
           rationale: "Antecipação de falha de topo local.\nRisco direcional iminente.",
           validity: "weak"
        }
    }

    const shortPlanBBase =
      typeof lvn === "number" ? lvn :
      typeof lhm === "number" ? lhm :
      typeof hvn === "number" ? hvn :
      typeof nearestDefense === "number" ? nearestDefense :
      undefined;

    if (typeof shortPlanBBase === "number") {
      result.planB = {
        price: shortPlanBBase,
        rationale: "Confirmação via perda da LTA ou reteste na POC.\nAguardar engolfo vendedor cruzando médias.",
        validity: isTooFarFromDefense || highExhaustion ? "weak" : "valid"
      };
    } else {
        result.planB = {
            price: ema21 || (currentPrice * 1.05),
            rationale: "Confirmação via resistência da Média Móvel.\nAguardar fraqueza vendedora técnica.",
            validity: "weak"
        }
    }
  }

  if (typeof ema21 === "number") {
    const emaDistancePct = Math.abs(currentPrice - ema21) / currentPrice * 100;
    if (emaDistancePct > 3) {
      if (result.planB && result.planB.price === ema21) {
        result.planB.validity = "weak";
        result.planB.rationale = "Confirmação complexa por distanciamento da EMA.\nAguardar aproximação expressiva.";
      }
    }
  }

  // Force filling Plan A if empty
  if (!result.planA && forcedBias === 'long') {
      result.planA = { price: currentPrice * 0.99, rationale: 'Antecipação induzida (Long).\nRisco sistemático.', validity: 'weak' };
  }
  if (!result.planA && forcedBias === 'short') {
      result.planA = { price: currentPrice * 1.01, rationale: 'Antecipação induzida (Short).\nRisco sistemático.', validity: 'weak' };
  }

  // SANITY CHECK: Mathematical Constraint
  // Plan A is anticipation (near price). Plan B is confirmation (support/resistance).
  if (result.planA && result.planB) {
      if (forcedBias === 'long') {
          // Both must be below current price or very close to it (pullback)
          if (result.planA.price > currentPrice * 1.005) {
              result.planA.price = currentPrice * 0.995;
          }
          // Plan B MUST be structurally below Plan A and current price
          if (result.planB.price >= result.planA.price) {
              // Override irrational target with a safe structural fallback (-2% for crypto structural buffer)
              result.planB.price = result.planA.price * 0.98;
          }
      } else if (forcedBias === 'short') {
          // Both must be above current price or very close to it (pullback)
          if (result.planA.price < currentPrice * 0.995) {
              result.planA.price = currentPrice * 1.005;
          }
          // Plan B MUST be structurally above Plan A and current price
          if (result.planB.price <= result.planA.price) {
              // Override irrational target with a safe structural fallback (+2% for crypto structural buffer)
              result.planB.price = result.planA.price * 1.02;
          }
      }
  }

  // Format truncations simply (max 4 decimals, handle extreme floats)
  if (result.planA) result.planA.price = Number(result.planA.price.toFixed(4));
  if (result.planB) result.planB.price = Number(result.planB.price.toFixed(4));

  // Ensure bestPointAlreadyPassed logic is maintained but we ALWAYS output entries
  return result;
}
