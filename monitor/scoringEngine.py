def calcular_score(dados):
    """
    Calcula score final composto por:
    - Bloco Técnico (máximo 55 pontos)
    - Bloco Derivativos (máximo 45 pontos)

    Macro e Sentimento geram apenas flags informativas, não pontuam.
    Score final arredondado para múltiplo de 5, range [0, 100].
    """
    flags = []

    # =========================================================================
    # BLOCO TÉCNICO (Max 55 pontos)
    # Componentes: EMA200, RSI, Divergência RSI, ADX proporcional,
    #              MACD signal, MACD zero cross, Compressão/Volatilidade
    # =========================================================================
    tc_bullish = 0
    tc_bearish = 0

    preco = dados.get('preco')
    ema200 = dados.get('ema200')

    # EMA200 (max 8pts)
    if preco and ema200:
        dist = abs(preco - ema200) / ema200
        if dist < 0.003:
            tc_bullish += 1
            tc_bearish += 1
        elif preco > ema200:
            if dados.get('ema200_subindo'):
                tc_bullish += 8
            else:
                tc_bullish += 5
        else:
            if not dados.get('ema200_subindo'):
                tc_bearish += 8
            else:
                tc_bearish += 5

    # RSI (max 7pts)
    rsi = dados.get('rsi')
    if rsi is not None:
        if 50 <= rsi <= 65:
            tc_bullish += 7
        elif 35 <= rsi < 50:
            tc_bearish += 7
        elif rsi > 70:
            tc_bearish += 3
        elif rsi < 30:
            tc_bullish += 3

    # Divergência RSI (max 3pts)
    div_rsi = dados.get('divergencia_rsi')
    if div_rsi == 'BULLISH':
        tc_bullish += 3
    elif div_rsi == 'BEARISH':
        tc_bearish += 3

    # ADX proporcional (max 8pts) — Melhoria 3: sem zona morta
    adx = dados.get('adx')
    preco_subindo = dados.get('preco_subindo')
    if adx is not None:
        if adx >= 30:
            adx_pts = 8
        elif adx >= 25:
            adx_pts = 5
        elif adx >= 20:
            adx_pts = 3
        else:
            adx_pts = 1
            flags.append('RANGING_SEM_TENDENCIA')

        if adx < 20:
            # Neutro — distribui igualmente
            tc_bullish += adx_pts
            tc_bearish += adx_pts
        elif preco_subindo:
            tc_bullish += adx_pts
        else:
            tc_bearish += adx_pts

    # MACD signal (max 7pts)
    macd_acima_signal = dados.get('macd_acima_signal')
    if macd_acima_signal is not None:
        if macd_acima_signal and dados.get('histograma_subindo'):
            tc_bullish += 7
        elif not macd_acima_signal and not dados.get('histograma_subindo'):
            tc_bearish += 7

    # MACD zero cross (max 5pts) — Melhoria 4
    macd_cruza_zero = dados.get('macd_cruza_zero')
    if macd_cruza_zero == 'BULLISH':
        tc_bullish += 5
        flags.append('MACD_ZERO_CROSS_BULL')
    elif macd_cruza_zero == 'BEARISH':
        tc_bearish += 5
        flags.append('MACD_ZERO_CROSS_BEAR')

    # Compressão / Volatilidade (max 7pts)
    if dados.get('compressao_detectada'):
        nivel = dados.get('nivel_compressao')
        if nivel == 'SEVERA':
            flags.append('ROMPIMENTO_IMINENTE')
        tc_bullish += 2
        tc_bearish += 2
    else:
        if preco_subindo:
            tc_bullish += 7
        else:
            tc_bearish += 7

    # Cap bloco técnico
    tc_bullish = min(tc_bullish, 55)
    tc_bearish = min(tc_bearish, 55)

    # =========================================================================
    # BLOCO DERIVATIVOS (Max 45 pontos)
    # Componentes: CVD slope, Book Imbalance, Divergência CVD, Funding,
    #              OI, L/S Ratio, Clusters Liquidação
    # =========================================================================
    dr_bullish = 0
    dr_bearish = 0

    # CVD slope (max 10pts)
    cvd_slope = dados.get('cvd_slope')
    if cvd_slope is not None:
        if cvd_slope > 0 and preco_subindo:
            dr_bullish += 10
        elif cvd_slope < 0 and not preco_subindo:
            dr_bearish += 10

    # Book Imbalance (max 5pts)
    book_ratio = dados.get('book_imbalance_ratio')
    if book_ratio is not None:
        if book_ratio > 0.35:
            dr_bullish += 5
            flags.append('PRESSAO_COMPRADORA_BOOK')
        elif book_ratio < -0.35:
            dr_bearish += 5
            flags.append('PRESSAO_VENDEDORA_BOOK')

    # Divergência CVD (max 10pts)
    div_cvd = dados.get('divergencia_cvd')
    if div_cvd == 'BEARISH':
        dr_bearish += 10
        flags.append('CVD_DIVERGENCIA_BEARISH')
    elif div_cvd == 'BULLISH':
        dr_bullish += 10
        flags.append('CVD_DIVERGENCIA_BULLISH')

    # Funding (max 8pts)
    funding = dados.get('funding_medio')
    if funding is not None:
        if -0.01 <= funding <= 0.01:
            dr_bullish += 2
            dr_bearish += 2
        elif funding > 0.05:
            dr_bearish += 8
            flags.append('LONG_SQUEEZE_IMINENTE')
        elif funding > 0.03:
            dr_bearish += 6
        elif funding < -0.03:
            dr_bullish += 8
            flags.append('SHORT_SQUEEZE_IMINENTE')
        elif funding < -0.02:
            dr_bullish += 6

    # OI (max 8pts)
    oi_subindo = dados.get('oi_subindo')
    if oi_subindo is not None and preco_subindo is not None:
        if oi_subindo and preco_subindo:
            dr_bullish += 8
        elif oi_subindo and not preco_subindo:
            dr_bearish += 8
        elif not oi_subindo and preco_subindo:
            dr_bullish += 3
            flags.append('RALLY_FRACO')
        elif not oi_subindo and not preco_subindo:
            dr_bearish += 3
            flags.append('CORRECAO_FRACA')

    # L/S Ratio (max 5pts)
    ls_ratio = dados.get('ls_ratio_longs')
    if ls_ratio is not None:
        if ls_ratio > 0.60:
            dr_bearish += 5
            flags.append('MERCADO_SOBRECOMPRADO')
        elif ls_ratio < 0.40:
            dr_bullish += 5
            flags.append('MERCADO_SOBREVENDIDO')
        elif 0.45 <= ls_ratio <= 0.55:
            dr_bullish += 1
            dr_bearish += 1

    # Clusters Liquidação (max 2pts each side)
    cluster_acima = dados.get('cluster_liquidacao_acima')
    if cluster_acima is not None and preco:
        if abs(cluster_acima - preco) / preco < 0.01:
            dr_bearish += 2
            flags.append('CLUSTER_ACIMA')

    cluster_abaixo = dados.get('cluster_liquidacao_abaixo')
    if cluster_abaixo is not None and preco:
        if abs(preco - cluster_abaixo) / preco < 0.01:
            dr_bullish += 2
            flags.append('CLUSTER_ABAIXO')

    # Cap bloco derivativos
    dr_bullish = min(dr_bullish, 45)
    dr_bearish = min(dr_bearish, 45)

    # =========================================================================
    # FLAGS INFORMATIVAS — Macro e Sentimento (NÃO pontuam)
    # =========================================================================
    fear_greed = dados.get('fear_greed')
    if fear_greed is not None:
        if fear_greed > 80:
            flags.append('EUFORIA_EXTREMA')
        elif fear_greed < 20:
            flags.append('PANICO_EXTREMO_OPORTUNIDADE')

    vix = dados.get('vix')
    if vix is not None:
        if 25 <= vix <= 30:
            flags.append('VIX_ELEVADO')
        elif vix > 30:
            flags.append('VIX_CRITICO')

    usdt_dom_var = dados.get('usdt_dominancia_variacao')
    if usdt_dom_var is not None and usdt_dom_var > 0.2:
        flags.append('SAIDA_DO_MERCADO')

    correlacao = dados.get('correlacao_btc')
    if correlacao and correlacao.get('descorrelacao_detectada'):
        tipo = correlacao.get('tipo_descorrelacao')
        if tipo == 'FORCA_RELATIVA':
            flags.append('ACUMULACAO_INSTITUCIONAL')
        elif tipo == 'FRAQUEZA_RELATIVA':
            flags.append('DISTRIBUICAO_INSTITUCIONAL')

    geo_score = dados.get('geopolitica_score')
    if geo_score is not None:
        if geo_score >= 3:
            flags.append('GEOPOLITICA_BULL')
        elif geo_score <= -3:
            flags.append('GEOPOLITICA_BEAR')

    sent_moeda = dados.get('sentimento_moeda_score')
    if sent_moeda is not None:
        if sent_moeda >= 3:
            flags.append('SENTIMENTO_MOEDA_BULL')
        elif sent_moeda <= -3:
            flags.append('SENTIMENTO_MOEDA_BEAR')

    # =========================================================================
    # CÁLCULO DO SCORE FINAL
    # Score = Bloco Técnico + Bloco Derivativos (max 100)
    # Arredondado para múltiplo de 5
    # =========================================================================
    pontos_bullish = tc_bullish + dr_bullish
    pontos_bearish = tc_bearish + dr_bearish

    score_final = 50
    if pontos_bullish > pontos_bearish:
        score_final = min(50 + ((pontos_bullish - pontos_bearish) / 2), 100)
    elif pontos_bearish > pontos_bullish:
        score_final = max(50 - ((pontos_bearish - pontos_bullish) / 2), 0)

    # Arredondar para múltiplo de 5
    score_final = round(score_final / 5) * 5
    score_final = max(0, min(100, score_final))

    # Viés direcional
    if score_final > 84:
        vies = 'LONG_FORTE'
    elif 70 <= score_final <= 84:
        vies = 'LONG_MODERADO'
    elif 55 <= score_final <= 69:
        vies = 'LONG_LEVE'
    elif 45 <= score_final <= 54:
        vies = 'NEUTRO'
    elif 31 <= score_final <= 44:
        vies = 'SHORT_LEVE'
    elif 16 <= score_final <= 30:
        vies = 'SHORT_MODERADO'
    else:
        vies = 'SHORT_FORTE'

    # Confiabilidade baseada em concordância técnico/derivativos
    tech_dir = 'BULL' if tc_bullish > tc_bearish else 'BEAR'
    deriv_dir = 'BULL' if dr_bullish > dr_bearish else 'BEAR'

    if abs(tc_bullish - tc_bearish) > 5 and abs(dr_bullish - dr_bearish) > 5:
        if tech_dir == deriv_dir:
            confiabilidade = 'ALTA'
        else:
            confiabilidade = 'BAIXA'
    else:
        confiabilidade = 'MEDIA'

    return {
        'score_final': score_final,
        'vies': vies,
        'bloco_tecnico': {
            'pontos': max(tc_bullish, tc_bearish),
            'maximo': 55,
            'percentual': min((max(tc_bullish, tc_bearish) / 55) * 100, 100)
        },
        'bloco_derivativos': {
            'pontos': max(dr_bullish, dr_bearish),
            'maximo': 45,
            'percentual': min((max(dr_bullish, dr_bearish) / 45) * 100, 100)
        },
        'flags': list(set(flags)),
        'confiabilidade': confiabilidade
    }
