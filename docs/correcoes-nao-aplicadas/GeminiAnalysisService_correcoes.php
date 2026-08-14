<?php
/**
 * CORRECOES DO GeminiAnalysisService.php
 * Quatro correcoes. Cada uma indica exatamente onde substituir.
 */

// ============================================================
// CORRECAO 1 — Linha 224: atualizar chamada do contextBuilder.build()
// Adicionar volume, wyckoffResult e elementosVisuais como parametros
// ============================================================
// SUBSTITUIR linha 224 por:
$contexto = $this->contextBuilder->build(
    $indicadores,
    $derivativos,
    $macro,
    $score,
    $zonas,
    $indicadores['volume'] ?? [],
    $wyckoffResult,
    $elementosVisuais
);

// ============================================================
// CORRECAO 2 — Linha 245: atualizar chamada buildPrompt()
// Adicionar $macro, $fearGreedReal, $btcDominanciaReal, $wyckoffResult
// ============================================================
// SUBSTITUIR linha 245 por:
$prompt = $this->buildPrompt(
    $symbol,
    $timeframe,
    $leverage,
    $contexto,
    $entryValue,
    $elementosVisuais,
    $macro,
    $fearGreedReal,
    $btcDominanciaReal,
    $wyckoffResult
);

// ============================================================
// CORRECAO 3 — Linha 333: atualizar chamada gerarNarrativa()
// e capturar os dois campos retornados
// ============================================================
// SUBSTITUIR linha 333 por:
$narrativas              = $this->gerarNarrativa($symbol, $indicadores, $score, $setupMatematico, $wyckoffResult, $derivativos, $elementosVisuais);
$result['narrativa']     = $narrativas['analiseTecnica'];
$result['rationalScore'] = $narrativas['rationalScore'];

// ============================================================
// CORRECAO 4 — Linha 500: substituir buildPrompt() integralmente
// Adiciona instrucao de linguagem, macro, sentimento e padroes graficos
// ============================================================
private function buildPrompt(
    string $symbol,
    string $timeframe,
    int    $leverage,
    string $contexto,
    float  $entryValue      = 0,
    array  $elementosVisuais = [],
    array  $macro            = [],
    int    $fearGreed        = 50,
    float  $btcDominancia    = 0,
    array  $wyckoffResult    = []
): string {
    $entryInfo = '';
    if ($entryValue > 0) {
        $valorTotal = $entryValue * $leverage;
        $entryInfo  = "\nVALOR DE ENTRADA: \${$entryValue} | Alavancagem: {$leverage}x | Total: $" . number_format($valorTotal, 2) . "\n";
    }

    $visuaisInfo = '';
    if (!empty($elementosVisuais['suportes'])) {
        $visuaisInfo .= "\nSUPORTES DESENHADOS: " . implode(', ', array_map(fn($s) => '$' . round($s, 6), $elementosVisuais['suportes'])) . "\n";
    }
    if (!empty($elementosVisuais['resistencias'])) {
        $visuaisInfo .= "RESISTENCIAS DESENHADAS: " . implode(', ', array_map(fn($r) => '$' . round($r, 6), $elementosVisuais['resistencias'])) . "\n";
    }
    if (!empty($elementosVisuais['padroes_graficos'])) {
        $visuaisInfo .= "PADROES GRAFICOS IDENTIFICADOS VIA OCR: " . implode(', ', $elementosVisuais['padroes_graficos']) . "\n";
        $visuaisInfo .= "INSTRUCAO: Citar padrao somente se confirmado por min 2 indicadores. Nunca inventar padrao nao listado.\n";
    }
    if (!empty($wyckoffResult['fase']) && $wyckoffResult['fase'] !== 'INDETERMINADO') {
        $visuaisInfo .= "WYCKOFF: Fase=" . $wyckoffResult['fase'] . " | Evento=" . ($wyckoffResult['evento'] ?? 'N/A') . " | Gatilho=" . ($wyckoffResult['gatilho'] ?? 'N/A') . "\n";
    }

    $macroInfo = '';
    if (!empty($macro['vix'])) {
        $macroInfo .= "\nDADOS MACRO ATUAIS: VIX=" . $macro['vix'] . " | DXY=" . ($macro['dxy_variacao'] ?? 0) . "% | SP500=" . ($macro['sp500_variacao'] ?? 0) . "%\n";
    }
    if ($fearGreed > 0) {
        $macroInfo .= "FEAR & GREED: {$fearGreed}/100\n";
    }
    if ($btcDominancia > 0) {
        $macroInfo .= "BTC DOMINANCIA: {$btcDominancia}%\n";
    }
    $macroInfo .= "INSTRUCAO OBRIGATORIA: Preencha macroGeopolitica.resumo com analise real desses dados.\n";
    $macroInfo .= "Preencha sentimentoNarrativa.narrativa com o sentimento atual do mercado para {$symbol}.\n";
    $macroInfo .= "NAO retorne campos vazios ou com texto generico como Dados nao disponiveis.\n";

    $instrucaoNarrativa = "
INSTRUCAO DE NARRATIVA (campo analiseTecnica):
Escrever como trader profissional ao vivo. SEMPRE citar valores numericos reais dos indicadores.
Estrutura bearish (preco abaixo das 3 EMAs declinando + BOS de baixa) PREVALECE sobre RSI em sobrevenda.
RSI em sobrevenda em tendencia de baixa = risco de repique, nao reversao confirmada.
NUNCA usar travessao. NUNCA dizer limite inferior, limite superior, resistencia superior, suporte inferior.
NUNCA inventar padroes graficos nao listados acima.
Se triangulo: usar LTA ou LTB. Se canal: usar base do canal ou topo do canal.
";

    return "Voce e um trader profissional de derivativos de criptomoedas com 15 anos de experiencia. Esta analisando o par {$symbol} no timeframe {$timeframe}.\n\n"
        . "HIERARQUIA DE DADOS: Os dados abaixo foram calculados matematicamente via API com candles brutos e sao a verdade absoluta. Em caso de conflito entre estes dados e a imagem do grafico, estes dados prevalecem sempre.\n\n"
        . $contexto
        . "\nALAVANCAGEM SELECIONADA: {$leverage}x\n"
        . $entryInfo
        . $visuaisInfo
        . $macroInfo
        . $instrucaoNarrativa
        . "\nRetorne APENAS o JSON com esta estrutura exata (sem markdown, sem ```):\n"
        . '{"direcaoProvavel":"LONG ou SHORT","scoreProbabilidade":72,"confianca":65,"regime":"BULLISH ou BEARISH ou NEUTRO","entradaSugerida":{"planoA":0,"planoB":0,"descricaoPlanoA":"","descricaoPlanoB":""},"execucao":{"acao":"LONG","motivo":"","setup":{"entrada":0,"stop":0,"tp1":0,"tp2":0,"tp3":0,"alavancagem":5,"liquidacao":0,"riscoPct":2.0,"rr1":1.5,"verificacao":"SEGURO"}},"analiseTecnica":"analise completa em formato trader","macroGeopolitica":{"resumo":"resumo real dos dados macro","eventos":[""]},"sentimentoNarrativa":{"score":50,"sentimento":"NEUTRO","narrativa":"narrativa real do sentimento","gatilhosPositivos":[],"gatilhosNegativos":[]},"zonaInteresse":{"tipo":"PULLBACK","zona":"","invalidacao":""}}';
}

// ============================================================
// CORRECAO 5 — Linha 756: substituir prompt de extrairElementosVisuais()
// Adiciona instrucao para extrair POC, HVN, LVN e exchange
// ============================================================
// SUBSTITUIR a variavel $prompt dentro de extrairElementosVisuais() por:
$prompt = 'Voce e um scanner visual especializado em graficos de trading. '
    . 'Extraia APENAS elementos visiveis claramente identificaveis. Retorne JSON puro (sem texto adicional): '
    . '{"suportes":[float],"resistencias":[float],'
    . '"linhas_tendencia":[{"tipo":"LTA|LTB|HORIZONTAL","pontos":[[x1,y1],[x2,y2]]}],'
    . '"fibonacci":[float],'
    . '"padroes_graficos":["string"],'
    . '"poc":float_ou_null,'
    . '"hvn":[float],'
    . '"lvn":[float],'
    . '"exchange":"binance|bybit|bitget|okx|null"}'
    . ' INSTRUCOES:'
    . ' poc: nivel de preco com maior volume no VRVP/Volume Profile visivel. null se nao houver.'
    . ' hvn: niveis com barras LARGAS no VRVP (High Volume Nodes). [] se nao houver.'
    . ' lvn: niveis com barras ESTREITAS no VRVP (Low Volume Nodes). [] se nao houver.'
    . ' exchange: logo visivel no grafico (binance, bybit, bitget, okx).'
    . ' padroes_graficos: apenas padroes CLARAMENTE formados. Nomes validos: TRIANGULO_ASCENDENTE, TRIANGULO_DESCENDENTE, TRIANGULO_SIMETRICO, BANDEIRA_ALTA, BANDEIRA_BAIXA, CUNHA_ASCENDENTE, CUNHA_DESCENDENTE, OCO, OCO_INVERTIDO, TOPO_DUPLO, FUNDO_DUPLO, CANAL_ALTA, CANAL_BAIXA. NUNCA inventar.'
    . ' PROIBIDO: hifens, resistencia superior, suporte inferior, inventar valores.';

// ============================================================
// CORRECAO 6 — Apos linha 791 (apos o parse do OCR):
// Sobrepor zonas com POC/HVN/LVN do LuxAlgo via OCR
// ============================================================
// ADICIONAR apos "$parsed = json_decode(...)":
if (!empty($parsed['poc']))  $zonas['poc'] = (float) $parsed['poc'];
if (!empty($parsed['hvn']))  $zonas['hvn'] = array_map('floatval', $parsed['hvn']);
if (!empty($parsed['lvn']))  $zonas['lvn'] = array_map('floatval', $parsed['lvn']);

// ============================================================
// CORRECAO 7 — Linha 798: substituir gerarNarrativa() integralmente
// Agora retorna array com analiseTecnica e rationalScore separados
// ============================================================
private function gerarNarrativa(
    string $symbol,
    array  $indicadores,
    array  $score,
    array  $execucao,
    array  $wyckoff          = [],
    array  $derivativos      = [],
    array  $elementosVisuais = []
): array {
    $apiKey  = config('services.gemini_key');
    $model   = config('services.gemini_analysis_model', 'gemini-2.5-flash');
    $setup   = $execucao['setup'] ?? [];
    $preco   = $indicadores['preco'] ?? 'N/A';
    $direcao = $execucao['acao']     ?? 'N/A';

    $padroes    = $elementosVisuais['padroes_graficos'] ?? [];
    $padroesStr = !empty($padroes) ? implode(', ', $padroes) : 'nenhum detectado';
    $fundingStr = $derivativos['funding_rate']         ?? 'N/A';
    $cvdStr     = $derivativos['cvd']['delta']         ?? 'N/A';
    $lsStr      = $derivativos['long_short_ratio']     ?? 'N/A';
    $oiStr      = $derivativos['oi_variacao']          ?? 0;

    $wyckoffStr = '';
    if (!empty($wyckoff['fase']) && $wyckoff['fase'] !== 'INDETERMINADO') {
        $wyckoffStr = 'Fase Wyckoff: ' . $wyckoff['fase'] . '. Gatilho: ' . ($wyckoff['gatilho'] ?? '') . '.';
    }

    // PROMPT 1 — analiseTecnica (analise completa de trader)
    $prompt1 = "Voce e Genesis, analista quantitativo de derivativos cripto.\n"
        . "Ativo: {$symbol} | Preco: {$preco} | Direcao: {$direcao}\n"
        . "Score: " . ($score['scoreFinal'] ?? 0) . "/100 | Flags: " . implode(', ', $score['flags'] ?? []) . "\n"
        . "Setup: " . json_encode($setup) . "\n"
        . "Padroes graficos OCR: {$padroesStr}\n"
        . "Derivativos: Funding={$fundingStr} | CVD={$cvdStr} | L/S={$lsStr} | OI var={$oiStr}%\n"
        . "{$wyckoffStr}\n\n"
        . "FORMATO OBRIGATORIO (campo analiseTecnica):\n"
        . "Linha 1: estrutura do ativo — padrao grafico com nome tecnico (LTA/LTB nao limite) OU posicao nas EMAs.\n"
        . "Linha 2: RSI [valor] + ADX [valor] com +DI [valor] e -DI [valor] + leitura conjunta.\n"
        . "Linha 3: MACD — posicao em relacao ao zero + histograma expandindo ou contraindo.\n"
        . "Linha 4: Volume — tendencia + confirma ou contradiz o movimento.\n"
        . "Linha 5: CVD direcao + VRVP posicao (POC valor, HVN ou LVN proximo).\n"
        . "Linha 6 (se Fibonacci): nivel atual + contexto da retracao + o que confirma ou invalida.\n"
        . "Linha 7 (se Wyckoff): fase e gatilho operacional.\n"
        . "Linha 8: confluencia principal OU contradicao relevante que exige cautela.\n"
        . "Linha 9: invalidacao da tese — evento tecnico especifico que invalida o setup.\n\n"
        . "REGRAS ABSOLUTAS:\n"
        . "NUNCA usar travessao.\n"
        . "NUNCA dizer limite inferior, limite superior, resistencia superior, suporte inferior.\n"
        . "NUNCA inventar padrao nao detectado via OCR.\n"
        . "SEMPRE citar valores numericos reais — nunca dizer apenas alto ou baixo.\n"
        . "Se houver contradicao entre indicadores, mencionar explicitamente.";

    // PROMPT 2 — rationalScore (justificativa do score — max 3 linhas)
    $sf = $score['scoreFinal']                  ?? 0;
    $pt = $score['blocoTecnico']['percentual']   ?? 0;
    $pd = $score['blocoDerivativos']['percentual'] ?? 0;
    $fl = implode(', ', $score['flags']          ?? []);
    $vi = $score['vies']                         ?? '';
    $co = $score['confiabilidade']               ?? '';

    $prompt2 = "Score: {$sf}/100. Tecnico: {$pt}%. Derivativos: {$pd}%. Flags: {$fl}. Vies: {$vi}. Confiabilidade: {$co}."
        . " Explique em 2 a 3 linhas por que o score resultou nesse numero."
        . " O que pesou positivo e negativo nos blocos."
        . " Citar as flags mais relevantes."
        . " Nunca repetir a analise tecnica. Nunca usar travessao.";

    $analiseTecnica = '';
    $rationalScore  = '';

    try {
        $r1 = \Illuminate\Support\Facades\Http::timeout(30)->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
            [
                'contents'         => [['parts' => [['text' => $prompt1]]]],
                'generationConfig' => ['temperature' => 0.3, 'maxOutputTokens' => 1024],
            ]
        );
        if ($r1->successful()) {
            $analiseTecnica = $r1->json()['candidates'][0]['content']['parts'][0]['text'] ?? '';
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('gerarNarrativa analiseTecnica: ' . $e->getMessage());
    }

    try {
        $r2 = \Illuminate\Support\Facades\Http::timeout(15)->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}",
            [
                'contents'         => [['parts' => [['text' => $prompt2]]]],
                'generationConfig' => ['temperature' => 0, 'maxOutputTokens' => 256],
            ]
        );
        if ($r2->successful()) {
            $rationalScore = $r2->json()['candidates'][0]['content']['parts'][0]['text'] ?? '';
        }
    } catch (\Throwable $e) {
        \Illuminate\Support\Facades\Log::warning('gerarNarrativa rationalScore: ' . $e->getMessage());
    }

    return [
        'analiseTecnica' => $analiseTecnica,
        'rationalScore'  => $rationalScore,
    ];
}
