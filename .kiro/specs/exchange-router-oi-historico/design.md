# Design — Exchange Router + OI Histórico

## Visão Geral

Este design descreve a implementação do ExchangeRouter, um serviço centralizador que roteia chamadas de dados derivativos para a corretora correta (Binance, Bybit, Bitget, OKX) com fallback automático para Binance, e do sistema de armazenamento histórico de Open Interest para cálculo de variação real. A solução também integra dados públicos (Fear & Greed, BTC Dominância) ao scoring, eliminando valores hardcoded.

### Decisões Técnicas Principais

1. **Detecção via `stripos`** — O ExchangeRouter recebe o nome da corretora detectada pelo OCR (string) e usa string matching simples para mapear ao serviço correto.
2. **Fallback Binance** — Se a corretora detectada falhar ou retornar dados vazios, Binance é usada como fonte secundária.
3. **Flag `alerta_hibrido`** — Só é gerada quando dados vieram de 2+ fontes na mesma análise.
4. **OI no banco (não cache)** — Tabela `oi_historico` persiste valores para cálculo de variação entre análises.
5. **Endpoints completados** — Bybit, Bitget e OKX ganham os métodos derivativos faltantes seguindo o mesmo padrão `get()` existente.

---

## Arquitetura

### Diagrama de Fluxo

```mermaid
sequenceDiagram
    participant GA as GeminiAnalysisService
    participant ER as ExchangeRouter
    participant Det as Corretora Detectada
    participant Bin as BinanceService (Fallback)
    participant DB as oi_historico (MySQL)
    participant Alt as AlternativeService
    participant CG as CoinGeckoService

    GA->>ER: buscar(symbol, corretora_detectada)
    ER->>Det: getOpenInterest, getFundingRate, getLongShortRatio, getCvd
    alt Dados OK
        Det-->>ER: dados derivativos
    else Null/Exceção/Sem Liquidez
        ER->>Bin: getOpenInterest, getFundingRate, getLongShortRatio, getCvd
        Bin-->>ER: dados fallback
        Note over ER: alerta_hibrido = true
    end
    ER-->>GA: array normalizado

    GA->>DB: INSERT oi_historico (symbol, exchange, oi_valor)
    GA->>DB: SELECT último OI anterior
    Note over GA: Calcula oi_variacao %

    GA->>Alt: getCurrentFearGreed()
    GA->>CG: getBtcDominance()
    GA->>GA: Monta ScoreInput com dados reais
```

### Componentes Alterados

| Componente | Tipo | Mudança |
|---|---|---|
| `BybitService` | Service (existente) | +3 métodos: getOpenInterest, getLongShortRatio, getCvd |
| `BitgetService` | Service (existente) | +5 métodos: getFundingRate, getOpenInterest, getLongShortRatio, getCvd, getCandles |
| `OkxService` | Service (existente) | +3 métodos: getLongShortRatio, getCvd, getCandles |
| `ExchangeRouter` | Service (novo) | Roteamento, detecção, fallback, normalização |
| `GeminiAnalysisService` | Service (existente) | Substituir bloco hardcoded (linhas 47-63) por ExchangeRouter + dados públicos |
| `OiHistorico` | Model (novo) | Eloquent model para tabela oi_historico |
| Migration | Migration (novo) | Criar tabela oi_historico |

---

## Componentes e Interfaces

### ExchangeRouter

```php
namespace App\Services;

class ExchangeRouter
{
    private array $services;

    public function __construct(
        BinanceService $binance,
        BybitService $bybit,
        BitgetService $bitget,
        OkxService $okx
    ) {
        $this->services = [
            'binance' => $binance,
            'bybit'   => $bybit,
            'bitget'  => $bitget,
            'okx'     => $okx,
        ];
    }

    /**
     * Detecta a corretora a partir do texto OCR.
     * Retorna a chave normalizada ou 'binance' como padrão.
     */
    public function detectar(?string $ocrText): string { /* ... */ }

    /**
     * Busca dados derivativos normalizados com fallback.
     * Retorna array com: oi, funding_rate, long_short_ratio, cvd,
     *   fonte_primaria, fonte_fallback, alerta_hibrido, aviso_liquidez
     */
    public function buscar(string $symbol, string $exchange): array { /* ... */ }
}
```

**Contrato de retorno de `buscar()`:**

```php
[
    'oi'              => float,      // Open Interest valor absoluto
    'funding_rate'    => string,     // Funding rate (mantém precisão)
    'long_short_ratio'=> float,     // Ratio long/short
    'cvd'             => [           // Cumulative Volume Delta
        'delta'     => float,
        'imbalance' => float,
    ],
    'fonte_primaria'  => string,     // Ex: 'bybit'
    'fonte_fallback'  => ?string,    // Ex: 'binance' ou null
    'alerta_hibrido'  => bool,       // true se dados de 2+ fontes
    'aviso_liquidez'  => bool,       // true se OI=0 E funding=0
]
```

### Métodos Novos nos Services Existentes

#### BybitService (novos)

```php
public function getOpenInterest(string $symbol): array;
// GET /v5/market/open-interest?category=linear&symbol={symbol}

public function getLongShortRatio(string $symbol, string $period = '5m', int $limit = 30): array;
// GET /v5/market/account-ratio?category=linear&symbol={symbol}&period={period}&limit={limit}

public function getCvd(string $symbol, int $limit = 1000): array;
// Calcula CVD a partir de GET /v5/market/recent-trade?category=linear&symbol={symbol}&limit={limit}
```

#### BitgetService (novos)

```php
public function getFundingRate(string $symbol): array;
// GET /api/v2/mix/market/current-fund-rate?symbol={symbol}&productType=USDT-FUTURES

public function getOpenInterest(string $symbol): array;
// GET /api/v2/mix/market/open-interest?symbol={symbol}&productType=USDT-FUTURES

public function getLongShortRatio(string $symbol, string $period = '5m'): array;
// GET /api/v2/mix/market/account-long-short-ratio?symbol={symbol}&productType=USDT-FUTURES&period={period}

public function getCvd(string $symbol, int $limit = 1000): array;
// Calcula CVD a partir de GET /api/v2/mix/market/fills?symbol={symbol}&productType=USDT-FUTURES&limit={limit}

public function getCandles(string $symbol, string $granularity, int $limit = 200): array;
// GET /api/v2/mix/market/candles?symbol={symbol}&productType=USDT-FUTURES&granularity={granularity}&limit={limit}
```

#### OkxService (novos)

```php
public function getLongShortRatio(string $instId, string $period = '5m'): array;
// GET /api/v5/rubik/stat/contracts/long-short-account-ratio?instId={instId}&period={period}

public function getCvd(string $instId, int $limit = 1000): array;
// Calcula CVD a partir de GET /api/v5/market/trades?instId={instId}&limit={limit}

public function getCandles(string $instId, string $bar = '5m', int $limit = 200): array;
// GET /api/v5/market/candles?instId={instId}&bar={bar}&limit={limit}
```

### GeminiAnalysisService (mudanças)

**Construtor atualizado:**
```php
public function __construct(
    private ExchangeRouter $exchangeRouter,
    private BinanceService $binance,       // mantido para candles
    private YahooFinanceService $yahoo,
    private TechnicalAnalysisService $techAnalysis,
    private ScoringService $scoring,
    private ContextBuilderService $contextBuilder,
    private AlternativeService $alternative,
    private CoinGeckoService $coinGecko,
) {}
```

**Bloco derivativos substituído:**
```php
// Antes: chamadas diretas a $this->binance (linhas 47-63)
// Depois:
$corretora = $this->exchangeRouter->detectar($elementosVisuais['exchange'] ?? null);
$derivativos = $this->exchangeRouter->buscar($symbol, $corretora);

// Persiste OI e calcula variação
$oiVariacao = $this->calcularOiVariacao($symbol, $corretora, $derivativos['oi']);
$derivativos['oi_variacao'] = $oiVariacao;
```

---

## Modelos de Dados

### Tabela `oi_historico`

```sql
CREATE TABLE oi_historico (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    exchange VARCHAR(20) NOT NULL,
    oi_valor DECIMAL(20,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_exchange_created (symbol, exchange, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Model Eloquent

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OiHistorico extends Model
{
    public $timestamps = false;

    protected $table = 'oi_historico';

    protected $fillable = ['symbol', 'exchange', 'oi_valor', 'created_at'];

    protected $casts = [
        'oi_valor'   => 'float',
        'created_at' => 'datetime',
    ];
}
```

### ScoreInput Atualizado

```php
$scoreInput = [
    // ... campos existentes ...
    'fear_greed'              => $fearGreedReal,          // era hardcoded 50
    'btc_dominancia_variacao' => $btcDominanciaReal,      // era hardcoded 0
    'oi_subindo'              => $oiVariacao > 0,         // era hardcoded false
    'oi_variacao'             => $oiVariacao,             // era hardcoded 0
    'funding_rate'            => $derivativos['funding_rate'],
    'long_short_ratio'        => $derivativos['long_short_ratio'],
    'cvd_delta'               => $derivativos['cvd']['delta'],
];
```

---


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Invariante do cálculo CVD

*Para qualquer* lista de trades com quantidade (`qty`) e lado (`side` = buy/sell), o CVD delta calculado deve ser exatamente igual a `soma(qty dos buys) - soma(qty dos sells)`, e `buy_volume + sell_volume` deve ser igual ao volume total de todos os trades.

**Valida: Requisitos 1.3, 1.7, 1.10**

### Propriedade 2: Erro HTTP gera RuntimeException

*Para qualquer* serviço de corretora (Binance, Bybit, Bitget, OKX) e qualquer endpoint que receba uma resposta HTTP não-sucesso (status >= 400), o serviço deve lançar uma `RuntimeException` contendo o código de status.

**Valida: Requisito 1.12**

### Propriedade 3: Roteamento correto por exchange

*Para qualquer* nome de corretora pertencente ao conjunto `[binance, bybit, bitget, okx]`, o ExchangeRouter deve delegar as chamadas ao serviço correspondente. *Para qualquer* string que NÃO pertença a esse conjunto, o ExchangeRouter deve delegar ao BinanceService.

**Valida: Requisitos 2.2, 2.3**

### Propriedade 4: Fallback para Binance em caso de falha

*Para qualquer* corretora detectada e qualquer endpoint derivativo que retorne `null` ou lance exceção, o ExchangeRouter deve obter o dado equivalente do BinanceService e o resultado final não deve conter valores nulos para esse campo.

**Valida: Requisito 2.4**

### Propriedade 5: Detecção de liquidez insuficiente

*Para qualquer* corretora detectada cujo retorno contenha `OI = 0` E `funding_rate = 0` simultaneamente, o ExchangeRouter deve retornar `aviso_liquidez = true` e buscar todos os derivativos no BinanceService; e a resposta final da análise deve incluir o campo `aviso_liquidez` com mensagem descritiva.

**Valida: Requisitos 2.5, 5.1, 5.2**

### Propriedade 6: Alerta híbrido em fontes mistas

*Para qualquer* análise onde o ExchangeRouter utilizar dados de mais de uma corretora (ex: OI do Bybit mas CVD da Binance via fallback), o campo `alerta_hibrido` deve ser `true` no retorno do router E na resposta final da análise.

**Valida: Requisitos 2.6, 6.4**

### Propriedade 7: Invariante estrutural do retorno

*Para qualquer* chamada a `ExchangeRouter::buscar()` com qualquer symbol e exchange válidos, o array retornado deve conter exatamente as chaves: `oi`, `funding_rate`, `long_short_ratio`, `cvd`, `fonte_primaria`, `fonte_fallback`, `alerta_hibrido`, `aviso_liquidez`.

**Valida: Requisito 2.7**

### Propriedade 8: Round-trip de persistência do OI

*Para qualquer* symbol, exchange e valor de OI positivo, ao inserir um registro em `oi_historico` e imediatamente consultar o registro mais recente para o mesmo par (symbol, exchange), o valor retornado deve ser igual ao valor inserido.

**Valida: Requisitos 3.3, 3.4**

### Propriedade 9: Fórmula de variação do OI

*Para qualquer* par de valores `oi_anterior > 0` e `oi_atual >= 0`, a variação calculada deve ser exatamente `round(((oi_atual - oi_anterior) / oi_anterior) * 100, 2)`. Quando `oi_anterior` não existir (null), a variação deve ser 0.

**Valida: Requisitos 3.5, 3.6**

### Propriedade 10: Valores padrão em falha de serviços externos

*Para qualquer* falha (exceção) nos serviços AlternativeService ou CoinGeckoService, o GeminiAnalysisService deve utilizar os valores padrão configurados (`fear_greed = 50`, `btc_dominancia_variacao = 0`) sem interromper a análise. Em caso de falha total nos derivativos, os valores padrão do bloco (`oi=0, funding_rate=0, long_short_ratio=50, cvd={delta:0, imbalance:0}`) devem ser aplicados.

**Valida: Requisitos 4.5, 4.6, 6.5**

---

## Tratamento de Erros

### Estratégia por Camada

| Camada | Comportamento | Fallback |
|---|---|---|
| Service (Bybit/Bitget/OKX) | `RuntimeException` + `Log::error` | N/A — exceção propaga |
| ExchangeRouter | `try/catch` por endpoint individual | BinanceService para aquele endpoint |
| ExchangeRouter (Binance fallback falha) | `try/catch` | Retorna `null` no campo, seta flag |
| GeminiAnalysisService (derivativos) | `try/catch` no bloco inteiro | Valores padrão do bloco |
| GeminiAnalysisService (Fear&Greed) | `try/catch` individual | 50 + `Log::warning` |
| GeminiAnalysisService (BTC Dominância) | `try/catch` individual | 0 + `Log::warning` |
| OI Histórico (insert) | `try/catch` | `Log::error`, não bloqueia análise |
| OI Histórico (select) | `try/catch` | `oi_variacao = 0` |

### Cenários de Falha Composta

1. **Corretora detectada falha + Binance falha** → Bloco inteiro de derivativos usa defaults, `aviso_liquidez` pode ser true
2. **Corretora detectada sem liquidez + Binance também OI=0** → Zera bloco derivativos no ScoreInput (Requisito 5.3)
3. **DB indisponível** → OI não persiste, variação = 0, análise continua normalmente

---

## Estratégia de Testes

### Abordagem Dual

A cobertura de testes combina testes unitários (exemplos específicos) com testes de propriedade (validação universal):

- **Testes Unitários**: Cenários concretos, integrações, edge cases
- **Testes de Propriedade**: Propriedades universais validadas com inputs gerados

### Biblioteca de Property-Based Testing

- **Biblioteca**: [PHPUnit com `phpunit/phpunit`](https://phpunit.de/) + pacote [`innmind/black-box`](https://github.com/Innmind/BlackBox) para PBT em PHP
- **Alternativa aceita**: Generators customizados com loop de 100+ iterações usando PHPUnit DataProviders com `Faker`
- **Iterações mínimas**: 100 por teste de propriedade

### Plano de Testes Unitários

| Teste | Tipo | Cobertura |
|---|---|---|
| BybitService::getOpenInterest retorna estrutura válida | Integration (mock HTTP) | Req 1.1 |
| BitgetService::getFundingRate retorna estrutura válida | Integration (mock HTTP) | Req 1.4 |
| ExchangeRouter::detectar com texto OCR "bybit" | Unit | Req 2.2 |
| ExchangeRouter::buscar com fallback ativado | Unit (mock services) | Req 2.4 |
| OI variação quando não existe histórico | Unit | Req 3.6 |
| Fear & Greed service down → default 50 | Unit (mock) | Req 4.5 |
| Aviso liquidez com Binance também OI=0 → zera ScoreInput | Unit | Req 5.3 |
| Migration cria tabela com índice composto | Migration test | Req 3.1, 3.2 |

### Plano de Testes de Propriedade

Cada teste de propriedade referencia a propriedade do design document:

| Tag | Propriedade | Gerador |
|---|---|---|
| Feature: exchange-router-oi-historico, Property 1: CVD invariant | Prop 1 | Listas aleatórias de trades com qty e side |
| Feature: exchange-router-oi-historico, Property 2: HTTP error exception | Prop 2 | Status codes aleatórios >= 400 para cada serviço |
| Feature: exchange-router-oi-historico, Property 3: Routing correctness | Prop 3 | Strings aleatórias (incluindo nomes válidos e inválidos) |
| Feature: exchange-router-oi-historico, Property 4: Fallback on failure | Prop 4 | Combinações aleatórias de endpoints falhando |
| Feature: exchange-router-oi-historico, Property 5: Liquidity detection | Prop 5 | Exchanges aleatórias com OI e funding zerados |
| Feature: exchange-router-oi-historico, Property 6: Hybrid alert | Prop 6 | Cenários com falhas parciais em subsets de endpoints |
| Feature: exchange-router-oi-historico, Property 7: Structure invariant | Prop 7 | Qualquer symbol + exchange como input |
| Feature: exchange-router-oi-historico, Property 8: OI persistence round-trip | Prop 8 | Symbols, exchanges e valores OI aleatórios |
| Feature: exchange-router-oi-historico, Property 9: OI variation formula | Prop 9 | Pares (oi_anterior, oi_atual) com valores positivos aleatórios |
| Feature: exchange-router-oi-historico, Property 10: Service failure defaults | Prop 10 | Combinações de serviços falhando (Alternative, CoinGecko, Exchange) |

### Configuração dos Testes de Propriedade

- Cada teste DEVE rodar no mínimo 100 iterações
- Cada teste DEVE conter um comentário com o tag: `Feature: exchange-router-oi-historico, Property {N}: {título}`
- Cada propriedade de corretude DEVE ser implementada por UM ÚNICO teste de propriedade
- Os testes devem usar mocks dos serviços HTTP para isolar a lógica de negócio
