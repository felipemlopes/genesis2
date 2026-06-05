# Design Document: Micro Radar Paywall

## Overview

Este design transforma o Micro Radar de um sistema de alertas gratuito para um produto monetizado com paywall. Os campos sensíveis (ativo, corretora, preço) ficam ocultos até o usuário pagar 50 créditos. A UI muda de popups flutuantes para uma feed vertical de até 5 cards dentro do componente ConfluenceScore. A engine de detecção Python permanece intacta.

### Decisões de Design

1. **Paywall server-side**: O backend omite campos protegidos na resposta do poll, garantindo segurança independente do frontend.
2. **Sem SSE**: Mantém polling HTTP a cada 10s (simplicidade e compatibilidade com `artisan serve`).
3. **Idempotência via UUID**: O frontend gera um UUID por tentativa de reveal; o backend rejeita duplicatas.
4. **Expiração calculada no worker**: O campo `expires_at` é pré-computado pelo Python worker no INSERT, evitando cálculos no frontend.
5. **Feed inline**: Os cards são renderizados dentro de ConfluenceScore.tsx, eliminando o AlertaPopup flutuante.

## Architecture

```mermaid
flowchart TD
    subgraph Python Worker
        WS[WebSocket Market Data] --> DET[Detection Engine]
        DET --> DB[(MySQL: genesis_alertas)]
    end

    subgraph Laravel Backend
        POLL[GET /v1/alertas/poll] --> FILTER{revelado_por == user?}
        FILTER -->|Sim| FULL[Retorna payload completo]
        FILTER -->|Não| MASKED[Omite ativo/corretora/preco_atual]
        REVEAL[POST /v1/alertas/{id}/reveal] --> DEBIT[Debita 50 créditos]
        DEBIT --> MARK[Seta revelado_por + revelado_em]
    end

    subgraph React Frontend
        HOOK[useAlertas hook] -->|poll 10s| POLL
        HOOK --> FEED[RadarFeed: max 5 cards]
        FEED --> CARD[AlertCard]
        CARD -->|click Revelar| REVEAL
        REVEAL -->|success| NAV[Navigate /dashboard?params]
    end
```

## Components and Interfaces

### Frontend Components

#### 1. `ConfluenceScore.tsx` (refatorado)
- Mantém radar SVG animado
- Expande layout para incluir a RadarFeed vertical
- Remove lógica de "single alert" atual
- Props: `onRevealSuccess?: (symbol, exchange, timeframe, radarId) => void`

#### 2. `RadarFeed` (novo, inline em ConfluenceScore ou sub-componente)
- Renderiza lista de até 5 `AlertCard` em stack vertical
- Estado idle quando `alertas.length === 0`
- Ordena: mais recente no topo

#### 3. `AlertCard` (novo componente)
- Exibe: score, tipo, direção, motivos (badges), timeframes ativos, confluence badge, timestamp
- Oculta: ativo, corretora, preço (campos `null` no payload quando não revelado)
- Botão "Revelar e Analisar — 50 créditos"
- Badge "EXPIRADO" + opacidade reduzida se `expires_at < now`
- Confluence badge colorido baseado em `timeframes.length`

#### 4. `useAlertas.ts` (refatorado)
- Remove auto-dismiss de 12s (cards ficam na feed até sair do limite de 5)
- Remove `dispararAlertaTeste` / `limparAlertasTeste` (dev preview removido com AlertaPopup)
- Interface `AlertaGenesis` atualizada com campos opcionais: `ativo?`, `corretora?`, `preco_atual?`
- Novos campos obrigatórios: `motivos`, `timeframes`, `expires_at`
- Mantém polling de 10s

#### 5. Remoção de `AlertaPopup.tsx` e `OportunidadePopup.tsx`
- Deletar componentes
- Remover imports/renders no layout

### Backend

#### 6. `AlertaController@poll` (refatorado)
- Consulta alertas das últimas 24h (evita payload enorme)
- Para cada alerta: se `revelado_por === auth()->id()`, inclui `ativo`, `corretora`, `preco_atual`; senão omite
- Sempre inclui: `id`, `tipo`, `direcao`, `score`, `motivos`, `timeframes`, `criado_em`, `expires_at`, `urgencia`, `mensagem`

#### 7. `AlertaController@reveal` (novo endpoint)
- `POST /v1/alertas/{id}/reveal`
- Body: `{ idempotency_key: string }`
- Valida saldo >= 50
- Debita 50 créditos (via serviço existente)
- Seta `revelado_por = user_id`, `revelado_em = now()`
- Retorna `{ ativo, corretora, preco_atual, timeframes }` para redirect imediato

#### 8. Migration
- Adiciona `motivos` (JSON), `timeframes` (JSON), `expires_at` (timestamp), `revelado_por` (int nullable FK users), `revelado_em` (timestamp nullable) na tabela `genesis_alertas`

### Python Worker

#### 9. `monitor_worker.py` — `gravar_banco()` atualizado
- Adiciona `motivos` (JSON array de objetos `{label, value}`), `timeframes` (JSON array de strings), `expires_at` (created_at + 4h) ao INSERT
- Detection logic não muda

### API Interfaces

```typescript
// GET /v1/alertas/poll response (por alerta)
interface AlertaPollItem {
  id: number;
  tipo: string;
  direcao: 'BULLISH' | 'BEARISH' | 'NEUTRO';
  score: number;
  motivos: { label: string; value: string }[];
  timeframes: string[];
  urgencia: string;
  mensagem: string;
  criado_em: string;
  expires_at: string;
  // Campos condicionais (só presentes se revelado pelo user)
  ativo?: string;
  corretora?: string;
  preco_atual?: number;
}

// POST /v1/alertas/{id}/reveal
interface RevealRequest {
  idempotency_key: string;
}

interface RevealResponse {
  success: boolean;
  ativo: string;
  corretora: string;
  preco_atual: number;
  timeframes: string[];
  credits_remaining: number;
}
```

## Data Models

### Tabela `genesis_alertas` (pós-migração)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | BIGINT AUTO_INCREMENT | PK |
| ativo | VARCHAR(50) | Símbolo (ex: BTCUSDT) |
| tipo | VARCHAR(50) | Tipo de anomalia |
| mensagem | TEXT | Descrição legível |
| direcao | ENUM('BULLISH','BEARISH','NEUTRO') | Direção |
| urgencia | ENUM('ALTA','MEDIA','BAIXA') | Urgência |
| corretora | VARCHAR(50) | Exchange |
| timeframe | VARCHAR(10) | Timeframe principal (legado) |
| preco_atual | DECIMAL(18,8) | Preço no momento da detecção |
| variacao_pct | DECIMAL(8,4) | Variação percentual |
| score | INT | Score de confiança |
| motivos | JSON | Array de motivos `[{label, value}]` |
| timeframes | JSON | Array de timeframes confirmados `["15m","1h"]` |
| expires_at | TIMESTAMP | `created_at + 4 horas` |
| revelado_por | INT NULLABLE | FK → users.id |
| revelado_em | TIMESTAMP NULLABLE | Quando foi revelado |
| enviado_sse | TINYINT(1) | Flag legado |
| enviado_telegram | TINYINT(1) | Flag legado |
| created_at | TIMESTAMP | Criação |
| updated_at | TIMESTAMP | Atualização |

### Interface Frontend `AlertaGenesis` (atualizada)

```typescript
export interface AlertaGenesis {
  id: number;
  tipo: string;
  direcao: 'BULLISH' | 'BEARISH' | 'NEUTRO';
  score: number;
  motivos: { label: string; value: string }[];
  timeframes: string[];
  urgencia: string;
  mensagem: string;
  criado_em: string;
  expires_at: string;
  // Paywall — null/undefined até reveal
  ativo?: string;
  corretora?: string;
  preco_atual?: number;
  // Metadata
  revelado?: boolean;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Poll endpoint field masking

*For any* alert in the poll response and any authenticated user, if `revelado_por` is NULL or does not equal the user's ID, then the response payload for that alert SHALL NOT contain the keys `ativo`, `corretora`, or `preco_atual`. Conversely, if `revelado_por` equals the user's ID, those three keys SHALL be present with their stored values.

**Validates: Requirements 1.1, 1.2, 10.2, 10.3**

### Property 2: Poll endpoint always includes public fields

*For any* alert in the poll response, regardless of reveal status, the payload SHALL always contain the keys: `id`, `tipo`, `direcao`, `score`, `motivos`, `timeframes`, `urgencia`, `mensagem`, `criado_em`, and `expires_at`.

**Validates: Requirements 10.1**

### Property 3: Unrevealed alert card renders only permitted data

*For any* alert where `ativo`, `corretora`, and `preco_atual` are absent (unrevealed), the rendered AlertCard output SHALL contain the score, motivos, timeframes, direction, type, and timestamp, and SHALL NOT contain any asset symbol, exchange name, or current price string.

**Validates: Requirements 1.3, 1.4**

### Property 4: Credit debit exactness

*For any* user with a credit balance >= 50, performing a reveal SHALL reduce their balance by exactly 50. *For any* user with balance < 50, attempting a reveal SHALL fail and leave the balance unchanged.

**Validates: Requirements 3.1, 3.3**

### Property 5: Feed displays at most 5 most recent alerts

*For any* list of N alerts (N >= 0), the RadarFeed SHALL display exactly min(N, 5) cards, and those cards SHALL be the ones with the most recent `criado_em` timestamps, ordered from newest to oldest.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Confluence badge mapping

*For any* alert with a `timeframes` array of length L: if L == 1, badge is green with no label; if L == 2, badge is yellow with label "CONFLUÊNCIA"; if L == 3, badge is orange with label "CONFLUÊNCIA FORTE"; if L >= 4, badge is red/pulsing with label "CONFLUÊNCIA MÁXIMA".

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 7: Expiration visual state

*For any* alert, if `criado_em` is more than 4 hours before the current time, the card SHALL render with reduced opacity and an "EXPIRADO" badge. If `criado_em` is less than 4 hours old, the card SHALL render at full opacity without an expiration badge.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 8: Reveal marks database correctly

*For any* successful reveal operation, the alert's `revelado_por` SHALL equal the authenticated user's ID and `revelado_em` SHALL be set to a timestamp within seconds of the current time.

**Validates: Requirements 7.1**

### Property 9: Reveal redirect URL construction

*For any* revealed alert with fields `ativo`, `corretora`, and `timeframes[0]`, the redirect URL SHALL be `/nova-analise?symbol={ativo}&exchange={corretora}&timeframe={timeframes[0]}&radar_id={alert_id}`.

**Validates: Requirements 7.2**

### Property 10: Idempotency prevents double debit

*For any* reveal request, submitting the same `idempotency_key` twice SHALL result in exactly one credit debit (the second call returns success without charging again).

**Validates: Requirements 7.3**

### Property 11: Worker populates new fields correctly

*For any* alert saved by the Python worker: `motivos` SHALL be a valid JSON array where each element has at least `label` and `value` keys; `timeframes` SHALL be a JSON array containing only strings from the set {"15m", "1h", "4h", "12h", "1d"}; `expires_at` SHALL equal `created_at + 4 hours` exactly.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 12: New alerts appear in feed

*For any* new alert arriving via polling, if the feed has fewer than 5 cards, the alert SHALL appear in the feed. If the feed already has 5 cards, the new alert SHALL replace the oldest card.

**Validates: Requirements 2.3**

## Error Handling

| Cenário | Comportamento |
|---------|---------------|
| Polling falha (rede) | Hook silencia erro, retenta no próximo ciclo de 10s. Feed mantém último estado. |
| Reveal falha (rede) | Mostra mensagem "Erro de rede. Tente novamente." no card. Botão reabilita para retry. Idempotency key garante que retry não duplica cobrança. |
| Saldo insuficiente (< 50) | Backend retorna 422 com `{error: "Créditos insuficientes"}`. Frontend mostra inline no card. |
| Idempotency key duplicada | Backend retorna 200 com os dados do reveal já feito (sem debitar novamente). |
| Alert não encontrado no reveal | Backend retorna 404. Frontend mostra erro genérico. |
| Worker falha ao gravar | Worker loga erro e continua monitorando. Alert perdido (aceito — não bloqueia detecção). |
| JSON inválido em motivos/timeframes | Backend valida no poll e retorna arrays vazios como fallback. Frontend renderiza card sem badges de motivo. |

## Testing Strategy

### Property-Based Testing

- **Library**: `fast-check` (TypeScript/frontend), PHPUnit com data providers (backend)
- **Minimum iterations**: 100 por propriedade
- **Tag format**: `Feature: micro-radar-paywall, Property {N}: {título}`

Cada propriedade de correctness acima DEVE ser implementada como um único teste property-based:

1. **Property 1 & 2** (Backend): Testar o serializer/transformer do poll endpoint com alertas gerados aleatoriamente e estados de reveal variados
2. **Property 3** (Frontend): Testar o componente AlertCard com dados aleatórios de alerta não-revelado e verificar output
3. **Property 4** (Backend): Testar o endpoint reveal com saldos aleatórios e verificar resultado
4. **Property 5** (Frontend): Gerar listas de alertas com tamanhos variados e verificar que a feed respeita o limite e ordenação
5. **Property 6** (Frontend): Gerar arrays de timeframes com comprimentos variados e verificar badge mapping
6. **Property 7** (Frontend): Gerar timestamps variados e verificar estado de expiração
7. **Property 8** (Backend): Testar reveal e verificar estado do DB
8. **Property 9** (Frontend): Gerar dados de alerta e verificar URL construída
9. **Property 10** (Backend): Testar idempotência com keys repetidas
10. **Property 11** (Python): Testar output do worker com dados de detecção variados
11. **Property 12** (Frontend): Simular chegada de alertas e verificar feed state

### Unit Tests (complementares)

- Render do idle state quando `alertas = []`
- Render do badge "EXPIRADO" para um timestamp específico
- Render do label "50 créditos" no botão
- Remoção do AlertaPopup do DOM (integration test)
- Edge case: alert com `timeframes = []` (badge padrão)
- Edge case: network error no reveal (retry behavior)

### Integration Tests

- Fluxo completo: poll → card renderizado → click reveal → redirect
- Migration: verificar que novas colunas existem e aceitam dados válidos
