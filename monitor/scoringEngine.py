def calcular_score(dados):
    is_technical_present = dados.get('ema200') is not None or dados.get('rsi') is not None or dados.get('adx') is not None

    pontos_bullish = 0
    pontos_bearish = 0
    flags = []

    # BLOCO TECNICO (Max 35)
    tc_bullish = 0
    tc_bearish = 0

    if is_technical_present:
        preco = dados.get('preco')
        ema200 = dados.get('ema200')

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

        div_rsi = dados.get('divergencia_rsi')
        if div_rsi == 'BULLISH':
            tc_bullish += 3
        elif div_rsi == 'BEARISH':
            tc_bearish += 3

        adx = dados.get('adx')
        if adx is not None:
            if adx > 25 and dados.get('preco_subindo'):
                tc_bullish += 6
            elif adx > 25 and not dados.get('preco_subindo'):
                tc_bearish += 6
            elif adx < 20:
                tc_bullish += 1
                tc_bearish += 1
                flags.append('RANGING_SEM_TENDENCIA')

        macd_acima_signal = dados.get('macd_acima_signal')
        if macd_acima_signal is not None:
            if macd_acima_signal and dados.get('histograma_subindo'):
                tc_bullish += 7
            elif not macd_acima_signal and not dados.get('histograma_subindo'):
                tc_bearish += 7

        if dados.get('compressao_detectada'):
            nivel = dados.get('nivel_compressao')
            if nivel == 'SEVERA':
                flags.append('ROMPIMENTO_IMINENTE')
            tc_bullish += 2
            tc_bearish += 2
        else:
            if dados.get('preco_subindo'):
                tc_bullish += 7
            else:
                tc_bearish += 7

    # BLOCO DERIVATIVOS (Max 35)
    dr_bullish = 0
    dr_bearish = 0

    cvd_slope = dados.get('cvd_slope')
    if cvd_slope is not None:
        if cvd_slope > 0 and dados.get('preco_subindo'):
            dr_bullish += 10
        elif cvd_slope < 0 and not dados.get('preco_subindo'):
            dr_bearish += 10

    book_ratio = dados.get('book_imbalance_ratio')
    if book_ratio is not None:
        if book_ratio > 0.35:
            dr_bullish += 5
            flags.append('PRESSAO_COMPRADORA_BOOK')
        elif book_ratio < -0.35:
            dr_bearish += 5
            flags.append('PRESSAO_VENDEDORA_BOOK')

    div_cvd = dados.get('divergencia_cvd')
    if div_cvd == 'BEARISH':
        dr_bearish += 10
        flags.append('CVD_DIVERGENCIA_BEARISH')
    elif div_cvd == 'BULLISH':
        dr_bullish += 10
        flags.append('CVD_DIVERGENCIA_BULLISH')

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

    oi_subindo = dados.get('oi_subindo')
    preco_subindo = dados.get('preco_subindo')
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

    cluster_acima = dados.get('cluster_liquidacao_acima')
    preco = dados.get('preco')
    if cluster_acima is not None and preco:
        if abs(cluster_acima - preco) / preco < 0.01:
            dr_bearish += 2
            flags.append('CLUSTER_ACIMA')

    cluster_abaixo = dados.get('cluster_liquidacao_abaixo')
    if cluster_abaixo is not None and preco:
        if abs(preco - cluster_abaixo) / preco < 0.01:
            dr_bullish += 2
            flags.append('CLUSTER_ABAIXO')

    dr_bullish = dr_bullish * (35 / 40)
    dr_bearish = dr_bearish * (35 / 40)

    # BLOCO MACRO (Max 20)
    mc_bullish = 0
    mc_bearish = 0

    vix = dados.get('vix')
    if vix is not None:
        if vix < 15:
            mc_bullish += 6
        elif 15 <= vix < 20:
            mc_bullish += 2
            mc_bearish += 2
        elif 20 <= vix < 25:
            mc_bearish += 2
        elif 25 <= vix <= 30:
            mc_bearish += 4
            flags.append('VIX_ELEVADO')
        elif vix > 30:
            mc_bearish += 6
            flags.append('VIX_CRITICO')

    dxy_var = dados.get('dxy_variacao')
    if dxy_var is not None:
        if dxy_var < -0.3:
            mc_bullish += 6
        elif -0.3 <= dxy_var <= 0.3:
            mc_bullish += 1.5
            mc_bearish += 1.5
        elif 0.3 < dxy_var <= 0.7:
            mc_bearish += 4
        elif dxy_var > 0.7:
            mc_bearish += 6
            flags.append('DXY_FORTE')

    sp500_var = dados.get('sp500_variacao')
    if sp500_var is not None:
        if sp500_var > 0.5:
            mc_bullish += 4
        elif -0.5 <= sp500_var <= 0.5:
            mc_bullish += 1
            mc_bearish += 1
        elif sp500_var < -0.5:
            mc_bearish += 4

    btc_dom_var = dados.get('btc_dominancia_variacao')
    if btc_dom_var is not None:
        if btc_dom_var > 0:
            mc_bearish += 4
        elif btc_dom_var < 0:
            mc_bullish += 4

    usdt_dom_var = dados.get('usdt_dominancia_variacao')
    if usdt_dom_var is not None and usdt_dom_var > 0.2:
        mc_bearish += 4
        flags.append('SAIDA_DO_MERCADO')

    correlacao = dados.get('correlacao_btc')
    if correlacao and correlacao.get('descorrelacao_detectada'):
        tipo = correlacao.get('tipo_descorrelacao')
        if tipo == 'FORCA_RELATIVA':
            mc_bullish += 8
            flags.append('ACUMULACAO_INSTITUCIONAL')
        elif tipo == 'FRAQUEZA_RELATIVA':
            mc_bearish += 8
            flags.append('DISTRIBUICAO_INSTITUCIONAL')

    mc_bullish = mc_bullish * (20 / 28)
    mc_bearish = mc_bearish * (20 / 28)

    # BLOCO SENTIMENTO (Max 10)
    st_bullish = 0
    st_bearish = 0

    fear_greed = dados.get('fear_greed')
    if fear_greed is not None:
        if fear_greed > 80:
            st_bearish += 4
            flags.append('EUFORIA_EXTREMA')
        elif 60 <= fear_greed <= 80:
            st_bullish += 2
            flags.append('CAUTELA_Euforia')
        elif 40 <= fear_greed < 60:
            st_bullish += 1
            st_bearish += 1
        elif 20 <= fear_greed < 40:
            st_bullish += 2
        elif fear_greed < 20:
            st_bullish += 4
            flags.append('PANICO_EXTREMO_OPORTUNIDADE')

    geo_score = dados.get('geopolitica_score')
    if geo_score == 3:
        st_bullish += 3
    elif geo_score == -3:
        st_bearish += 3

    sent_moeda = dados.get('sentimento_moeda_score')
    if sent_moeda == 3:
        st_bullish += 3
    elif sent_moeda == -3:
        st_bearish += 3

    pontos_bullish = tc_bullish + dr_bullish + mc_bullish + st_bullish
    pontos_bearish = tc_bearish + dr_bearish + mc_bearish + st_bearish

    max_points = 100 if is_technical_present else 65

    final_bullish = pontos_bullish
    final_bearish = pontos_bearish

    if not is_technical_present:
        final_bullish = (pontos_bullish / 65) * 100
        final_bearish = (pontos_bearish / 65) * 100

    score_final = 50
    if final_bullish > final_bearish:
        score_final = min(50 + ((final_bullish - final_bearish) / 2), 100)
    elif final_bearish > final_bullish:
        score_final = max(50 - ((final_bearish - final_bullish) / 2), 0)

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
        'score_final': round(score_final),
        'vies': vies,
        'bloco_tecnico': {
            'pontos': max(tc_bullish, tc_bearish),
            'maximo': 35,
            'percentual': min((max(tc_bullish, tc_bearish) / 35) * 100, 100)
        },
        'bloco_derivativos': {
            'pontos': max(dr_bullish, dr_bearish),
            'maximo': 35,
            'percentual': min((max(dr_bullish, dr_bearish) / 35) * 100, 100)
        },
        'bloco_macro': {
            'pontos': max(mc_bullish, mc_bearish),
            'maximo': 20,
            'percentual': min((max(mc_bullish, mc_bearish) / 20) * 100, 100)
        },
        'bloco_sentimento': {
            'pontos': max(st_bullish, st_bearish),
            'maximo': 10,
            'percentual': min((max(st_bullish, st_bearish) / 10) * 100, 100)
        },
        'flags': list(set(flags)),
        'confiabilidade': confiabilidade
    }
