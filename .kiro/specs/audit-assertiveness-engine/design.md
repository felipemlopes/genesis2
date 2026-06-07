# Design — Audit Assertiveness Engine

## Visão Geral

Este documento detalha o design técnico para implementação da Auditoria Final (Seção 6c — 12 correções) e das 5 Melhorias de Assertividade (Seção 6d) no sistema Genesis Labs. As alterações concentram-se em três módulos Python:

- **indicatorEngine.py** — Correção do boundary ATR (`<` → `<` ao invés de `<=`)
- **monitor_worker.py** — Conexão de dados reais (CVD, Book Imbalance, Fear & Greed, OI, L/S Ratio, Liquidações, Equal Highs/Lows, MACD zero cross, multiplicador de sessão)
- **scoringEngine.py** — Reescrita do `calcular_score()` com dois blocos (Técnico max 55pts + Derivativos max 45pts), remoção de Macro/Sentimento, arredondamento em múltiplos de 5

A regra central: **nenhum campo pode chegar zerado/None ao ScoringEngine** quando há dados disponíveis.

## Arquitetura

```mermaid
graph TD
    subgraph WebSocket_Streams
        WS_KLINE[Kline 1h — 4 Exchanges]
        WS_AGG[aggTrade — Binance]
        WS_DEPTH[depth5@100ms — Binance]
    end

    subgraph REST_APIs
        API_FG[Fear & Greed — alternative.me]
        API_LS[L/S Ratio — 4 Exchanges]
        API_LIQ[Liquidações — /fapi/v1/allForceOrders]
        API_OI[Open Interest — /fapi/v1/openInterest]
        API_FR[Funding Rate — /fapi/v1/premiumIndex]
    end

    subgraph Monitor_Worker
        MW_CANDLE[processar_candle]
        MW_CVD[_acumular_cvd]
        MW_BOOK[_atualizar_orderbook]
        MW_SCORE[calcular_indicadores_e_score]
        MW_SESSION[obter_multiplicador_sessao]
    end

    subgraph IndicatorEngine
        IE_ATR[calcular_atr — fix boundary]
        IE_EMA[calcular_ema / calcular_ema_series]
        IE_RSI[calcular_rsi / detectar_divergencia_rsi]
        IE_MACD[calcular_macd]
        IE_EQ[identificar_equal_highs / equal_lows]
        IE_CVD[calcular_cvd_slope]
    end

    subgraph ScoringEngine
        SE_SCORE[calcular_score — rewritten]
        SE_TECH[Bloco Técnico — max 55pts]
        SE_DERIV[Bloco Derivativos — max 45pts]
    end

    subgraph Persistência
        DB_MYSQL[(MySQL — oi_historico)]
    end

    WS_KLINE --> MW_CANDLE
    WS_AGG --> MW_CVD
    WS_DEPTH --> MW_BOOK
    API_FG --> MW_SCORE
    API_LS --> MW_SCORE
    API_LIQ --> MW_SCORE
    API_OI --> MW_SCORE
    API_FR --> MW_SCORE

    MW_CANDLE --> MW_SCORE
    MW_CVD --> MW_SCORE
    MW_BOOK --> MW_SCORE
    MW_SCORE --> IE_ATR
    MW_SCORE --> IE_EMA
    MW_SCORE --> IE_RSI
    MW_SCORE --> IE_MACD
    MW_SCORE --> IE_EQ
    MW_SCORE --> IE_CVD
    MW_SCORE --> SE_SCORE
    MW_SCORE --> MW_SESSION

    SE_SCORE --> SE_TECH
    SE_SCORE --> SE_DERIV

    MW_SCORE --> DB_MYSQL
```

### Fluxo de Dados Principal

1. **Ingestão**: WebSocket streams (kline de 4 exchanges, aggTrade, depth5) alimentam o worker
2. **Acumulação**: CVD buffer circular (100 entradas/ativo), orderbook cache (5 níveis bid/ask)
3. **Enriquecimento REST**: Fear & Greed (cache 1h), L/S Ratio (4 exchanges), Liquidações, OI
4. **Cálculo de Indicadores**: IndicatorEngine processa candles → indicadores técnicos
5. **Scoring**: ScoringEngine recebe dados enriquecidos → score final com multiplicador de sessão
6. **Persistência**: OI gravado no MySQL para sobreviver a restarts

## Componentes e Interfaces

### 1. indicatorEngine.py — Correção ATR

**Mudança**: Alterar condição de `len(candles) <= periodo` para `len(candles) < periodo`

```python
# ANTES (incorreto)
def calcular_atr(candles, periodo=14):
    if len(candles) <= periodo:
        return None

# DEPOIS (correto)
def calcular_atr(candles, periodo=14):
    if len(candles) < periodo:
        return None
```

**Justificativa**: Com `<=`, quando `len(candles) == periodo` a função retorna None quando deveria calcular. Isso impede `detectar_compressao_volatilidade` de funcionar com `atr_5` (que chama com exatamente 5 candles recentes).

### 2. monitor_worker.py — Novos Imports

```python
from indicatorEngine import (
    calcular_ema, calcular_ema_series, calcular_rsi, calcular_atr, calcular_adx,
    calcular_macd, calcular_bollinger, calcular_vwap,
    calcular_cvd_slope, detectar_compressao_volatilidade,
    detectar_divergencia_rsi, identificar_equal_highs, identificar_equal_lows
)
```

### 3. monitor_worker.py — CVD via aggTrade

**Interface**:
```python
class MonitorWorker:
    def __init__(self):
        ...
        self._cvd_buffers = {}  # {symbol: collections.deque(maxlen=100)}

    def _acumular_cvd(self, symbol: str, trade_msg: dict) -> None:
        """Processa mensagem aggTrade e acumula no buffer CVD do ativo."""

    def _calcular_cvd_slope_real(self, symbol: str) -> float:
        """Retorna slope dos últimos 10 valores CVD do buffer, ou 0 se < 60 amostras."""
```

**WebSocket**: Subscreve a `<symbol_lower>@aggTrade` no mesmo WebSocket Binance.
- `m == False` → trade do comprador (buyer is maker = False → taker bought) → soma ao CVD
- `m == True` → trade do vendedor → subtrai do CVD

**Buffer**: `collections.deque(maxlen=100)` por ativo. Snapshot CVD a cada 1 minuto. Mínimo 60 amostras para considerar válido.

### 4. monitor_worker.py — Book Imbalance via depth5

**Interface**:
```python
class MonitorWorker:
    def __init__(self):
        ...
        self._orderbook_cache = {}  # {symbol: {'bids': [...], 'asks': [...]}}

    def _atualizar_orderbook(self, symbol: str, depth_msg: dict) -> None:
        """Atualiza cache com 5 melhores níveis bid/ask."""

    def _calcular_book_imbalance(self, symbol: str) -> float | None:
        """Retorna (sum_bids - sum_asks) / (sum_bids + sum_asks) ou None."""
```

**WebSocket**: Subscreve a `<symbol_lower>@depth5@100ms` no mesmo WebSocket Binance.

### 5. monitor_worker.py — Fear & Greed com Cache 1h

**Interface**:
```python
class MonitorWorker:
    def __init__(self):
        ...
        self._fear_greed_cache = None
        self._fear_greed_timestamp = 0

    def buscar_fear_greed(self) -> int | None:
        """Busca Fear & Greed de alternative.me com cache de 1h."""
```

**API**: `GET https://api.alternative.me/fng/` → `response['data'][0]['value']`
**Cache**: Se `time.time() - self._fear_greed_timestamp < 3600`, retorna cache. Senão, faz nova requisição.

### 6. monitor_worker.py — L/S Ratio de 4 Exchanges

**Interface**:
```python
def buscar_ls_ratio(self, symbol: str) -> float | None:
    """Busca L/S ratio agregado de até 4 exchanges. Retorna proporção de longs (0.0-1.0)."""
```

**Endpoints**:
- Binance: `GET /futures/data/globalLongShortAccountRatio?symbol={}&period=1h`
- Bybit: `GET /v5/market/account-ratio?category=linear&symbol={}&period=1h`
- Bitget: `GET /api/v2/mix/market/account-long-short?symbol={}&period=1h`
- OKX: `GET /api/v5/rubik/stat/contracts-long-short-ratio?instId={}-USDT-SWAP&period=1H`

**Agregação**: Média aritmética dos ratios obtidos com sucesso. Se todas falham, retorna None.

### 7. monitor_worker.py — OI Persistência MySQL

**Interface**:
```python
def _buscar_oi_banco(self, symbol: str) -> float | None:
    """Busca último OI registrado no MySQL para o ativo."""

def _gravar_oi_banco(self, symbol: str, oi_value: float) -> None:
    """Grava OI atual no MySQL (tabela oi_historico)."""
```

**Tabela MySQL**: `oi_historico`
```sql
CREATE TABLE IF NOT EXISTS oi_historico (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    exchange VARCHAR(20) DEFAULT 'BINANCE',
    oi_valor DOUBLE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_symbol_created (symbol, created_at DESC)
);
```

### 8. monitor_worker.py — Liquidações Reais

**Interface**:
```python
def buscar_liquidacoes_recentes(self, symbol: str, janela_minutos: int = 5) -> dict:
    """Busca liquidações reais via /fapi/v1/allForceOrders.
    Retorna: {'cluster_acima': float|None, 'cluster_abaixo': float|None}
    """
```

**Lógica**: Agrupa liquidações por tipo (LONG abaixo do preço = cluster_abaixo, SHORT acima = cluster_acima). Retorna preço médio ponderado por quantidade do cluster mais próximo.

### 9. monitor_worker.py — Equal Highs/Lows → Cluster Liquidação

**Lógica**: Chama `identificar_equal_highs(candles)` e `identificar_equal_lows(candles)`. Filtra níveis a menos de 1.5% do preço atual. Compara com clusters de liquidações reais e usa o mais próximo ao preço.

### 10. monitor_worker.py — preco_subindo via EMA21

**Mudança**:
```python
# ANTES
preco_subindo = preco_atual > preco_anterior

# DEPOIS
ema21_atual = calcular_ema(closes, 21)
ema21_anterior = calcular_ema(closes[:-1], 21)
preco_subindo = ema21_atual > ema21_anterior if (ema21_atual and ema21_anterior) else preco_atual > preco_anterior
```

### 11. monitor_worker.py — MACD Zero Line Crossover

**Interface**:
```python
def _detectar_macd_zero_cross(self, closes: list) -> str | None:
    """Detecta cruzamento do MACD pela linha zero.
    Retorna: 'BULLISH', 'BEARISH', ou None.
    """
```

**Lógica**: Calcula MACD atual (`closes`) e MACD anterior (`closes[:-1]`). Se `macd_atual > 0` e `macd_anterior <= 0` → BULLISH. Se `macd_atual < 0` e `macd_anterior >= 0` → BEARISH.

### 12. monitor_worker.py — Multiplicador de Sessão

**Interface**:
```python
def obter_multiplicador_sessao(self) -> float:
    """Retorna multiplicador baseado na sessão UTC atual."""
```

**Mapeamento**:
| Sessão     | Horário UTC | Multiplicador |
|------------|-------------|---------------|
| Ásia       | 00:00–08:00 | 0.85          |
| Londres    | 08:00–13:00 | 0.95          |
| Nova York  | 13:00–21:00 | 1.00          |
| Overnight  | 21:00–00:00 | 0.90          |

### 13. scoringEngine.py — Reescrita calcular_score()

**Estrutura Nova**:
- **Bloco Técnico** (máx 55 pontos): EMA200, RSI, Divergência RSI, ADX (proporcional), MACD signal, MACD zero cross, Compressão/Volatilidade
- **Bloco Derivativos** (máx 45 pontos): CVD slope, Book Imbalance, Divergência CVD, Funding, OI, L/S Ratio, Clusters Liquidação

**Mudanças Chave**:
- ADX scoring proporcional: `>=30 → 8pts`, `25-30 → 5pts`, `20-25 → 3pts`, `<20 → 1pt neutro`
- MACD zero cross: `+5pts` na direção do cruzamento
- Score arredondado: `round(score / 5) * 5`
- Macro e Sentimento removidos do cálculo do score (podem gerar flags informativas mas não pontuam)
- Comparadores de geo_score e sent_moeda: `>=` e `<=` ao invés de `==`

**Fórmula do Score Final**:
```python
tc_final = min(tc_bullish if bullish else tc_bearish, 55)
dr_final = min(dr_bullish if bullish else dr_bearish, 45)
score_bruto = tc_final + dr_final
score_final = round(score_bruto / 5) * 5
score_final = max(0, min(100, score_final))
```

## Modelos de Dados

### dados_score (dict passado ao ScoringEngine)

```python
dados_score = {
    # Indicadores Técnicos
    'preco': float,                    # Preço atual
    'ema200': float | None,            # EMA 200
    'ema200_subindo': bool | None,     # EMA200 atual > anterior
    'rsi': float | None,               # RSI 14 (1-99)
    'adx': float | None,               # ADX 14 (0-100)
    'preco_subindo': bool,             # EMA21 direção (não 2-candle)
    'macd_acima_signal': bool | None,  # MACD > Signal
    'histograma_subindo': bool | None, # Histogram > 0
    'macd_cruza_zero': str | None,     # 'BULLISH' | 'BEARISH' | None
    'compressao_detectada': bool,      # Compressão ativa
    'nivel_compressao': str | None,    # 'SEVERA' | 'MODERADA' | 'LEVE' | 'NENHUMA'
    'divergencia_rsi': str,            # 'BULLISH' | 'BEARISH' | 'NENHUMA'

    # Derivativos
    'cvd_slope': float,                # Slope dos últimos 10 CVD samples
    'book_imbalance_ratio': float | None,  # (-1.0 a 1.0)
    'divergencia_cvd': str | None,     # 'BULLISH' | 'BEARISH' | None
    'funding_medio': float | None,     # Funding rate
    'oi_subindo': bool | None,         # OI crescente
    'ls_ratio_longs': float | None,    # Proporção de longs (0.0-1.0)
    'cluster_liquidacao_acima': float | None,  # Nível de liquidação acima
    'cluster_liquidacao_abaixo': float | None, # Nível de liquidação abaixo
    'fear_greed': int | None,          # Índice 0-100 (informativo, não pontua)
}
```

### CVD Buffer (por ativo)

```python
# collections.deque(maxlen=100)
# Cada entrada: float (CVD acumulado snapshot a cada ~1 minuto)
self._cvd_buffers = {
    'BTCUSDT': deque([12345.6, 12400.1, ...], maxlen=100),
    'ETHUSDT': deque([...], maxlen=100),
}
```

### Orderbook Cache (por ativo)

```python
self._orderbook_cache = {
    'BTCUSDT': {
        'bids': [[price, qty], [price, qty], ...],  # 5 níveis
        'asks': [[price, qty], [price, qty], ...],  # 5 níveis
        'timestamp': 1700000000.0
    }
}
```

### OI Histórico (MySQL)

| Coluna     | Tipo         | Descrição                    |
|------------|--------------|------------------------------|
| id         | BIGINT AI PK | Identificador                |
| symbol     | VARCHAR(20)  | Par (ex: BTCUSDT)           |
| exchange   | VARCHAR(20)  | Exchange (default: BINANCE)  |
| oi_valor   | DOUBLE       | Valor do OI                  |
| created_at | DATETIME     | Timestamp de gravação         |

### Retorno do ScoringEngine (novo formato)

```python
{
    'score_final': int,            # 0-100, múltiplo de 5
    'vies': str,                   # LONG_FORTE | LONG_MODERADO | ... | SHORT_FORTE
    'bloco_tecnico': {
        'pontos': float,
        'maximo': 55,
        'percentual': float
    },
    'bloco_derivativos': {
        'pontos': float,
        'maximo': 45,
        'percentual': float
    },
    'flags': list[str],
    'confiabilidade': str          # ALTA | MEDIA | BAIXA
}
```


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: ATR Boundary — retorno válido na fronteira

*Para todo* conjunto de candles com `len(candles) == periodo` e valores válidos (high > low > 0, prev_close > 0), `calcular_atr(candles, periodo)` deve retornar um float positivo (não None). *Para todo* conjunto com `len(candles) < periodo`, deve retornar None.

**Valida: Requisitos 1.1, 1.2**

### Propriedade 2: Invariantes do Score Final

*Para todo* dicionário `dados_score` com valores válidos nos campos requeridos, `calcular_score(dados_score)` deve retornar um `score_final` que satisfaz simultaneamente:
- `0 <= score_final <= 100`
- `score_final % 5 == 0`
- `bloco_tecnico['pontos'] <= 55`
- `bloco_derivativos['pontos'] <= 45`

**Valida: Requisitos 11.1, 11.3, 11.12, 16.7**

### Propriedade 3: Macro e Sentimento não afetam score

*Para todo* `dados_score` válido, alterar os campos `fear_greed`, `vix`, `dxy_variacao`, `sp500_variacao`, `btc_dominancia_variacao`, `usdt_dominancia_variacao`, `correlacao_btc`, `geopolitica_score` e `sentimento_moeda_score` não deve alterar o `score_final` retornado.

**Valida: Requisito 11.2**

### Propriedade 4: ADX scoring sem zona morta

*Para todo* valor de ADX no intervalo [0, 100] e qualquer valor de `preco_subindo`, o bloco técnico deve atribuir pontuação > 0 ao componente ADX (sem zona cega onde ADX não contribui nada).

**Valida: Requisitos 14.1, 14.2, 14.3, 14.4, 14.5**

### Propriedade 5: Multiplicador de sessão — mapeamento correto

*Para toda* hora UTC no intervalo [0, 24), `obter_multiplicador_sessao()` deve retornar:
- 0.85 se hora ∈ [0, 8)
- 0.95 se hora ∈ [8, 13)
- 1.00 se hora ∈ [13, 21)
- 0.90 se hora ∈ [21, 24)

E o resultado `score * multiplicador` deve permanecer no intervalo [0, 100].

**Valida: Requisitos 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7**

### Propriedade 6: CVD buffer mantém mínimo de amostras

*Para todo* ativo com trading ativo, o buffer CVD (`deque(maxlen=100)`) deve acumular amostras. Quando `len(buffer) < 60`, `_calcular_cvd_slope_real()` deve retornar 0 (slope inválido). Quando `len(buffer) >= 60`, deve retornar o slope calculado via `calcular_cvd_slope()`.

**Valida: Requisitos 6.5, 6.6**

### Propriedade 7: OI persistence — round trip

*Para todo* par (symbol, oi_valor) válido, após `_gravar_oi_banco(symbol, oi_valor)`, uma chamada subsequente `_buscar_oi_banco(symbol)` deve retornar o mesmo valor gravado.

**Valida: Requisitos 10.1, 10.2, 10.3, 10.4, 10.5**

### Propriedade 8: Campos antes hardcoded agora populados

*Para todo* ciclo de processamento onde candles >= 20 e dados de mercado disponíveis, os campos `divergencia_rsi`, `divergencia_cvd`, `book_imbalance_ratio`, `cvd_slope`, `fear_greed` e `ls_ratio_longs` no `dados_score` devem refletir valores calculados reais (não os valores hardcoded originais: 'NENHUMA', None, 0, None, None, None respectivamente — quando dados estão disponíveis).

**Valida: Requisitos 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.5, 6.5, 7.6**

### Propriedade 9: MACD zero cross — detecção correta de cruzamento

*Para todo* par (macd_anterior, macd_atual) onde ocorre mudança de sinal:
- Se `macd_atual > 0` e `macd_anterior <= 0` → resultado deve ser 'BULLISH'
- Se `macd_atual < 0` e `macd_anterior >= 0` → resultado deve ser 'BEARISH'
- Se não há mudança de sinal → resultado deve ser None

**Valida: Requisitos 15.1, 15.2, 15.3, 15.4, 15.5**

### Propriedade 10: Book imbalance — range invariant

*Para todo* estado válido do orderbook cache (bids e asks não vazios com quantidades > 0), `_calcular_book_imbalance()` deve retornar um valor no intervalo [-1.0, 1.0].

**Valida: Requisitos 8.4, 8.5**

### Propriedade 11: Classificação de clusters de liquidação

*Para toda* lista de liquidações forçadas e preço atual:
- Liquidações LONG com preço < preço_atual devem ser classificadas como `cluster_abaixo`
- Liquidações SHORT com preço > preço_atual devem ser classificadas como `cluster_acima`
- Equal highs/lows dentro de 1.5% devem ser considerados como cluster, mas nunca sobrescrever um cluster real que esteja mais próximo do preço

**Valida: Requisitos 12.3, 12.4, 12.5, 13.2, 13.3, 13.4, 13.5**

### Propriedade 12: L/S Ratio — range válido

*Para toda* resposta válida de pelo menos uma exchange, `buscar_ls_ratio()` deve retornar um float no intervalo [0.0, 1.0] representando a proporção de longs.

**Valida: Requisitos 7.1, 7.6, 7.7**

## Tratamento de Erros

### Estratégia Geral

O sistema adota a filosofia **"degrade gracefully"** — falhas em fontes individuais de dados não devem interromper o pipeline completo.

### Erros por Componente

| Componente | Erro | Comportamento |
|------------|------|---------------|
| Fear & Greed API | Timeout/5xx | Retorna último cache ou None |
| L/S Ratio (4 exchanges) | Todas falham | Retorna None, campo não pontua |
| L/S Ratio (parcial) | 1-3 exchanges falham | Média das que responderam |
| Liquidações API | Erro/indisponível | Retorna None para clusters |
| aggTrade WebSocket | Desconexão | Reconecta automaticamente, CVD slope = 0 temporariamente |
| depth5 WebSocket | Desconexão | Reconecta automaticamente, book_imbalance = None |
| MySQL (OI) | Conexão falha | Usa cache em memória como fallback |
| MySQL (OI) | Tabela inexistente | Cria tabela via CREATE IF NOT EXISTS na inicialização |
| calcular_atr | Candles insuficientes | Retorna None, compressão não ativa |
| calcular_macd (anterior) | Candles insuficientes | macd_cruza_zero = None |

### Invariante de Não-Interrupção

Nenhum erro em fonte de dados externa deve causar exceção não tratada no `processar_candle()`. Todos os métodos de busca externa usam try/except com logging e retorno de fallback (None ou valor em cache).

## Estratégia de Testes

### Abordagem Dual

O sistema será testado com duas abordagens complementares:

1. **Testes de Propriedade (Property-Based Testing)** — verificam invariantes universais em entradas geradas aleatoriamente
2. **Testes Unitários** — verificam exemplos específicos, edge cases e integrações

### Biblioteca de Property-Based Testing

**Hypothesis** (Python) — biblioteca padrão para PBT em Python.

```python
from hypothesis import given, settings
from hypothesis import strategies as st
```

### Configuração de Testes de Propriedade

- **Mínimo 100 iterações** por teste de propriedade
- Cada teste tagueado com referência à propriedade do design:
  - Formato: `# Feature: audit-assertiveness-engine, Property {N}: {título}`
- Cada propriedade de corretude implementada por **um único teste de propriedade**

### Testes de Propriedade Planejados

| # | Propriedade | Estratégia de Geração |
|---|-------------|----------------------|
| 1 | ATR Boundary | Gerar candles aleatórios com high > low > 0, tamanho = periodo e < periodo |
| 2 | Invariantes do Score | Gerar dados_score com campos em ranges válidos |
| 3 | Macro não afeta score | Gerar dados_score, variar campos macro, comparar scores |
| 4 | ADX sem zona morta | Gerar ADX ∈ [0, 100] e preco_subindo ∈ {True, False} |
| 5 | Multiplicador sessão | Gerar hora ∈ [0, 24) |
| 6 | CVD buffer mínimo | Gerar sequências de trades, verificar threshold de 60 |
| 7 | OI round trip | Gerar (symbol, oi_valor), gravar e ler |
| 8 | Campos populados | Gerar candles ≥ 20 com dados de mercado, verificar non-None |
| 9 | MACD zero cross | Gerar pares (macd_anterior, macd_atual) com mudança de sinal |
| 10 | Book imbalance range | Gerar orderbooks com bids/asks > 0 |
| 11 | Clusters liquidação | Gerar liquidações + preço, verificar classificação |
| 12 | L/S Ratio range | Gerar respostas de APIs, verificar [0, 1] |

### Testes Unitários Planejados

- **Edge case**: `calcular_atr` com exatamente `periodo` candles (fix verification)
- **Edge case**: `detectar_compressao_volatilidade` com 5 candles recentes
- **Exemplo**: Import do monitor_worker sem NameError
- **Edge case**: Fear & Greed cache expiry (mock time)
- **Edge case**: Todas APIs de L/S ratio falham → None
- **Edge case**: Orderbook vazio → None
- **Exemplo**: Score = 73 arredonda para 75; Score = 72 arredonda para 70
- **Integração**: Worker processa candle e gera score com dados reais
- **Edge case**: CVD buffer com < 60 amostras retorna slope 0
- **Exemplo**: Sessão Ásia (UTC 03:00) → multiplicador 0.85

### Estrutura de Arquivos de Teste

```
monitor/
├── tests/
│   ├── test_properties.py          # Todos os testes de propriedade (Hypothesis)
│   ├── test_indicator_engine.py    # Unitários do indicatorEngine
│   ├── test_scoring_engine.py      # Unitários do scoringEngine
│   └── test_monitor_worker.py      # Unitários + integração do worker
```
