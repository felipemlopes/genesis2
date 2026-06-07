import math
from datetime import datetime, timezone


def calcular_ema(closes, periodo):
    if len(closes) < periodo * 2:
        return None
    initial_sum = sum(closes[:periodo])
    ema = initial_sum / periodo
    k = 2 / (periodo + 1)
    for i in range(periodo, len(closes)):
        ema = (closes[i] - ema) * k + ema
    current_price = closes[-1]
    if math.isfinite(ema) and ema > 0 and ema >= current_price * 0.1 and ema <= current_price * 10:
        return ema
    return None


def calcular_ema_series(closes, periodo):
    if len(closes) < periodo:
        return []
    initial_sum = sum(closes[:periodo])
    ema = initial_sum / periodo
    result = [None] * periodo
    result.append(ema)
    k = 2 / (periodo + 1)
    for i in range(periodo + 1, len(closes)):
        ema = (closes[i] - ema) * k + ema
        result.append(ema)
    return result


def calcular_rsi(closes, periodo=14):
    if len(closes) <= periodo:
        return None
    gains = 0
    losses = 0
    for i in range(1, periodo + 1):
        diff = closes[i] - closes[i - 1]
        if diff > 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / periodo
    avg_loss = losses / periodo
    for i in range(periodo + 1, len(closes)):
        diff = closes[i] - closes[i - 1]
        if diff > 0:
            avg_gain = (avg_gain * (periodo - 1) + diff) / periodo
            avg_loss = (avg_loss * (periodo - 1)) / periodo
        else:
            avg_gain = (avg_gain * (periodo - 1)) / periodo
            avg_loss = (avg_loss * (periodo - 1) - diff) / periodo
    if avg_loss == 0:
        return 99
    if avg_gain == 0:
        return 1
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    if 1 <= rsi <= 99:
        return rsi
    return None


def calcular_atr(candles, periodo=14):
    if len(candles) <= periodo:
        return None
    trs = []
    for i in range(1, len(candles)):
        high = candles[i]['high']
        low = candles[i]['low']
        prev_close = candles[i - 1]['close']
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs.append(tr)
    atr = sum(trs[:periodo]) / periodo
    for i in range(periodo, len(trs)):
        atr = (atr * (periodo - 1) + trs[i]) / periodo
    if atr > 0:
        return atr
    return None


def calcular_adx(candles, periodo=14):
    if len(candles) <= periodo * 2:
        return None
    trs = []
    pdms = []
    ndms = []
    for i in range(1, len(candles)):
        high = candles[i]['high']
        low = candles[i]['low']
        prev_high = candles[i - 1]['high']
        prev_low = candles[i - 1]['low']
        prev_close = candles[i - 1]['close']
        up_move = high - prev_high
        down_move = prev_low - low
        pdm = 0
        ndm = 0
        if up_move > down_move and up_move > 0:
            pdm = up_move
        if down_move > up_move and down_move > 0:
            ndm = down_move
        tr = max(high - low, abs(high - prev_close), abs(low - prev_close))
        trs.append(tr)
        pdms.append(pdm)
        ndms.append(ndm)

    def wilder_smooth(data, period):
        smoothed = []
        initial = sum(data[:period])
        smoothed.append(initial)
        for i in range(period, len(data)):
            prev = smoothed[-1]
            smoothed.append(prev - (prev / period) + data[i])
        return smoothed

    smoothed_tr = wilder_smooth(trs, periodo)
    smoothed_pdm = wilder_smooth(pdms, periodo)
    smoothed_ndm = wilder_smooth(ndms, periodo)
    dxs = []
    final_di_plus = 0
    final_di_minus = 0
    for i in range(len(smoothed_tr)):
        tr = smoothed_tr[i]
        di_plus = (smoothed_pdm[i] / tr) * 100 if tr > 0 else 0
        di_minus = (smoothed_ndm[i] / tr) * 100 if tr > 0 else 0
        if i == len(smoothed_tr) - 1:
            final_di_plus = di_plus
            final_di_minus = di_minus
        diff = abs(di_plus - di_minus)
        s = di_plus + di_minus
        dx = (diff / s) * 100 if s > 0 else 0
        dxs.append(dx)
    initial_dx_sum = sum(dxs[:periodo])
    adx = initial_dx_sum / periodo
    for i in range(periodo, len(dxs)):
        adx = (adx * (periodo - 1) + dxs[i]) / periodo
    if 0 <= adx <= 100 and 0 <= final_di_plus <= 100 and 0 <= final_di_minus <= 100:
        return {'adx': adx, 'di_plus': final_di_plus, 'di_minus': final_di_minus}
    return None


def calcular_macd(closes):
    fast_period = 12
    slow_period = 26
    signal_period = 9
    if len(closes) < slow_period + signal_period:
        return None
    ema_fast = calcular_ema(closes, fast_period)
    ema_slow = calcular_ema(closes, slow_period)
    if ema_fast is None or ema_slow is None:
        return None
    sum_fast = sum(closes[:fast_period])
    sum_slow = sum(closes[:slow_period])
    current_ema_fast = sum_fast / fast_period
    current_ema_slow = sum_slow / slow_period
    k_fast = 2 / (fast_period + 1)
    k_slow = 2 / (slow_period + 1)
    macd_series = []
    for i in range(slow_period, len(closes)):
        current_ema_fast = (closes[i] - current_ema_fast) * k_fast + current_ema_fast
        current_ema_slow = (closes[i] - current_ema_slow) * k_slow + current_ema_slow
        macd_series.append(current_ema_fast - current_ema_slow)
    if len(macd_series) < signal_period:
        return None
    signal_sum = sum(macd_series[:signal_period])
    signal_ema = signal_sum / signal_period
    k_signal = 2 / (signal_period + 1)
    for i in range(signal_period, len(macd_series)):
        signal_ema = (macd_series[i] - signal_ema) * k_signal + signal_ema
    current_macd = macd_series[-1]
    return {
        'macd': current_macd,
        'signal': signal_ema,
        'histogram': current_macd - signal_ema
    }


def calcular_bollinger(closes, periodo=20, desvios=2):
    if len(closes) < periodo:
        return None
    recent = closes[-periodo:]
    middle = sum(recent) / periodo
    sq_sum = sum((c - middle) ** 2 for c in recent)
    stdev = math.sqrt(sq_sum / periodo)
    return {
        'upper': middle + (stdev * desvios),
        'middle': middle,
        'lower': middle - (stdev * desvios)
    }


def calcular_vwap(candles):
    if not candles:
        return None
    last_dt = datetime.fromtimestamp(candles[-1]['timestamp'] / 1000, tz=timezone.utc)
    current_day = last_dt.strftime('%Y-%m-%d')
    sum_vp = 0
    sum_v = 0
    for i in range(len(candles) - 1, -1, -1):
        d = datetime.fromtimestamp(candles[i]['timestamp'] / 1000, tz=timezone.utc)
        if d.strftime('%Y-%m-%d') == current_day:
            typical_price = (candles[i]['high'] + candles[i]['low'] + candles[i]['close']) / 3
            sum_vp += typical_price * candles[i]['volume']
            sum_v += candles[i]['volume']
        else:
            break
    if sum_v == 0:
        return None
    return sum_vp / sum_v


def calcular_pdh_pdl(candles):
    if not candles:
        return None
    last_dt = datetime.fromtimestamp(candles[-1]['timestamp'] / 1000, tz=timezone.utc)
    current_day = last_dt.strftime('%Y-%m-%d')
    prev_day = ''
    pdh = -math.inf
    pdl = math.inf
    for i in range(len(candles) - 1, -1, -1):
        d = datetime.fromtimestamp(candles[i]['timestamp'] / 1000, tz=timezone.utc)
        d_str = d.strftime('%Y-%m-%d')
        if d_str != current_day:
            if not prev_day:
                prev_day = d_str
            if d_str == prev_day:
                if candles[i]['high'] > pdh:
                    pdh = candles[i]['high']
                if candles[i]['low'] < pdl:
                    pdl = candles[i]['low']
            else:
                break
    if not prev_day:
        return None
    return {'pdh': pdh, 'pdl': pdl}


def _get_week_id(ts):
    d = datetime.fromtimestamp(ts / 1000, tz=timezone.utc)
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]}"


def calcular_pwh_pwl(candles):
    if not candles:
        return None
    current_week = _get_week_id(candles[-1]['timestamp'])
    prev_week = ''
    pwh = -math.inf
    pwl = math.inf
    for i in range(len(candles) - 1, -1, -1):
        w_id = _get_week_id(candles[i]['timestamp'])
        if w_id != current_week:
            if not prev_week:
                prev_week = w_id
            if w_id == prev_week:
                if candles[i]['high'] > pwh:
                    pwh = candles[i]['high']
                if candles[i]['low'] < pwl:
                    pwl = candles[i]['low']
            else:
                break
    if not prev_week:
        return None
    return {'pwh': pwh, 'pwl': pwl}


def identificar_equal_highs(candles, tolerancia=0.0015):
    recent = candles[-100:]
    equals = []
    for i in range(len(recent)):
        for j in range(i + 1, len(recent)):
            diff = abs(recent[i]['high'] - recent[j]['high']) / recent[i]['high']
            if diff < tolerancia:
                equals.append(recent[i]['high'])
    return list(set(equals))


def identificar_equal_lows(candles, tolerancia=0.0015):
    recent = candles[-100:]
    equals = []
    for i in range(len(recent)):
        for j in range(i + 1, len(recent)):
            diff = abs(recent[i]['low'] - recent[j]['low']) / recent[i]['low']
            if diff < tolerancia:
                equals.append(recent[i]['low'])
    return list(set(equals))


def calcular_cvd_slope(cvd_values):
    if len(cvd_values) < 10:
        return 0
    y = cvd_values[-10:]
    x = list(range(10))
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xy = sum(x[i] * y[i] for i in range(10))
    sum_xx = sum(x[i] * x[i] for i in range(10))
    denom = 10 * sum_xx - sum_x * sum_x
    if denom == 0:
        return 0
    slope = (10 * sum_xy - sum_x * sum_y) / denom
    return slope


def detectar_divergencia_rsi(candles, valores_rsi):
    if len(candles) < 20 or len(valores_rsi) < 20:
        return 'NENHUMA'
    recent_candles = candles[-20:]
    recent_rsi = valores_rsi[-20:]
    p1 = 0
    p2 = 0
    high_idx1 = 0
    high_idx2 = 0
    low1 = math.inf
    low2 = math.inf
    low_idx1 = 0
    low_idx2 = 0
    for i in range(2, 18):
        if recent_candles[i]['high'] > recent_candles[i - 1]['high'] and recent_candles[i]['high'] > recent_candles[i + 1]['high']:
            if recent_candles[i]['high'] > p1:
                p2 = p1
                high_idx2 = high_idx1
                p1 = recent_candles[i]['high']
                high_idx1 = i
            elif recent_candles[i]['high'] > p2:
                p2 = recent_candles[i]['high']
                high_idx2 = i
        if recent_candles[i]['low'] < recent_candles[i - 1]['low'] and recent_candles[i]['low'] < recent_candles[i + 1]['low']:
            if recent_candles[i]['low'] < low1:
                low2 = low1
                low_idx2 = low_idx1
                low1 = recent_candles[i]['low']
                low_idx1 = i
            elif recent_candles[i]['low'] < low2:
                low2 = recent_candles[i]['low']
                low_idx2 = i
    if high_idx1 > high_idx2 and p1 > p2 and recent_rsi[high_idx1] < recent_rsi[high_idx2]:
        return 'BEARISH'
    if low_idx1 > low_idx2 and low1 < low2 and recent_rsi[low_idx1] > recent_rsi[low_idx2]:
        return 'BULLISH'
    return 'NENHUMA'


def detectar_compressao_volatilidade(candles):
    if len(candles) < 20:
        return None
    recent_20 = candles[-20:]
    recent_5 = candles[-5:]
    prev_5 = candles[-10:-5]
    recent_3 = candles[-3:]
    recent_10 = candles[-10:]
    closes_20 = [c['close'] for c in recent_20]
    closes_5 = [c['close'] for c in recent_5]
    closes_prev5 = [c['close'] for c in prev_5]
    atr_20 = calcular_atr(recent_20, 20)
    atr_5 = calcular_atr(recent_5, 5)
    if not atr_20 or not atr_5:
        return None
    pct_atr = (atr_5 / atr_20) * 100
    boll_5 = calcular_bollinger(closes_5, 5)
    boll_prev5 = calcular_bollinger(closes_prev5, 5)
    is_bollinger_squeezing = False
    if boll_5 and boll_prev5:
        spread_5 = boll_5['upper'] - boll_5['lower']
        spread_prev5 = boll_prev5['upper'] - boll_prev5['lower']
        is_bollinger_squeezing = spread_5 < spread_prev5
    restrict_atr = pct_atr < 70
    compressao_detectada = restrict_atr and is_bollinger_squeezing
    if pct_atr < 55:
        nivel_compressao = "SEVERA"
    elif 55 <= pct_atr < 70:
        nivel_compressao = "MODERADA"
    elif 70 <= pct_atr <= 85:
        nivel_compressao = "LEVE"
    else:
        nivel_compressao = "NENHUMA"
    vol_medio_3 = sum(c['volume'] for c in recent_3) / 3
    vol_medio_10 = sum(c['volume'] for c in recent_10) / 10
    volume_decrescente = vol_medio_3 < vol_medio_10
    probabilidade_rompimento = max(0, min(100, 100 - pct_atr))
    return {
        'compressao_detectada': compressao_detectada,
        'nivel_compressao': nivel_compressao,
        'volume_decrescente': volume_decrescente,
        'probabilidade_rompimento': probabilidade_rompimento
    }
