# Plano de Correções — GENESIS V3.0 (v3)

## Diagnóstico

> "O motor de decisão foi aplicado e funcionou. A entrega até a tela não foi feita."

As 24 correções anteriores (Persistência v2 + Lógica da Análise v2) estão reconhecidas como aplicadas. O que falta são **conexões** entre backend e frontend, e **componentes novos** (FiguraService, pool completo de barreiras, Plano B refatorado).

**Regra final:** se o motor decide mas a tela não obedece, a correção é considerada não aplicada.

---

## Arquivos afetados

| Arquivo | Correções |
|---------|-----------|
| `GeminiAnalysisService.php` | C1, C3, C6, C7, C8, C14, C15, C18 |
| `components/AnalysisResult.tsx` | C2, C15, C17 |
| `app/Services/FiguraService.php` | **NOVO** — C4, C5, C6 |
| `app/Support/GenesisVisualCatalog.php` | C4 (20 assinaturas) |
| `app/Services/AlvoService.php` | C9 |
| `app/Services/TechnicalAnalysisService.php` | C10, C13, C14 |
| `app/Services/ScoringService.php` | C13, C16 |
| `app/Services/MotorExecucaoService.php` | C11, C12, C15, C17 |
| `app/Services/SetupReconciler.php` | C15 |
| `app/Services/ContextBuilderService.php` | C14, C15 |

---

## Ordem de execução

### BLOCO 1 — A tela obedece o cérebro (2 correções)

---

### C1 (CRITICA) — Direção exibida vem do motor, não do Gemini

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php`

**Problema:** `direcaoProvavel` nunca é sobrescrito — o frontend lê o palpite do Gemini como badge principal.

```php
// Inserir logo após o bloco da Correção 8 (onde $direcaoSetup é definido)
$result['direcaoProvavel'] = $direcaoSetup;
$result['direcaoFonte']    = 'MOTOR_ESTRUTURA';

Log::info('Genesis: direcao final', [
    'symbol'        => $symbol,
    'motor'         => $direcaoSetup,
    'palpite_gemini'=> $palpiteGemini ?? null,
    'divergiu'      => (($palpiteGemini ?? null) !== $direcaoSetup),
]);
```

**Prova de aceite:** log mostrando `divergiu = true` em qualquer análise onde motor e Gemini discordem.

---

### C2 (CRITICA) — Frontend obedece AGUARDAR e traduz INSEGURO

**Arquivo:** `C:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main\components\AnalysisResult.tsx`

**Problema:** Zero ocorrências de `AGUARDAR` no frontend. Setup INSEGURO aparece como operável.

```tsx
const emEspera = data.execucao?.acao === 'AGUARDAR';

const rotuloVerificacao: Record<string, string> = {
  'SEGURO':   'Condicoes validadas para execucao',
  'INSEGURO': 'Setup nao operavel: risco-retorno abaixo do minimo de 1:1.5',
};

{emEspera ? (
  <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-6">
    <div className="text-amber-400 font-bold text-lg tracking-widest">AGUARDAR</div>
    <p className="text-amber-200/80 text-sm mt-2">
      {data.execucao?.avisos?.join(' ') ??
       'O risco-retorno atual nao atinge o minimo de 1:1.5. O cerebro recalculara o setup quando o preco oferecer um ponto melhor.'}
    </p>
  </div>
) : (
  <PipelineExecucao ... />
)}

// Botoes de plano e confirmacao:
<button disabled={emEspera} className={emEspera ? 'opacity-40 cursor-not-allowed' : ''}>

// Condicao de disparo traduzida:
<span>{rotuloVerificacao[setup.verificacao] ?? setup.verificacao}</span>
```

**Regra:** Direção continua exibida em AGUARDAR. O que trava é a execução, nunca a leitura.

---

### BLOCO 2 — Motor de Figuras (5 correções)

---

### C3 (CRITICA) — OCR vira extrator puro

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` (prompt e contrato JSON do OCR)

**Problema:** OCR nomeia figuras (alucina). Deve extrair apenas coordenadas.

**REMOVER** do template JSON do OCR:
```php
// '"padroes_graficos":[{"tipo":"string","status":"FORMANDO|CONFIRMADO|ROMPIDO","confidence":"ALTA|MEDIA|BAIXA"}],'
// E o filtro de vocabulário:
// if (in_array($tipo, GenesisVisualCatalog::GRAPH_PATTERNS) && $conf !== 'BAIXA') { aceita }
```

**COLOCAR** novo contrato:
```php
. '"linhas_desenhadas":[{'
.   '"preco_inicio":0.0,"tempo_inicio":"YYYY-MM-DD",'
.   '"preco_fim":0.0,"tempo_fim":"YYYY-MM-DD",'
.   '"estilo":"SOLIDA|TRACEJADA",'
.   '"toques_visiveis":0'
. '}],'
```

**Instrução ao prompt do OCR:**
```
"Extraia TODAS as linhas e curvas desenhadas manualmente sobre o grafico
 (nao confunda com EMAs ou indicadores). Para cada linha, leia nos eixos
 o preco e a data do ponto inicial e do ponto final. Se a linha for uma
 curva (arco), devolva 3 pontos: inicio, fundo e fim.
 PROIBIDO: nomear, classificar ou interpretar figuras graficas.
 Voce reporta coordenadas. A interpretacao nao e sua funcao."
```

---

### C4 (CRITICA) — FiguraService: PHP identifica 20 figuras por geometria e pivos

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\FiguraService.php` (NOVO) + `E:\Programas\wamp64\www\genesis-api\app\Support\GenesisVisualCatalog.php`

**Motor de 3 camadas:**
1. Linhas extraídas definem a janela (território)
2. PHP calcula pivôs (topos/fundos por fractal) nos candles da Binance dentro da janela
3. Geometria das linhas + sequência de pivôs batem contra 20 assinaturas

**Esqueleto do serviço:**
```php
<?php
namespace App\Services;

use App\Support\GenesisVisualCatalog;

class FiguraService
{
    public function identificar(array $linhas, array $candles, float $atr): ?array
    {
        if (empty($linhas) || count($candles) < 20) return null;

        // 1. Ancora de sanidade (C5). Reprovou, morreu.
        $linhas = $this->validarExtracao($linhas, $candles, $atr);
        if (empty($linhas)) return null;

        // 2. Janela da figura
        $janela = $this->definirJanela($linhas, $candles);
        if ($janela === null) return null;

        // 3. Pivos por fractal DENTRO da janela
        $pivos = $this->calcularPivos($janela['candles']);

        // 4. Propriedades geometricas das linhas
        $geo = $this->medirGeometria($linhas, $atr);

        // 5. Contexto anterior (mastro / tendencia previa)
        $contexto = $this->medirContextoAnterior($janela, $candles, $atr);

        // 6. Bate contra 20 assinaturas
        foreach (GenesisVisualCatalog::ASSINATURAS as $nome => $regra) {
            if ($this->casa($regra, $geo, $pivos, $contexto, $atr)) {
                return [
                    'tipo'           => $nome,
                    'status'         => $this->status($nome, $geo, $janela, $atr),
                    'vies'           => GenesisVisualCatalog::VIES[$nome],
                    'alvo_projetado' => $this->projetarAlvo($nome, $geo, $pivos),
                    'nivel_gatilho'  => $this->nivelDeConfirmacao($nome, $geo),
                    'toques'         => $geo['toques'],
                    'fonte'          => 'FIGURA_VALIDADA_PHP',
                ];
            }
        }
        return null; // na duvida, sem figura
    }
}
```

**Catalogo de 20 figuras (GenesisVisualCatalog):**

| Figura | Assinatura linhas | Assinatura pivos | Confirmacao | Alvo |
|--------|-------------------|-----------------|-------------|------|
| CUNHA_DESCENDENTE | 2 linhas caindo, convergindo | Min 2 toques/linha | Fechamento acima + ATR | Altura da base |
| CUNHA_ASCENDENTE | 2 linhas subindo, convergindo | Min 2 toques/linha | Fechamento abaixo | Altura da base |
| TRIANGULO_ASCENDENTE | Superior reta + inferior subindo | Min 2 toques/linha | Fechamento acima da reta | Altura da base |
| TRIANGULO_DESCENDENTE | Inferior reta + superior caindo | Min 2 toques/linha | Fechamento abaixo | Altura da base |
| TRIANGULO_SIMETRICO | Superior caindo + inferior subindo | Min 2 toques/linha | Rompimento de qualquer lado | Altura da base |
| CANAL_ALTA | 2 linhas subindo, paralelas | Min 2+2 toques | Operavel dentro | Largura do canal |
| CANAL_BAIXA | 2 linhas caindo, paralelas | Min 2+2 toques | Operavel dentro | Largura |
| CAIXOTE_ACUMULACAO | 2 retas horizontais paralelas | Tendencia anterior BAIXA | Fechamento acima do teto | Altura |
| CAIXOTE_DISTRIBUICAO | 2 retas horizontais paralelas | Tendencia anterior ALTA | Fechamento abaixo do fundo | Altura |
| BANDEIRA_ALTA | Canal curto CAINDO | Mastro alta 1.5x altura | Fechamento acima do teto | Mastro |
| BANDEIRA_BAIXA | Canal curto SUBINDO | Mastro baixa | Fechamento abaixo do fundo | Mastro |
| FLAMULA_ALTA | Triangulo simetrico pequeno | Mastro alta | Fechamento acima | Mastro |
| FLAMULA_BAIXA | Triangulo simetrico pequeno | Mastro baixa | Fechamento abaixo | Mastro |
| OCO | 1 neckline | 3 topos (central mais alto, ombros +-1 ATR) | Fechamento abaixo neckline | Cabeca-neckline |
| OCO_INVERTIDO | 1 neckline | 3 fundos (central mais baixo) | Fechamento acima | Cabeca-neckline |
| TOPO_DUPLO | Neckline/topos | 2 topos +-0.5 ATR, vale entre | Fechamento abaixo vale | Altura topo-vale |
| FUNDO_DUPLO | Neckline/fundos | 2 fundos +-0.5 ATR, topo entre | Fechamento acima | Altura |
| TOPO_TRIPLO | Idem topo duplo | 3 topos equivalentes | Fechamento abaixo menor vale | Altura |
| FUNDO_TRIPLO | Idem fundo duplo | 3 fundos equivalentes | Fechamento acima maior topo | Altura |
| XICARA_COM_ALCA | Borda/arco 3 pontos | Fundo em U suave + alca 1/3 prof | Fechamento acima borda | Profundidade |

**Reguas geometricas (constantes):**
- Inclinacao: em preco/candle. RETA se |incl| < 0.05 ATR/candle
- Paralelas: diferenca de inclinacao <= 20% da media
- Convergindo: cruzamento projetado a frente, ate 2x duracao da janela
- Divergindo: distancia entre linhas cresce -> sem figura
- Toque: candle a <= 0.3 ATR da linha naquele ponto
- Equivalencia topos/fundos: <= 0.5 ATR (1 ATR para ombros OCO)
- Mastro: amplitude >= 1.5x altura da figura, duracao figura < duracao mastro

---

### C5 (ALTA) — Ancora de sanidade da extracao

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\FiguraService.php`

```php
private function validarExtracao(array $linhas, array $candles, float $atr): array
{
    $validas = [];
    foreach ($linhas as $linha) {
        $ok = true;
        foreach ([['preco_inicio','tempo_inicio'], ['preco_fim','tempo_fim']] as [$p,$t]) {
            $candle = $this->candleNaData($candles, $linha[$t] ?? null);
            if ($candle === null) { $ok = false; break; }
            $dist = min(abs($linha[$p] - $candle['high']), abs($linha[$p] - $candle['low']));
            $dentro = $linha[$p] >= $candle['low'] && $linha[$p] <= $candle['high'];
            if (!$dentro && $dist > 2 * $atr) { $ok = false; break; }
        }
        if ($ok) $validas[] = $linha;
    }
    return $validas;
}
```

---

### C6 (CRITICA) — Status, vies e alvo projetado pelo PHP

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\FiguraService.php` + `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php`

**Integracao no pipeline principal:**
```php
// GeminiAnalysisService::analisar(), antes da votacao de direcao:
$figura = app(FiguraService::class)->identificar(
    $elementosVisuais['linhas_desenhadas'] ?? [],
    $candles,
    $indicadores['atr'] ?? 0.0
);

// A votacao de direcao (EstruturaService::vieDirecional) passa a receber
// $figura['vies'] SOMENTE quando $figura !== null.
// O ScoringService pontua a figura SOMENTE quando $figura !== null,
// com peso cheio se ROMPIDA a favor e metade se FORMANDO.
// O alvo_projetado entra no pool de barreiras como tipo 'geometria'.
```

**Regras de participacao:**
- FORMANDO: vota vies, pontua com peso reduzido pela metade
- ROMPIDA na direcao do vies: vota e pontua cheio
- ROMPIDA contra o vies: descartada, vira flag informativa
- null: nao vota, nao pontua, nao e mencionada

**REMOVER:** qualquer consumo de `status` e `confidence` vindos do OCR; qualquer leitura de `$padroes[0]['tipo']` do OCR para `viesDaFigura`.

---

### C7 (ALTA) — Gate de silencio

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` (prompt) + `E:\Programas\wamp64\www\genesis-api\app\Services\MotorExecucaoService.php` (Plano A)

```php
// Quando $figura !== null:
"FIGURA VALIDADA PELO MOTOR: {tipo} | status {status} | gatilho em {nivel_gatilho}
 | alvo projetado {alvo_projetado}"
// Regras no prompt:
"Figura grafica e identificada pelo desenho do trader e validada pelo motor.
 PROIBIDO afirmar que figura e confirmada por RSI, MACD ou qualquer indicador.
 Indicador descreve momentum, nunca confirma figura."

// Quando $figura === null:
"Nao ha figura grafica validada nesta analise. PROIBIDO mencionar,
 sugerir ou especular figuras. Abra a analise pela posicao do preco
 em relacao as EMAs."
```

---

### BLOCO 3 — Motor de Alvos (2 correcoes)

---

### C8 (CRITICA) — Pool unico e completo de barreiras

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` (montagem do pool, passo da costura)

**REMOVER** pool atual (3 tipos: HVN, OCR resistencias/suportes, POC)

**COLOCAR** pool com 7 tipos:
```php
$barreiras = [];
$add = function ($preco, string $tipo) use (&$barreiras) {
    if (is_numeric($preco) && $preco > 0) $barreiras[] = ['preco'=>(float)$preco, 'tipo'=>$tipo];
};

// 1. Clusters de liquidacao (peso 10)
foreach ($liqClusters ?? [] as $c) $add($c['preco'] ?? $c, 'cluster_liquidacao');

// 2. Paredes de book (peso 9)
foreach ($orderbook['paredes'] ?? [] as $p) $add($p['preco'] ?? $p, 'parede_book');

// 3. Suportes e resistencias do desenho (peso 8)
foreach ($ocr['resistencias'] ?? [] as $r) $add($r, 'resistencia');
foreach ($ocr['suportes'] ?? [] as $s) $add($s, 'suporte');

// 4. Perfil de volume (pesos 7 e 6)
$add($zonas['poc'] ?? null, 'poc');
foreach ($zonas['hvns'] ?? [] as $h) $add($h['preco'] ?? $h, 'hvn');
$add($zonas['vah'] ?? null, 'hvn');
$add($zonas['val'] ?? null, 'hvn');

// 5. EMAs (peso 5): barreiras dinamicas reais
foreach (['ema21','ema50','ema200'] as $e) $add($indicadores[$e] ?? null, 'ema');

// 6. Geometria (peso 4): alvo projetado da figura validada + fibo
if (!empty($figura['alvo_projetado'])) $add($figura['alvo_projetado'], 'geometria');
foreach ($fibonacci['extensoes'] ?? [] as $f) $add($f, 'geometria');
```

---

### C9 (CRITICA) — Alvos sequenciais com piso de RR no TP1

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\AlvoService.php`

**REMOVER** selecao "fortes primeiro" que pula barreiras reais

**COLOCAR** selecao sequencial com piso de RR:
```php
const RR_MINIMO = 1.5;

// $grupos ja ordenados por distancia crescente a partir da entrada
$risco   = abs($entrada - $stop);
$pisoTP1 = $isLong ? $entrada + (self::RR_MINIMO * $risco)
                   : $entrada - (self::RR_MINIMO * $risco);

// TP1: primeira barreira real ALEM do piso de RR
// TP2 e TP3: barreiras seguintes na sequencia, sem pular nenhuma
$sequencia = array_values(array_filter($grupos, fn($g) =>
    $isLong ? $g['preco'] >= $pisoTP1 : $g['preco'] <= $pisoTP1
));

$tp1 = $sequencia[0] ?? null;
$tp2 = $sequencia[1] ?? null;
$tp3 = $sequencia[2] ?? null;

if ($tp1 === null) return ['tps' => [], 'motivo' => 'SEM_BARREIRA_ALEM_DO_PISO_RR'];

// Desempate na mesma faixa (<= 0.5 ATR): maior confluencia, depois maior peso de tipo
```

**Regra:** Cada TP devolvido carrega campo `fonte` com tipo e preco da barreira. Proibido inventar alvo por multiplo de ATR.

---

### BLOCO 4 — preco_subindo (1 correcao)

---

### C10 (CRITICA) — preco_subindo mede preco real, nao EMA21

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\TechnicalAnalysisService.php`

```php
// DE:
"preco_subindo" => $ema21 > $prevEma21,   // isto e inclinacao de media, nao preco

// PARA:
$n = count($closes);
"preco_subindo"  => $n >= 4 ? ($closes[$n-1] > $closes[$n-4]) : ($closes[$n-1] > $closes[0]),
"ema21_subindo"  => $ema21 > $prevEma21,   // a inclinacao da media com nome verdadeiro
```

**Conexao obrigatoria:** Revisar cada consumidor de `preco_subindo` no ScoringService. Onde o significado pretendido for inclinacao da media, trocar para `ema21_subindo`. Nenhum consumidor ambiguo.

---

### BLOCO 5 — Plano B coerente (2 correcoes)

---

### C11 (ALTA) — Zona estrutural real e evento Wyckoff coerente

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\MotorExecucaoService.php` (gerarPlanoB)

**REMOVER:**
```php
$hvnFrom = $entradaB * 0.97;   // zona de -3% (cosmetica)
$hvnTo   = $entradaB * 1.03;
// ...
$eventoWyckoff = str_contains($fase, 'DISTRIBUI') ? 'UTAD/upthrust' : ...;  // ignora direcao
```

**COLOCAR:**
```php
// ZONA: delimitada pelas duas barreiras reais que abracam a entrada B
[$zonaDe, $zonaAte] = $this->zonaEstrutural($entradaB, $barreiras, $isLong, $precoAtual, $atr);

// EVENTO: direcao primeiro, fase depois
$eventoWyckoff = $isLong
    ? (str_contains($fase, 'ACUMULA')
        ? 'spring ou teste de suporte com volume secando'
        : 'reconquista do suporte do range com fechamento acima')
    : (str_contains($fase, 'DISTRIBUI')
        ? 'UTAD ou upthrust com rejeicao no teto'
        : 'rejeicao no teto do range com volume vendedor');
```

---

### C12 (ALTA) — Plano B consome NivelService e AlvoService

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\MotorExecucaoService.php`

**REMOVER** stop por ATR e alvos pelo motor antigo:
```php
// $stopB = $this->calcularStopLong($entradaB, $atr, $atrMult * 0.8, ...);
// $tpsB  = $this->calcularTPs($entradaB, ...);
```

**COLOCAR** chamada aos servicos de fonte unica:
```php
$stopB = app(NivelService::class)->stop($entradaB, $direcao, $niveis, $atr);
$tpsB  = app(AlvoService::class)->calcularAlvos($entradaB, $stopB, $direcao, $barreiras, $atr);
// Mesmo pool da C8, mesmo piso de RR da C9.
// Depois desta correcao, deletar calcularTPs antigo (codigo morto).
```

---

### BLOCO 6 — Wyckoff honesto (2 correcoes)

---

### C13 (ALTA) — Range sem evento nao e distribuicao

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\TechnicalAnalysisService.php` (classificarFase) + `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php`

**REMOVER** proxy de EMA200:
```php
// if ($dentroDeRange) {
//     return $precoAbaixoDaEma200 ? 'DISTRIBUICAO_RANGE' : 'ACUMULACAO_RANGE';
// }
```

**COLOCAR:**
```php
// Sem evento detectado, o cerebro nao inventa intencao institucional
if ($dentroDeRange && empty($eventosDetectados)) {
    return 'RANGE_SEM_EVENTO';
}
// ScoringService: RANGE_SEM_EVENTO = neutro (1/1) + flag 'range_sem_evento'
// ContextBuilder: "Consolidacao lateral sem evento Wyckoff confirmado.
//  Operar pelos niveis do range: suporte em {x}, teto em {y}."
// DISTRIBUICAO_* e ACUMULACAO_* passam a exigir ao menos 1 evento detectado
```

---

### C14 (ALTA) — Dicionario Wyckoff no prompt + limpeza de strings

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php` (prompt) + `E:\Programas\wamp64\www\genesis-api\app\Services\TechnicalAnalysisService.php` + `E:\Programas\wamp64\www\genesis-api\app\Services\ContextBuilderService.php`

**Dicionario fixo no prompt da narrativa:**
```
SIGNIFICADO OFICIAL DAS SIGLAS WYCKOFF:
- SC: climax de venda, capitulacao com volume extremo
- AR: rali automatico apos o climax
- ST: teste secundario do extremo com volume menor
- SPRING: violacao falsa do suporte do range com recuperacao. Gatilho de compra.
- SOS: rompimento do teto do range com volume. Gatilho de compra.
- UTAD / UPTHRUST: violacao falsa do teto do range com rejeicao. Gatilho de venda.
- SOB: quebra do suporte do range com volume. Gatilho de venda.

REGRAS DE COERENCIA:
- A direcao ja foi decidida pelo motor. PROIBIDO usar "aguardar", "indefinido"
  ou qualquer formulacao que sugira nao ter direcao.
- PROIBIDO usar a palavra "sinal" e a palavra "horizontal".
```

**Limpeza de strings no contexto:**
```
'Aguardar evento direcional (UAT/SOB)'
  -> 'Range sem evento confirmado. Niveis do range regem a operacao.'
'Sinal de compra tecnico' -> 'Leitura compradora no tecnico'
'Sinais de menor confiabilidade' -> 'Leituras de menor confiabilidade'
'Aguardar confirmacao antes de entrar' -> 'Gatilho de entrada ainda nao atingido'
```

---

### BLOCO 7 — Portugues (1 correcao)

---

### C15 (ALTA) — Acentuacao em todas as strings voltadas ao usuario

**Arquivos:** `MotorExecucaoService.php`, `GeminiAnalysisService.php`, `SetupReconciler.php`, `ContextBuilderService.php`, `AnalysisResult.tsx`

**Tabela de substituicoes:**

| Arquivo | De | Para |
|---------|-----|------|
| MotorExecucaoService (invalidacao) | `A tese sera invalidada se o preco fechar abaixo de` | `A tese sera invalidada se o preco fechar abaixo de` |
| MotorExecucaoService (Plano A figura) | `sem aguardar confirmacao de rompimento. Risco de movimento contrario` | `sem aguardar confirmacao de rompimento. Risco de movimento contrario` |
| SetupReconciler (avisos) | `abaixo do minimo, Setup nao operavel, Stop proximo da liquidacao` | `abaixo do minimo, Setup nao operavel, Stop proximo da liquidacao` |
| GeminiAnalysisService (micro analises) | `tecnica fraca ou contra a direcao, pressao oposta, Cenario macro favoravel, tracao` | `tecnica fraca ou contra a direcao, pressao oposta, Cenario macro favoravel, tracao` |
| GeminiAnalysisService (flagLabels) | `Divergencia, Compressao, Pressao compradora` | `Divergencia, Compressao, Pressao compradora` |
| AnalysisResult.tsx | strings sem acento | portugues completo |

**Sanitizador de espacamento da narrativa:**
```php
// Antes de persistir/devolver a narrativa gerada:
$texto = preg_replace('/(\d)(?=[a-zà-ú]{3,})/u', '$1 ', $texto);  // "21.51com" -> "21.51 com"
$texto = preg_replace('/\s{2,}/', ' ', $texto);                    // espacos duplicados
$texto = preg_replace('/\s+([,.;:])/', '$1', $texto);              // espaco antes de pontuacao
```

**Criterio:** grep pelas formas sem acento retorna zero em strings voltadas ao usuario.

---

### BLOCO 8 — Pesos internos (1 correcao)

---

### C16 (MEDIA) — Distribuicao interna oficial das familias

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\ScoringService.php`

**Somas exatas por familia:**

| Familia (peso) | Componente | Oficial |
|----------------|-----------|---------|
| **ESTRUTURA (30)** | EMAs/empilhamento | 8 |
| | Golden/Death Cross | 4 |
| | Wyckoff | 10 (separado) |
| | Figuras (validadas PHP) | 8 (separado, metade FORMANDO) |
| **ORDER FLOW (28)** | CVD slope | 9 |
| | CVD divergencia | 9 |
| | Volume | 5 |
| | Book imbalance | 5 |
| **DERIVATIVOS (28)** | Funding | 8 |
| | Open Interest | 10 (maior peso) |
| | L/S Ratio | 4 (menor peso) |
| | Clusters liquidacao | 3+3 |
| **MOMENTUM (14)** | RSI | 4 |
| | ADX (DMI) | 3 |
| | MACD (4 casos + zero cross) | 4 |
| | DMI + divergencia RSI | 3 |

**Ajustes:**
- Compressao de estrutura: vira flag pura, zero pontos (hoje da 5 pontos direcionais por `preco_subindo`)
- Wyckoff e figura separados (hoje fundidos num bloco so)
- CVD slope e divergencia separados (hoje ate 20 pontos duplicados)
- Momentum clipado em 14 (hoje soma ate 32)
- Maximos de barra atualizados: barraTecnico (30/28/14), blocoTecnico (max 44), blocoDerivativos (max 56)

---

### BLOCO 9 — Risco e Sentimento (2 correcoes)

---

### C17 (ALTA) — Tamanho dimensionado pelo stop

**Arquivos:** `E:\Programas\wamp64\www\genesis-api\app\Services\MotorExecucaoService.php` (tamanho) + `C:\Users\felip\Downloads\G-nesis-2.0-main\G-nesis-2.0-main\components\AnalysisResult.tsx` (rotulo)

**Backend:**
```php
const RISCO_MARGEM_ALVO = 0.25;  // 25% da margem. Constante do Fabricio.
// NAO ALTERAR sem autorizacao expressa.

$riscoUsdAlvo   = $margemBase * self::RISCO_MARGEM_ALVO;
$distStopPct    = abs($entrada - $stop) / $entrada;
$nocionalMax    = $riscoUsdAlvo / $distStopPct;                 // stop longe -> nocional menor
$nocional       = min($nocionalMax, $margemBase * $alavancagem);
$quantidade     = $nocional / $entrada;
$riscoMargemPct = ($distStopPct * $nocional / $margemBase) * 100;
```

**Frontend:**
```tsx
const riscoMargemPct = setup.riscoMargemPct ?? setup.riscoPct * (setup.alavancagem ?? 1);
{riscoMargemPct > 50 ? 'Alta Exposicao'
 : riscoMargemPct > 25 ? 'Exposicao Moderada'
 : 'Baixa Exposicao'}
// Exibir junto: "{riscoMargemPct}% da margem em risco no stop"
```

---

### C18 (MEDIA) — Sentimento com fonte unica na tela

**Arquivo:** `E:\Programas\wamp64\www\genesis-api\app\Services\GeminiAnalysisService.php`

```php
// blocoSentimento passa a usar a mesma fonte do painel de sentimento:
$result['scoreDetalhado']['blocoSentimento'] = [
    'percentual' => $sentimentoAtivo['score'] ?? null,
    'direcao'    => ($sentimentoAtivo['score'] ?? 50) >= 55 ? 'alta'
                  : (($sentimentoAtivo['score'] ?? 50) <= 45 ? 'baixa' : 'neutro'),
    'fonte'      => 'SENTIMENTO_ATIVO',
];
```

---

## Criterios de aceite (obrigatorios)

### Caso 1: SOLUSDT com linhas divergentes (grafico da auditoria)
- [ ] Analise **nao menciona figura** em lugar nenhum
- [ ] Log do FiguraService registrando reprovacao (linhas divergentes)
- [ ] Log mostrando `motor`, `palpite_gemini` e `divergiu`
- [ ] Badge da tela = valor de `motor`
- [ ] Se RR < 1.5 -> tela com pipeline travado, botoes desabilitados
- [ ] Se RR >= 1.5 -> TP1 com fonte da barreira nomeada
- [ ] 3 TPs com campo `fonte` preenchido
- [ ] Invalidacao com acentuacao correta
- [ ] Grep formas sem acento = zero

### Caso 2: Cunha descendente verdadeira
- [ ] FiguraService identifica CUNHA_DESCENDENTE com toques, status e alvo
- [ ] Figura vota na direcao e pontua na estrutura
- [ ] Narrativa menciona figura sem "confirmada pelo RSI/MACD"
- [ ] Alvo projetado no pool de barreiras (tipo geometria)

### Caso 3: Ativo em SHORT
- [ ] Badge SHORT vindo do motor
- [ ] Plano B: zona abaixo de barreiras reais, evento Wyckoff coerente com venda
- [ ] Stop e alvos do NivelService/AlvoService
- [ ] Exposicao calculada sobre margem com percentual exibido

### Provas de entrega
- [ ] Prints das 3 telas
- [ ] Trechos de log citados
- [ ] Saida do grep (padroes_graficos, calcularTPs, INSEGURO, preco_subindo)
- [ ] Testes unitarios do FiguraService (figura valida reconhecida, invalida = null)
- [ ] Teste integrado (tela le direcaoProvavel, direcaoFonte, execucao.acao, setup.verificacao)

---

## Resumo

| Bloco | Correcoes | Impacto |
|-------|-----------|---------|
| 1. Tela obedece | C1, C2 | Conexao motor->frontend |
| 2. Figuras | C3, C4, C5, C6, C7 | Novo servico + catalogo 20 figuras |
| 3. Alvos | C8, C9 | Pool completo + piso RR |
| 4. preco_subindo | C10 | Desacoplar da EMA |
| 5. Plano B | C11, C12 | Zona real + fonte unica |
| 6. Wyckoff | C13, C14 | Range honesto + dicionario |
| 7. Portugues | C15 | Acentuacao em 5 arquivos |
| 8. Pesos | C16 | Distribuicao interna oficial |
| 9. Risco/Sentimento | C17, C18 | Dimensionamento + fonte unica |

**Total:** 18 correcoes em 10 arquivos + 1 arquivo novo (FiguraService)
