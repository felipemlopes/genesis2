<?php

namespace App\Services;

class ContextBuilderService
{
    private const INDICADORES_CONHECIDOS = [
        'fibonacci' => [
            0.236 => 'Retracao leve (23.6%). Suporte/resistencia fraco. Preco tende a continuar o movimento.',
            0.382 => 'Retracao moderada (38.2%). Zona de pullback saudavel em tendencia forte.',
            0.500 => 'Retracao media (50%). Zona psicologica importante. Reacao frequente.',
            0.618 => 'Retracao dourada (61.8%). Zona de maior probabilidade de reacao. Stop abaixo/acima invalida a estrutura.',
            0.786 => 'Retracao profunda (78.6%). Ultimo suporte/resistencia antes de invalidacao da estrutura.',
            1.000 => 'Nivel de origem. Rompimento aqui invalida a estrutura anterior.',
            1.272 => 'Extensao 127.2%. Primeiro alvo de extensao pos-rompimento.',
            1.618 => 'Extensao dourada (161.8%). Alvo principal de extensao. Alta probabilidade de reacao.',
        ],
        'estocastico' => [
            ['min' => 0,  'max' => 20,  'leitura' => 'Sobrevenda extrema. Possivel reversao ou repique tecnico.'],
            ['min' => 20, 'max' => 40,  'leitura' => 'Zona de sobrevenda. Pressao vendedora dominante.'],
            ['min' => 40, 'max' => 60,  'leitura' => 'Zona neutra. Sem vies definido.'],
            ['min' => 60, 'max' => 80,  'leitura' => 'Zona bullish. Momentum comprador ativo.'],
            ['min' => 80, 'max' => 100, 'leitura' => 'Sobrecompra. Risco de correcao ou realizacao.'],
        ],
        'order_blocks' => [
            'bullish' => 'Order Block bullish detectado. Zona de interesse institucional compradora. Alta probabilidade de reacao ao reteste.',
            'bearish' => 'Order Block bearish detectado. Zona de interesse institucional vendedora. Alta probabilidade de rejeicao.',
        ],
        'fair_value_gap' => [
            'bullish' => 'Fair Value Gap bullish. Zona de ineficiencia de preco. Mercado tende a preencher antes de continuar.',
            'bearish' => 'Fair Value Gap bearish. Zona de ineficiencia acima. Possivel alvo de repique antes de queda.',
        ],
        'vwap' => [
            'acima'  => 'Preco acima do VWAP. Compradores no controle intraday.',
            'abaixo' => 'Preco abaixo do VWAP. Vendedores no controle intraday.',
        ],
        'bollinger_ocr' => [
            'toque_superior' => 'Preco tocando banda superior. Sobrecompra de curto prazo. Risco de reversao.',
            'toque_inferior' => 'Preco tocando banda inferior. Sobrevenda de curto prazo. Possivel repique.',
            'dentro'         => 'Preco dentro das bandas. Movimento normal sem sinal extremo.',
        ],
        'elliott_wave' => [
            'onda_3'      => 'Onda 3 em andamento. Movimento mais forte e longo. Alta probabilidade de continuacao.',
            'onda_5'      => 'Possivel Onda 5 final. Movimento de exaustao. Vigilancia para reversao.',
            'correcao_abc' => 'Correcao ABC. Movimento contratendencia. Aguardar conclusao para retomar direcao principal.',
        ],
        'ichimoku' => [
            'acima_nuvem'  => 'Preco acima da nuvem Ichimoku. Tendencia de alta confirmada.',
            'abaixo_nuvem' => 'Preco abaixo da nuvem Ichimoku. Tendencia de baixa confirmada.',
            'dentro_nuvem' => 'Preco dentro da nuvem. Zona de indecisao. Aguardar rompimento.',
        ],
    ];

    public function build(
        array $ind,
        array $der,
        array $macro,
        array $score,
        array $zonas,
        array $volume = [],
        array $wyckoff = [],
        array $elementosVisuais = []
    ): string {
        $preco = $ind['preco'] ?? 0;
        $ctx = "LEITURA TECNICA UNIFICADA — DADOS CALCULADOS VIA API (VERDADE ABSOLUTA)\n\n";

        $ctx .= $this->lerEstruturaEMAs($ind, $preco);
        $ctx .= $this->lerRSI($ind);
        $ctx .= $this->lerADX($ind);
        $ctx .= $this->lerMACD($ind);
        $ctx .= $this->lerVolume($volume);
        $ctx .= $this->lerVRVP($zonas, $preco);
        $ctx .= $this->lerBollinger($ind, $preco);
        $ctx .= $this->lerDerivativos($der);
        $ctx .= $this->lerWyckoff($wyckoff);
        $ctx .= $this->lerIndicadoresOCR($elementosVisuais, $preco);
        $ctx .= $this->lerPadroesGraficos($elementosVisuais);

        $ctx .= "\nZONAS ESTRUTURAIS:\n";
        if (!empty($zonas['pdh'])) $ctx .= "PDH={$zonas['pdh']} | PDL={$zonas['pdl']} | PWH={$zonas['pwh']} | PWL={$zonas['pwl']}\n";

        $ctx .= "\nSCORE: {$score['scoreFinal']}/100 | Vies={$score['vies']} | Confiabilidade={$score['confiabilidade']}\n";
        $ctx .= "Tecnico={$score['blocoTecnico']['percentual']}% | Derivativos={$score['blocoDerivativos']['percentual']}%\n";
        if (!empty($score['flags'])) $ctx .= "Flags: " . implode(', ', $score['flags']) . "\n";

        $ctx .= "\nMACRO: VIX=" . ($macro['vix'] ?? 'N/A') . " | DXY=" . ($macro['dxy_variacao'] ?? 0) . "% | SP500=" . ($macro['sp500_variacao'] ?? 0) . "%\n";

        return $ctx;
    }

    private function lerEstruturaEMAs(array $ind, float $preco): string
    {
        $r = "\nESTRUTURA DE PRECO vs EMAs:\n";
        $emas = [];
        $acima = 0;

        foreach (['ema21' => 'EMA21', 'ema50' => 'EMA50', 'ema200' => 'EMA200'] as $k => $label) {
            if (empty($ind[$k])) continue;
            $v   = $ind[$k];
            $sub = $ind[$k . '_subindo'] ?? false;
            $rel = $preco > $v ? 'acima' : 'abaixo';
            $dir = $sub ? 'subindo' : 'caindo';
            if ($preco > $v) $acima++;
            $emas[] = "{$label}={$v} ({$dir}) preco {$rel}";
        }

        if (!empty($emas)) $r .= implode(' | ', $emas) . "\n";

        if ($acima === 3)     $r .= "Estrutura: BULLISH CONFIRMADA — preco acima das 3 EMAs subindo.\n";
        elseif ($acima === 0) $r .= "Estrutura: BEARISH CONFIRMADA — preco abaixo das 3 EMAs caindo.\n";
        else                  $r .= "Estrutura: INDEFINIDA — preco entre EMAs, aguardar confirmacao.\n";

        if (!empty($ind['ema50']) && !empty($ind['ema200'])) {
            if ($ind['ema50'] > $ind['ema200'] && ($ind['ema50_subindo'] ?? false))
                $r .= "Golden Cross EMA50/EMA200 ativo — tendencia de alta de medio prazo.\n";
            if ($ind['ema50'] < $ind['ema200'] && !($ind['ema50_subindo'] ?? true))
                $r .= "Death Cross EMA50/EMA200 ativo — tendencia de baixa de medio prazo.\n";
        }

        return $r;
    }

    private function lerRSI(array $ind): string
    {
        $r = "RSI (14): ";
        if (empty($ind['rsi'])) return $r . "INDISPONIVEL\n";

        $rsi = (float) $ind['rsi'];
        $r  .= $rsi;

        if ($rsi < 20)      $r .= ' — SOBREVENDA EXTREMA. Capitulacao possivel. Repique tecnico iminente mas nao e reversao confirmada.';
        elseif ($rsi < 30)  $r .= ' — Sobrevenda. Exaustao vendedora possivel. Aguardar confirmacao antes de entrar.';
        elseif ($rsi < 45)  $r .= ' — Zona neutra baixa. Leve vies de baixa.';
        elseif ($rsi <= 55) $r .= ' — Zona neutra. Sem vies definido.';
        elseif ($rsi <= 70) $r .= ' — Zona bullish saudavel. Momentum comprador ativo.';
        elseif ($rsi <= 80) $r .= ' — Sobrecompra. Risco de correcao ou realizacao.';
        else                $r .= ' — SOBRECOMPRA EXTREMA. Alta possivelmente esgotando.';

        if (!empty($ind['divergencia_rsi']) && $ind['divergencia_rsi'] !== 'NENHUMA')
            $r .= ' | Divergencia RSI: ' . $ind['divergencia_rsi'];

        return $r . "\n";
    }

    private function lerADX(array $ind): string
    {
        $r = "ADX: ";
        if (empty($ind['adx'])) return $r . "INDISPONIVEL\n";

        $adx = (float) $ind['adx'];
        $dip = (float) ($ind['plus_di']  ?? 0);
        $dim = (float) ($ind['minus_di'] ?? 0);
        $r  .= "{$adx} | +DI={$dip} | -DI={$dim}";

        if ($adx >= 30 && $dip > $dim)      $r .= ' — Tendencia de ALTA forte. +DI dominante.';
        elseif ($adx >= 30 && $dim > $dip)  $r .= ' — Tendencia de BAIXA forte. -DI dominante.';
        elseif ($adx >= 25 && $dip > $dim)  $r .= ' — Tendencia de alta moderada. +DI no controle.';
        elseif ($adx >= 25 && $dim > $dip)  $r .= ' — Tendencia de baixa moderada. -DI no controle.';
        elseif ($adx >= 20 && $dip > $dim)  $r .= ' — Tendencia nascente de alta. Monitorar confirmacao.';
        elseif ($adx >= 20 && $dim > $dip)  $r .= ' — Tendencia nascente de baixa. Monitorar confirmacao.';
        else                                 $r .= ' — Mercado sem tendencia definida (ranging). Sinais de menor confiabilidade.';

        return $r . "\n";
    }

    private function lerMACD(array $ind): string
    {
        $r = "MACD: ";
        if (empty($ind['macd'])) return $r . "INDISPONIVEL\n";

        $macd = (float) $ind['macd'];
        $sig  = (float) ($ind['macd_signal']    ?? 0);
        $hist = (float) ($ind['macd_histograma'] ?? 0);
        $r   .= "MACD={$macd} | Signal={$sig} | Histograma={$hist}";

        if ($macd > 0 && $hist > 0)        $r .= ' — Acima do zero, histograma positivo. Momentum BULLISH.';
        elseif ($macd < 0 && $hist < 0)    $r .= ' — Abaixo do zero, histograma negativo. Momentum BEARISH.';
        elseif ($macd > $sig && $hist > 0) $r .= ' — Cruzou signal para cima. Sinal de compra tecnico.';
        elseif ($macd < $sig && $hist < 0) $r .= ' — Cruzou signal para baixo. Sinal de venda tecnico.';
        elseif ($macd > 0 && $hist < 0)    $r .= ' — Acima do zero mas histograma contraindo. Momentum enfraquecendo.';
        elseif ($macd < 0 && $hist > 0)    $r .= ' — Abaixo do zero mas histograma expandindo. Possivel reversao.';

        if (!empty($ind['macd_cruza_zero']))
            $r .= ' | CRUZAMENTO LINHA ZERO: ' . $ind['macd_cruza_zero'];

        return $r . "\n";
    }

    private function lerVolume(array $vol): string
    {
        if (empty($vol) || ($vol['tendencia'] ?? '') === 'INDISPONIVEL')
            return "VOLUME: INDISPONIVEL\n";

        $r = "VOLUME: Tendencia=" . $vol['tendencia'] . " | Ratio atual/media=" . $vol['ratio_atual'] . "x";

        if ($vol['divergencia'] === 'PRECO_SOBE_VOLUME_CAI')
            $r .= ' | DIVERGENCIA: Alta sem volume — rally fraco, possivel reversao iminente.';
        elseif ($vol['divergencia'] === 'CONFIRMACAO_BAIXA')
            $r .= ' | CONFIRMACAO: Queda com volume crescente — distribuicao real, tendencia de baixa com forca.';
        elseif ($vol['divergencia'] === 'CONFIRMACAO_ALTA')
            $r .= ' | CONFIRMACAO: Alta com volume crescente — tendencia de alta com forca.';
        elseif ($vol['divergencia'] === 'PRECO_CAI_VOLUME_CAI')
            $r .= ' | Queda com volume fraco — correcao sem convicção, possivel recuperacao.';

        return $r . "\n";
    }

    private function lerVRVP(array $zonas, float $preco): string
    {
        $poc = $zonas['poc'] ?? 0;
        if ($poc <= 0) return "VRVP: INDISPONIVEL\n";

        $rel = $preco > $poc ? 'acima do POC' : 'abaixo do POC';
        $r   = "VRVP: POC={$poc} — preco {$rel}.";

        $hvn = $zonas['hvn'] ?? [];
        $lvn = $zonas['lvn'] ?? [];

        $hvnAcima  = array_filter($hvn, fn($h) => $h > $preco);
        $hvnAbaixo = array_filter($hvn, fn($h) => $h < $preco);
        $lvnAcima  = array_filter($lvn, fn($l) => $l > $preco);
        $lvnAbaixo = array_filter($lvn, fn($l) => $l < $preco);

        if (!empty($hvnAcima))  $r .= ' HVN (resistencia) imediata em ' . min($hvnAcima) . '.';
        if (!empty($hvnAbaixo)) $r .= ' HVN (suporte) imediato em ' . max($hvnAbaixo) . '.';
        if (!empty($lvnAcima))  $r .= ' LVN (zona de passagem rapida) acima em ' . min($lvnAcima) . '.';
        if (!empty($lvnAbaixo)) $r .= ' LVN abaixo em ' . max($lvnAbaixo) . '.';

        return $r . "\n";
    }

    private function lerBollinger(array $ind, float $preco): string
    {
        if (empty($ind['bollinger'])) return '';

        $b   = $ind['bollinger'];
        $sup = $b['banda_superior'] ?? 0;
        $inf = $b['banda_inferior'] ?? 0;
        $med = $b['banda_media']    ?? 0;

        $r = "BOLLINGER: Superior={$sup} | Media={$med} | Inferior={$inf}";

        if ($preco >= $sup * 0.998)  $r .= ' — Preco tocando banda superior. Sobrecompra de curto prazo.';
        elseif ($preco <= $inf * 1.002) $r .= ' — Preco tocando banda inferior. Sobrevenda de curto prazo.';
        else                          $r .= ' — Preco dentro das bandas. Movimento normal.';

        if (!empty($ind['compressao']['detectada'])) {
            $nivel = $ind['compressao']['nivel'] ?? '';
            $r .= " | COMPRESSAO {$nivel}: bandas se fechando. Rompimento explosivo iminente.";
        }

        return $r . "\n";
    }

    private function lerDerivativos(array $der): string
    {
        $r = "\nDERIVATIVOS:\n";

        if (!empty($der['funding_rate'])) {
            $fr = (float) $der['funding_rate'];
            $r .= 'Funding Rate=' . $der['funding_rate'];
            if ($fr > 0.05)      $r .= ' — EXTREMO POSITIVO. Long squeeze iminente.';
            elseif ($fr > 0.03)  $r .= ' — Alto. Mercado sobrecarregado em LONG.';
            elseif ($fr < -0.03) $r .= ' — NEGATIVO EXTREMO. Short squeeze iminente.';
            elseif ($fr < -0.01) $r .= ' — Negativo. Pressao vendedora via funding.';
            else                 $r .= ' — Neutro.';
            $r .= "\n";
        }

        if (!empty($der['oi_variacao'])) {
            $oi = (float) $der['oi_variacao'];
            $r .= 'OI Variacao=' . $oi . '% — ' . ($oi > 0 ? 'posicoes abrindo.' : 'posicoes fechando.') . "\n";
        }

        if (!empty($der['cvd']['delta'])) {
            $cvd = (float) $der['cvd']['delta'];
            $r .= 'CVD Delta=' . $cvd . ' — ' . ($cvd > 0 ? 'pressao compradora dominando.' : 'pressao vendedora dominando.') . "\n";
        }

        if (!empty($der['long_short_ratio'])) {
            $ls = (float) $der['long_short_ratio'];
            $r .= 'L/S Ratio=' . $ls;
            if ($ls > 0.60)     $r .= ' — Mercado overlong. Risco de liquidacao de longs.';
            elseif ($ls < 0.40) $r .= ' — Mercado overshort. Risco de short squeeze.';
            else                $r .= ' — Posicionamento equilibrado.';
            $r .= "\n";
        }

        return $r;
    }

    private function lerWyckoff(array $wyckoff): string
    {
        if (empty($wyckoff['fase']) || $wyckoff['fase'] === 'INDETERMINADO') return '';

        return "\nWYCKOFF: Fase=" . $wyckoff['fase']
            . " | Evento=" . ($wyckoff['evento'] ?? 'N/A')
            . " | Gatilho=" . ($wyckoff['gatilho'] ?? 'N/A')
            . "\nNarrativa: " . ($wyckoff['narrativa'] ?? '') . "\n";
    }

    private function lerPadroesGraficos(array $elementosVisuais): string
    {
        $padroes = $elementosVisuais['padroes_graficos'] ?? [];
        if (empty($padroes)) return '';

        return "\nPADROES GRAFICOS VIA OCR: " . implode(', ', $padroes)
            . "\nINSTRUCAO: Citar apenas se confirmado por min 2 indicadores acima. Nunca inventar.\n";
    }

    private function lerIndicadoresOCR(array $elementosVisuais, float $preco): string
    {
        $resultado    = '';
        $desconhecidos = [];

        // Fibonacci via OCR
        if (!empty($elementosVisuais['fibonacci'])) {
            $resultado .= "\nFIBONACCI VIA OCR:\n";
            foreach ($elementosVisuais['fibonacci'] as $nivel) {
                $rel   = $preco > $nivel ? 'acima' : ($preco < $nivel ? 'abaixo' : 'tocando');
                $dist  = $preco > 0 ? round(abs($preco - $nivel) / $preco * 100, 2) : 0;
                $interp = $this->interpretarIndicadorOCR('fibonacci', $nivel, $preco);
                $resultado .= "  Nivel {$nivel} — preco {$rel} ({$dist}%). {$interp}\n";
            }
        }

        // Suportes desenhados manualmente
        if (!empty($elementosVisuais['suportes'])) {
            $resultado .= "\nSUPORTES DESENHADOS: ";
            foreach ($elementosVisuais['suportes'] as $s) {
                $dist = $preco > 0 ? round(abs($preco - $s) / $preco * 100, 2) : 0;
                $rel  = $preco > $s ? 'abaixo do preco' : 'acima do preco';
                $resultado .= "{$s} ({$rel}, {$dist}%) | ";
            }
            $resultado .= "\n";
        }

        // Resistencias desenhadas manualmente
        if (!empty($elementosVisuais['resistencias'])) {
            $resultado .= "RESISTENCIAS DESENHADAS: ";
            foreach ($elementosVisuais['resistencias'] as $r) {
                $dist = $preco > 0 ? round(abs($preco - $r) / $preco * 100, 2) : 0;
                $rel  = $preco < $r ? 'acima do preco' : 'abaixo do preco';
                $resultado .= "{$r} ({$rel}, {$dist}%) | ";
            }
            $resultado .= "\n";
        }

        // Indicadores visiveis no grafico via OCR
        if (!empty($elementosVisuais['indicadores_visiveis'])) {
            foreach ($elementosVisuais['indicadores_visiveis'] as $ind) {
                $nome  = is_array($ind) ? ($ind['nome'] ?? $ind[0] ?? '') : (string) $ind;
                $valor = is_array($ind) ? ($ind['valor'] ?? '') : '';
                $interp = $this->interpretarIndicadorOCR($nome, $valor, $preco);
                if (str_starts_with($interp, 'INDICADOR_EXTERNO')) {
                    $desconhecidos[] = $interp;
                } else {
                    $resultado .= "\n" . strtoupper($nome) . " (OCR): {$interp}\n";
                }
            }
        }

        // Indicadores desconhecidos — passa ao Gemini
        if (!empty($desconhecidos)) {
            $resultado .= "\nINDICADORES ADICIONAIS (interpretar no contexto da analise completa):\n";
            foreach ($desconhecidos as $d) $resultado .= "  - {$d}\n";
        }

        return $resultado;
    }

    private function interpretarIndicadorOCR(string $nome, $valor, float $preco): string
    {
        $nomeNorm = strtolower(str_replace([' ', '-'], '_', $nome));

        // FIBONACCI
        if (str_contains($nomeNorm, 'fib') && is_numeric($valor)) {
            $niveis = self::INDICADORES_CONHECIDOS['fibonacci'];
            foreach ($niveis as $pct => $leitura) {
                if (abs((float) $valor - $pct) < 0.01) return "Fibonacci {$pct}: {$leitura}";
            }
            $rel = $preco > (float) $valor ? 'acima' : 'abaixo';
            return "Nivel Fibonacci {$valor} — preco {$rel}.";
        }

        // ESTOCASTICO
        if (str_contains($nomeNorm, 'estoc') || str_contains($nomeNorm, 'stoch')) {
            $val = (float) $valor;
            foreach (self::INDICADORES_CONHECIDOS['estocastico'] as $f) {
                if ($val >= $f['min'] && $val <= $f['max']) return "Estocastico {$val}: " . $f['leitura'];
            }
        }

        // ORDER BLOCKS
        if (str_contains($nomeNorm, 'order_block') || str_contains($nomeNorm, 'ob_')) {
            $tipo = str_contains(strtolower((string) $valor), 'bull') ? 'bullish' : 'bearish';
            return self::INDICADORES_CONHECIDOS['order_blocks'][$tipo];
        }

        // FAIR VALUE GAP
        if (str_contains($nomeNorm, 'fvg') || str_contains($nomeNorm, 'fair_value')) {
            $tipo = str_contains(strtolower((string) $valor), 'bull') ? 'bullish' : 'bearish';
            return self::INDICADORES_CONHECIDOS['fair_value_gap'][$tipo];
        }

        // VWAP
        if (str_contains($nomeNorm, 'vwap') && is_numeric($valor)) {
            $tipo = $preco > (float) $valor ? 'acima' : 'abaixo';
            return self::INDICADORES_CONHECIDOS['vwap'][$tipo];
        }

        // ICHIMOKU
        if (str_contains($nomeNorm, 'ichimoku') || str_contains($nomeNorm, 'kumo')) {
            $valStr = strtolower((string) $valor);
            $tipo = str_contains($valStr, 'acima') ? 'acima_nuvem'
                : (str_contains($valStr, 'abaixo') ? 'abaixo_nuvem' : 'dentro_nuvem');
            return self::INDICADORES_CONHECIDOS['ichimoku'][$tipo];
        }

        // BOLLINGER OCR
        if (str_contains($nomeNorm, 'bollinger') || str_contains($nomeNorm, 'bb_')) {
            $valStr = strtolower((string) $valor);
            $tipo = str_contains($valStr, 'superior') ? 'toque_superior'
                : (str_contains($valStr, 'inferior') ? 'toque_inferior' : 'dentro');
            return self::INDICADORES_CONHECIDOS['bollinger_ocr'][$tipo];
        }

        // DESCONHECIDO — passa ao Gemini
        return 'INDICADOR_EXTERNO: ' . $nome . ' = ' . $valor . ' (interpretar no contexto da analise)';
    }
}
