// Service dedicated to Futures Math based on Exchange Documentation

interface FuturesResult {
  pnl: number;
  roe: number;
}

// CONSTANTS: Maintenance Margin Rates (MMR) for Tier 1 (< 250k USDT usually)
// Based on latest docs (2024/2025)
const EXCHANGE_MMR: Record<string, number> = {
  'Binance': 0.004, // 0.40%
  'Bybit': 0.005,   // 0.50%
  'Bitget': 0.005,  // 0.50%
  'Default': 0.005
};

/**
 * Calculates the Position Size in COINS based on Margin and Leverage.
 * Formula: (Margin * Leverage) / Entry Price
 */
export const calculatePositionSize = (margin: number, leverage: number, entryPrice: number): number => {
  return (margin * leverage) / entryPrice;
};

/**
 * BINANCE USD-M FUTURES CALCULATION
 * PNL = Size * Direction * (Mark Price - Entry Price)
 * ROE% = PNL / Initial Margin
 */
export const calculateBinanceFutures = (
  entryPrice: number,
  markPrice: number,
  margin: number,
  leverage: number,
  direction: 'LONG' | 'SHORT'
): FuturesResult => {
  const dirMultiplier = direction === 'LONG' ? 1 : -1;
  const positionSize = calculatePositionSize(margin, leverage, entryPrice);
  
  // Binance PnL: Size * Direction * (Mark - Entry)
  const pnl = positionSize * dirMultiplier * (markPrice - entryPrice);
  const roe = (pnl / margin) * 100;

  return { pnl, roe };
};

/**
 * BYBIT USDT CONTRACT FUTURES CALCULATION
 * Based on user documentation:
 * 1. PnL = Qty * (Current - Entry)
 * 2. ROI = (PnL / Position Margin) * 100
 * 3. Position Margin = Initial Margin + Fee To Close
 * 4. Fee To Close = Bankruptcy Price * Qty * 0.055%
 */
export const calculateBybitFutures = (
  entryPrice: number,
  currentPrice: number,
  margin: number,
  leverage: number,
  direction: 'LONG' | 'SHORT'
): FuturesResult => {
  const dirMultiplier = direction === 'LONG' ? 1 : -1;
  
  // 1. Calculate Quantity (Total Contract Value / Entry) - approx based on Margin
  // In Bybit: Initial Margin = (Qty * Entry) / Leverage
  // Therefore: Qty = (Initial Margin * Leverage) / Entry
  const qty = (margin * leverage) / entryPrice;

  // 2. Calculate Unrealized P&L
  // Long: Qty * (Current - Entry)
  // Short: Qty * (Entry - Current) -> which is same as Qty * -1 * (Current - Entry)
  const pnl = qty * dirMultiplier * (currentPrice - entryPrice);

  // 3. Calculate Bankruptcy Price (needed for Fee to Close)
  // Long: Entry * (1 - 1/Lev)
  // Short: Entry * (1 + 1/Lev)
  let bankruptcyPrice = 0;
  if (direction === 'LONG') {
    bankruptcyPrice = entryPrice * (1 - (1 / leverage));
  } else {
    bankruptcyPrice = entryPrice * (1 + (1 / leverage));
  }

  // 4. Calculate Fee to Close
  // Fee = Bankruptcy Price * Qty * 0.055% (0.00055)
  const feeRate = 0.00055;
  const feeToClose = bankruptcyPrice * qty * feeRate;

  // 5. Calculate Position Margin
  // Position Margin = Initial Margin + Fee to Close
  const positionMargin = margin + feeToClose;

  // 6. Calculate ROI %
  // ROI = (PnL / Position Margin) * 100
  const roe = (pnl / positionMargin) * 100;

  return { pnl, roe };
};

/**
 * BITGET USDT-M FUTURES CALCULATION
 * Based on user documentation:
 * 1. Unrealized PnL (Long) = (Mark Price - Entry Price) * Contract Size
 * 2. Unrealized PnL (Short) = (Entry Price - Mark Price) * Contract Size
 * 3. Contract Size = (Margin * Leverage) / Entry Price
 * 4. Fees: NOT included in Unrealized PnL (only in Realized).
 */
export const calculateBitgetFutures = (
  entryPrice: number,
  markPrice: number,
  margin: number,
  leverage: number,
  direction: 'LONG' | 'SHORT'
): FuturesResult => {
  // 1. Calculate Contract Size (Quantity)
  const qty = (margin * leverage) / entryPrice;

  // 2. Calculate Unrealized PnL
  let pnl = 0;
  if (direction === 'LONG') {
    // (Mark Price - Entry Price) * Contract Size
    pnl = (markPrice - entryPrice) * qty;
  } else {
    // (Entry Price - Mark Price) * Contract Size
    pnl = (entryPrice - markPrice) * qty;
  }

  // 3. Calculate ROI (Unrealized PnL% = PnL / Initial Margin)
  // Unlike Bybit, Bitget Unrealized PnL excludes fees, so we divide by simple margin
  const roe = (pnl / margin) * 100;

  return { pnl, roe };
};

/**
 * Main Router to select the correct calculation based on Exchange
 */
export const calculateFuturesPnL = (
  entryPrice: number,
  currentPrice: number,
  margin: number,
  leverage: number,
  direction: 'LONG' | 'SHORT',
  exchange: string
): FuturesResult => {
  switch (exchange) {
    case 'Binance':
      return calculateBinanceFutures(entryPrice, currentPrice, margin, leverage, direction);
    case 'Bybit':
      return calculateBybitFutures(entryPrice, currentPrice, margin, leverage, direction);
    case 'Bitget':
      return calculateBitgetFutures(entryPrice, currentPrice, margin, leverage, direction);
    default:
      return calculateBinanceFutures(entryPrice, currentPrice, margin, leverage, direction);
  }
};

/**
 * Calculates PRECISE Liquidation Price (Isolated Margin)
 * Formula: 
 * LONG: Entry * (1 - (1/Lev) + MMR)
 * SHORT: Entry * (1 + (1/Lev) - MMR)
 */
export const calculateLiquidationPrice = (
  entryPrice: number,
  leverage: number,
  direction: 'LONG' | 'SHORT',
  exchange: string = 'Binance'
): number => {
  if (leverage <= 0 || entryPrice <= 0) return 0;

  // Get correct MMR for exchange, default to 0.5% if unknown
  const mmr = EXCHANGE_MMR[exchange] || EXCHANGE_MMR['Default'];

  if (direction === 'LONG') {
    // Example: Entry 100, Lev 10, MMR 0.004
    // 100 * (1 - 0.1 + 0.004) = 100 * 0.904 = 90.4
    return entryPrice * (1 - (1 / leverage) + mmr);
  } else {
    // Example: Entry 100, Lev 10, MMR 0.004
    // 100 * (1 + 0.1 - 0.004) = 100 * 1.096 = 109.6
    return entryPrice * (1 + (1 / leverage) - mmr);
  }
};