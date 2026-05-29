# Design — Gênesis 2.0: 8 Passos Críticos (Pós-Auditoria)

## Visão Geral

Este documento descreve o design técnico para os 8 passos críticos do Gênesis 2.0 identificados na auditoria. O escopo abrange:

1. **Migrations Laravel** — colunas ATH nas 3 carteiras + tabelas de alertas Telegram
2. **Correção tamanhoSugerido** — nunca retornar "$0.00"
3. **Eliminação localStorage** — histórico exclusivamente via MySQL
4. **Mapeamento TP2/TP3** — círculos sem "N/A"
5. **Rota proxy /api/price/:symbol** — preços via servidor (nunca frontend direto)
6. **Reescrita checkPrices** — proxy + progresso circular TP1/TP2/TP3/Stop
7. **ATH no polling** — atualização automática de max_price
8. **Micro Radar** — 75 créditos + tooltip + débito real via bavix/wallet

### Decisões Arquiteturais

| Decisão | Justificativa |
|---------|---------------|
| Migrations no Laravel (genesis-api) | Padrão do projeto; controle de versão do schema |
| Proxy de preços no Laravel (PriceController) | Backend centralizado; evitar dependência do BFF Node |
| Créditos via bavix/wallet | User model já implementa HasWallet + HasWalletFloat |
| Cálculo tamanhoSugerido no Laravel | GeminiAnalysisService.php já contém a lógica |
| Polling ATH no hook useMonitoramentoCarteira | Hook já faz polling a cada 30s; adicionar lógica ATH |

## Arquitetura

```mermaid
graph TD
    subgraph Frontend [React + TypeScript]
        AHD[AnalysisHistoryDashboard]
        CS[ConfluenceScore / Micro Radar]
        MC[useMonitoramentoCarteira]
        GP[GenesisPage]
    end

    subgraph Backend [Laravel - genesis-api]
        GAS[GeminiAnalysisService]
        WALLET[bavix/wallet]
        MIGRATIONS[Migrations]
        PROXY[GET /api/price/{symbol}]
        HIST_PUT[PUT /api/historico-analises/{id}]
        CRED[POST /api/creditos/debitar]
        SALVAR[POST /api/salvar-analise]
        HIST_GET[GET /api/historico-analises]
        HIST_DEL[DELETE /api/historico-analises/{id}]
    end

    subgraph DB [MySQL Hostinger]
        CM[genesis_carteira_mae]
        CG[genesis_carteira_gemas]
        CMB[genesis_carteira_membro]
        ATC[genesis_alertas_telegram_config]
        ATE[genesis_alertas_telegram_estado]
        GA[genesis_analises]
        WALLETS_T[wallets + transactions]
    end

    subgraph Exchanges [APIs Públicas]
        BIN[Binance]
        BYB[Bybit]
        OKX[OKX]
        BTG[Bitget]
    end

    AHD -->|fetch prices| PROXY
    AHD -->|update resultado| HIST_PUT
    AHD -->|load history| HIST_GET
    AHD -->|save analysis| SALVAR
    AHD -->|delete| HIST_DEL
    CS -->|debitar creditos| CRED
    MC -->|fetch prices| PROXY
    MC -->|update ATH| HIST_PUT

    PROXY --> BIN
    PROXY --> BYB
    PROXY --> OKX
    PROXY --> BTG

    HIST_PUT --> GA
    HIST_GET --> GA
    SALVAR --> GA
    CRED --> WALLET
    WALLET --> WALLETS_T

    MIGRATIONS --> CM
    MIGRATIONS --> CG
    MIGRATIONS --> CMB
    MIGRATIONS --> ATC
    MIGRATIONS --> ATE

    GAS -->|calcula tamanhoSugerido| GA
```

## Componentes e Interfaces

### 1. Migration: Colunas ATH (Laravel)

**Arquivo:** `genesis-api/database/migrations/2026_05_28_000001_add_ath_columns_to_carteiras.php`

```php
// Adiciona colunas ATH às 3 tabelas de carteira
Schema::table('genesis_carteira_mae', function (Blueprint $table) {
    $table->decimal('max_price', 24, 12)->nullable()->after('preco_atual');
    $table->dateTime('max_price_date')->nullable()->after('max_price');
    $table->decimal('max_variation_pct', 10, 2)->nullable()->after('max_price_date');
});
// Repetir para genesis_carteira_gemas e genesis_carteira_membro
```

### 2. Migration: Tabelas Telegram (Laravel)

**Arquivo:** `genesis-api/database/migrations/2026_05_28_000002_create_telegram_alert_tables.php`

```php
// genesis_alertas_telegram_config
Schema::create('genesis_alertas_telegram_config', function (Blueprint $table) {
    $table->id();
    $table->enum('wallet_type', ['mae', 'gemas']);
    $table->tinyInteger('ativo')->default(1);
    $table->decimal('threshold_minimo', 10, 2)->default(10);
    $table->decimal('gap_minimo', 10, 2)->default(3);
    $table->decimal('intervalo_horas', 4, 1)->default(1);
    $table->text('template')->nullable();
    $table->dateTime('atualizado_em')->nullable();
    $table->unique('wallet_type');
});

// genesis_alertas_telegram_estado
Schema::create('genesis_alertas_telegram_estado', function (Blueprint $table) {
    $table->id();
    $table->enum('wallet_type', ['mae', 'gemas']);
    $table->unsignedInteger('wallet_asset_id');
    $table->decimal('ultimo_alerta_pct', 10, 2)->default(0);
    $table->dateTime('ultima_verificacao')->nullable();
    $table->dateTime('ultimo_disparo')->nullable();
    $table->unsignedInteger('total_disparos')->default(0);
    $table->unique(['wallet_type', 'wallet_asset_id']);
});

// Seed com templates padrão
DB::table('genesis_alertas_telegram_config')->insert([
    ['wallet_type' => 'mae', 'ativo' => 1, 'threshold_minimo' => 10, 'gap_minimo' => 3, 'intervalo_horas' => 1, 'template' => '🚀 {ativo} atingiu +{pct}% na Carteira Mãe!', 'atualizado_em' => now()],
    ['wallet_type' => 'gemas', 'ativo' => 1, 'threshold_minimo' => 10, 'gap_minimo' => 3, 'intervalo_horas' => 1, 'template' => '💎 {ativo} atingiu +{pct}% na Carteira Gemas!', 'atualizado_em' => now()],
]);
```

### 3. Correção tamanhoSugerido (Laravel)

**Arquivo:** `genesis-api/app/Services/GeminiAnalysisService.php`

Lógica atual (linha ~212):
```php
if ($entryValue > 0 && !empty($setupMatematico['setup']['entrada'])) { ... }
```

Correção — adicionar fallback quando `$entryValue` é 0 ou vazio:
```php
$margemBase = ($entryValue > 0) ? $entryValue : 100; // Demo margin $100
$valorTotal = $margemBase * $leverage;
// Sempre calcular, nunca retornar $0.00
$result['execucao']['setup']['tamanhoSugerido'] = ...;
```

### 4. Rota GET /api/price/{symbol} (Laravel)

**Arquivos:**
- `genesis-api/app/Services/PriceProxyService.php` — lógica de fallback entre exchanges
- `genesis-api/app/Http/Controllers/Api/PriceController.php` — controller da rota
- `genesis-api/routes/api.php` — registro da rota

```php
// PriceProxyService.php
// Tenta exchanges em ordem: Binance → Bybit → OKX → Bitget
// Usa Http facade com timeout de 5s por exchange
// Retorna ['price' => float, 'exchange' => string, 'symbol' => string, 'timestamp' => ISO]
```

Fallback order: Binance → Bybit → OKX → Bitget. Retorna 502 se todas falharem.

### 5. Rota PUT /api/historico-analises/{id} (Laravel)

**Arquivo:** `genesis-api/app/Http/Controllers/Api/AnaliseController.php`

Adicionar método `atualizarResultado($id)` que atualiza `resultado`, `preco_resultado`, `data_resultado` na tabela `genesis_analises`. Retorna 404 se id não existir.

### 6. Rota POST /api/creditos/debitar (Laravel)

**Arquivo:** `genesis-api/app/Http/Controllers/Api/CreditController.php`

O controller já existe com método `consume($type)` que usa bavix/wallet. Já possui:
- Verificação de saldo (`$user->balanceFloat <= 0`)
- Proteção anti-duplicação (verifica transação nos últimos 20s com mesma descrição)
- Padrão de tipos via `setting()` para custo configurável

Alteração — adicionar tipo `micro_radar`:
```php
// Adicionar ao CreditController::consume()
}elseif($type=="micro_radar"){
    $amount = setting('cost_micro_radar_credits');
    $description = "Micro Radar";
}
```

Reforço de idempotência — aceitar `idempotency_key` opcional:
```php
// Antes do withdrawFloat, verificar idempotency_key se fornecido
$idempotencyKey = request()->input('idempotency_key');
if ($idempotencyKey) {
    $existing = Transaction::where('payable_id', Auth::user()->id)
        ->where('meta->idempotency_key', $idempotencyKey)
        ->first();
    if ($existing) {
        return responder()->success(["credits" => $user->balanceFloat])->respond();
    }
}

// No withdrawFloat, incluir idempotency_key na meta
$user->withdrawFloat($amount, ['description' => $description, 'idempotency_key' => $idempotencyKey]);
```

**Setting:** Adicionar `cost_micro_radar_credits = 75` na tabela settings.

**Frontend (ConfluenceScore.tsx) — proteção contra double-click:**
```tsx
// Estado de loading para bloquear cliques duplicados
const [isDebiting, setIsDebiting] = useState(false);

const handleAnalyze = async () => {
  if (isDebiting) return; // Ignorar cliques durante request
  setIsDebiting(true);
  const idempotencyKey = crypto.randomUUID(); // Chave única por ação
  try {
    const res = await fetch('/api/creditos/consume/micro_radar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idempotency_key: idempotencyKey }),
    });
    // ...
  } finally {
    setIsDebiting(false);
  }
};
```

### 7. Reescrita checkPrices (Frontend)

**Arquivo:** `G-nesis-2.0-main/components/AnalysisHistoryDashboard.tsx`

- Remover chamada direta a `https://api.binance.com/api/v3/ticker/price`
- Usar `GET /api/price/:symbol` para cada símbolo pendente
- Calcular progresso percentual para TP1, TP2, TP3, Stop
- Remover todo uso de `localStorage`

Fórmulas de progresso:
- LONG: `clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100)`
- SHORT: `clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100)`

### 8. ATH no Polling (Frontend)

**Arquivo:** `G-nesis-2.0-main/hooks/useMonitoramentoCarteira.ts`

Adicionar lógica: se `preco_atual > max_price` (ou `max_price` é null/0), enviar PUT para atualizar ATH no banco.

### 9. Micro Radar (Frontend)

**Arquivo:** `G-nesis-2.0-main/components/ConfluenceScore.tsx`

- Alterar "50 creditos" → "75 creditos"
- Adicionar tooltip com padrão group-hover (igual FundingMonitor.tsx)
- No `handleAnalyze`: POST /api/creditos/debitar com amount=75 antes de navegar
- Se falhar (402 ou erro): exibir mensagem de erro, não navegar

## Modelos de Dados

### Colunas ATH (adicionadas às 3 tabelas de carteira)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| max_price | DECIMAL(24,12) | Preço máximo histórico registrado |
| max_price_date | DATETIME | Data/hora do último ATH |
| max_variation_pct | DECIMAL(10,2) | Variação percentual do ATH vs entrada |

### genesis_alertas_telegram_config

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | Auto-increment |
| wallet_type | ENUM('mae','gemas') | Tipo de carteira (UNIQUE) |
| ativo | TINYINT(1) DEFAULT 1 | Se alertas estão ativos |
| threshold_minimo | DECIMAL(10,2) DEFAULT 10 | % mínimo para primeiro alerta |
| gap_minimo | DECIMAL(10,2) DEFAULT 3 | Gap % entre alertas consecutivos |
| intervalo_horas | DECIMAL(4,1) DEFAULT 1 | Intervalo mínimo entre disparos |
| template | TEXT | Template da mensagem Telegram |
| atualizado_em | DATETIME | Última atualização da config |

### genesis_alertas_telegram_estado

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT PK | Auto-increment |
| wallet_type | ENUM('mae','gemas') | Tipo de carteira |
| wallet_asset_id | INT | ID do ativo na carteira |
| ultimo_alerta_pct | DECIMAL(10,2) DEFAULT 0 | Último % alertado |
| ultima_verificacao | DATETIME | Última verificação |
| ultimo_disparo | DATETIME | Último disparo de alerta |
| total_disparos | INT DEFAULT 0 | Contador de disparos |
| UNIQUE KEY | (wallet_type, wallet_asset_id) | Constraint composta |

### Resposta /api/price/:symbol

```json
{
    "price": 67432.50,
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "timestamp": "2025-05-28T14:30:00.000Z"
}
```

### Resposta /api/creditos/debitar

```json
// Sucesso
{ "success": true, "saldo_restante": 425 }

// Erro 402
{ "success": false, "error": "Créditos insuficientes. Saldo: 50, necessário: 75" }
```


## Propriedades de Corretude

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas de um sistema — essencialmente, uma declaração formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de corretude verificáveis por máquina.*

### Propriedade 1: Cálculo de tamanhoSugerido nunca produz zero

*Para qualquer* combinação de entryValue (incluindo 0 ou vazio) e leverage (≥ 1), o cálculo de tamanhoSugerido deve usar `max(entryValue, 100) * leverage`, resultando sempre em um valor positivo.

**Valida: Requisitos 2.1, 2.2**

### Propriedade 2: Formatação de tamanhoSugerido

*Para qualquer* valor numérico positivo de tamanhoSugerido, a string formatada deve corresponder ao padrão `$X.XX` (com exatamente duas casas decimais) e o valor numérico extraído deve ser > 0.

**Valida: Requisitos 2.3, 2.5**

### Propriedade 3: Mapeamento TP2/TP3 com parseFloat e fallback

*Para qualquer* valor de take_profit_2 ou take_profit_3 vindo do banco (incluindo null, undefined, string numérica, ou 0), o mapeamento via `parseFloat(value) || 0` deve produzir um número ≥ 0, e a condição de renderização `(value !== undefined && value !== null)` deve permitir exibir o círculo com 0% quando o valor é zero.

**Valida: Requisitos 4.1, 4.2**

### Propriedade 4: Resposta do proxy de preços contém campos obrigatórios

*Para qualquer* símbolo válido consultado via GET /api/price/:symbol que retorne sucesso, a resposta JSON deve conter os campos `price` (number > 0), `exchange` (string não-vazia), `symbol` (string não-vazia), e `timestamp` (string ISO válida).

**Valida: Requisitos 5.1, 5.4**

### Propriedade 5: Fallback de exchanges em ordem

*Para qualquer* cenário onde N exchanges consecutivas falham (0 ≤ N ≤ 3), o proxy deve tentar a próxima exchange na ordem Binance → Bybit → OKX → Bitget e retornar o preço da primeira que responder com sucesso.

**Valida: Requisito 5.2**

### Propriedade 6: Respostas de erro não expõem dados internos

*Para qualquer* resposta de erro do proxy de preços ou das rotas do servidor, o corpo da resposta não deve conter API keys, stack traces, ou URLs internas de exchanges.

**Valida: Requisito 5.7**

### Propriedade 7: Progresso percentual clamped entre 0 e 100

*Para qualquer* posição (LONG ou SHORT) com preço de entrada, preço atual, e preço alvo válidos, a fórmula de progresso deve produzir um valor no intervalo [0, 100]. Para LONG: `clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100)`. Para SHORT: `clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100)`.

**Valida: Requisitos 6.2, 6.6, 6.7**

### Propriedade 8: ATH atualizado quando preço supera máximo

*Para qualquer* ativo com preco_atual > max_price (ou max_price null/zero), o sistema deve calcular max_variation_pct como `((preco_atual - preco_entrada) / preco_entrada) * 100` e o novo max_price deve ser igual ao preco_atual.

**Valida: Requisitos 7.1, 7.2**

### Propriedade 9: Persistência de análise via API (round-trip)

*Para qualquer* objeto de análise válido, salvar via POST /api/salvar-analise e depois buscar via GET /api/historico-analises deve retornar um registro contendo os mesmos campos (ativo, timeframe, direcao, score, stop_loss, take_profit_1).

**Valida: Requisitos 3.2, 3.4**

### Propriedade 10: Débito de créditos com saldo insuficiente

*Para qualquer* usuário cujo saldo bavix/wallet é menor que o valor solicitado (75), a rota POST /api/creditos/debitar deve retornar HTTP 402 e o saldo não deve ser alterado.

**Valida: Requisitos 8.4, 8.6**

### Propriedade 11: Débito de créditos com saldo suficiente

*Para qualquer* usuário cujo saldo bavix/wallet é ≥ 75, após POST /api/creditos/debitar com amount=75, o novo saldo deve ser exatamente `saldo_anterior - 75`.

**Valida: Requisitos 8.3, 8.5**

### Propriedade 12: Atualização de resultado via PUT

*Para qualquer* análise com id válido e payload contendo resultado, preco_resultado e data_resultado, o PUT /api/historico-analises/:id deve atualizar o registro e retornar sucesso. Para id inválido, deve retornar 404.

**Valida: Requisitos 5.5, 5.6, 6.3**

## Tratamento de Erros

| Cenário | Comportamento | HTTP Code |
|---------|---------------|-----------|
| Todas exchanges falham no proxy | Retorna erro descritivo | 502 |
| ID inválido no PUT /historico-analises | Retorna "Análise não encontrada" | 404 |
| Créditos insuficientes | Retorna saldo atual e necessário | 402 |
| Token JWT ausente/inválido | Retorna "Não autorizado" | 401 |
| Banco de dados indisponível | Retorna "Serviço temporariamente indisponível" | 503 |
| entryValue negativo | Tratar como 0 (usar demo margin $100) | — |
| Símbolo não encontrado em nenhuma exchange | Retorna "Símbolo não encontrado" | 404 |
| Erro de rede no polling ATH | Log warning, não interromper polling | — |
| Erro no débito de créditos (Micro Radar) | Exibir toast de erro, bloquear navegação | — |

### Regras de Erro no Frontend

- Erros de rede no polling de preços: silenciar (console.warn), tentar novamente no próximo ciclo
- Erros 402 (créditos): exibir mensagem clara ao usuário
- Erros 401: redirecionar para login
- Erros 5xx: exibir toast genérico "Erro no servidor, tente novamente"

## Estratégia de Testes

### Abordagem Dual

O projeto utiliza **testes unitários** e **testes baseados em propriedades** de forma complementar:

- **Testes unitários**: exemplos específicos, edge cases, integração entre componentes
- **Testes de propriedade**: propriedades universais verificadas com inputs aleatórios

### Biblioteca de Property-Based Testing

- **Frontend (TypeScript)**: `fast-check` (já disponível via vitest.config.ts no projeto)
- **Backend (PHP/Laravel)**: `eris/eris` ou testes unitários com data providers extensivos

### Configuração

- Mínimo **100 iterações** por teste de propriedade
- Cada teste deve referenciar a propriedade do design com tag:
  - Formato: **Feature: genesis-critical-steps, Property {N}: {título}**

### Testes de Propriedade (PBT)

| Propriedade | Gerador | Verificação |
|-------------|---------|-------------|
| P1: tamanhoSugerido ≠ 0 | `fc.float({min: 0, max: 1000000})` × `fc.integer({min: 1, max: 125})` | resultado > 0 |
| P2: Formatação | `fc.float({min: 0.01, max: 1e9})` | regex `^\$[\d,]+\.\d{2}$` e parse > 0 |
| P3: Mapeamento TP | `fc.oneof(fc.constant(null), fc.constant(undefined), fc.float(), fc.constant('0'))` | resultado é number ≥ 0 |
| P4: Resposta proxy | `fc.string()` (símbolos válidos) | campos obrigatórios presentes |
| P5: Fallback exchanges | `fc.array(fc.boolean(), {minLength: 4, maxLength: 4})` | primeira true retorna preço |
| P7: Progresso clamped | `fc.record({entry: fc.float({min:0.01}), current: fc.float({min:0.01}), target: fc.float({min:0.01})})` | 0 ≤ resultado ≤ 100 |
| P8: ATH update | `fc.record({preco_atual: fc.float({min:0.01}), max_price: fc.float({min:0}), preco_entrada: fc.float({min:0.01})})` | variação calculada corretamente |
| P10/P11: Créditos | `fc.record({saldo: fc.integer({min:0, max:1000}), amount: fc.constant(75)})` | saldo < 75 → 402; saldo ≥ 75 → novo saldo correto |

### Testes Unitários (Exemplos e Edge Cases)

| Teste | Tipo | Descrição |
|-------|------|-----------|
| Migration ATH columns exist | example | Verificar schema após migration |
| Migration Telegram tables exist | example | Verificar tabelas criadas |
| Migration seeds default templates | example | Verificar 2 rows inseridas |
| History page loads from server | example | Mock API, verificar fetch chamado |
| Clear history sends DELETE | example | Mock API, verificar DELETE chamado |
| All exchanges fail → 502 | edge-case | Simular timeout em todas |
| Invalid PUT id → 404 | edge-case | Enviar id inexistente |
| max_price null → usar preco_atual | edge-case | Ativo sem ATH prévio |
| TP value = 0 → render circle 0% | edge-case | Verificar que zero não é tratado como falsy |
| "75 creditos" displayed | example | Verificar texto no componente |
