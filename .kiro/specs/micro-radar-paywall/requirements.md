# Requirements Document

## Introduction

O sistema Micro Radar da plataforma Genesis 2.0 detecta anomalias de mercado (spikes de volume, movimentos bruscos, divergências CVD, etc.) e exibe alertas no frontend. Atualmente, todas as informações do alerta — incluindo o ativo (símbolo), corretora e preço — são visíveis gratuitamente. Este feature transforma o Micro Radar em um produto monetizado: o ativo fica oculto atrás de um paywall de 50 créditos, os alertas flutuantes são removidos, e uma feed vertical de cards é renderizada dentro do componente principal. A engine de detecção permanece inalterada.

## Glossary

- **Radar_Feed**: Componente vertical dentro de ConfluenceScore.tsx que exibe até 5 cards de alerta em fila
- **Alert_Card**: Card individual na Radar_Feed que mostra informações parciais (score, motivos, timeframes) sem revelar o ativo
- **Paywall**: Mecanismo que oculta o campo `ativo` (símbolo), `corretora` e `preco_atual` até o usuário pagar 50 créditos
- **Reveal_Flow**: Processo de débito de 50 créditos seguido de redirecionamento para /nova-analise com campos pré-preenchidos
- **Confluence_Badge**: Indicador visual colorido baseado na quantidade de timeframes que confirmam a anomalia
- **Poll_Endpoint**: Endpoint `/api/v1/alertas/poll` que retorna alertas a cada 10s via polling HTTP
- **Worker_Python**: Processo WebSocket que detecta anomalias e salva na tabela `genesis_alertas`
- **Genesis_Alertas**: Tabela do banco de dados que armazena os alertas detectados pelo Worker_Python
- **Expiration_Badge**: Badge visual "EXPIRADO" exibido em alertas com mais de 4 horas de idade
- **Credits_System**: Sistema existente de créditos do usuário utilizado para monetização

## Requirements

### Requirement 1: Asset Data Concealment (Paywall)

**User Story:** As a platform operator, I want to hide the asset symbol, exchange, and current price from non-paying users, so that the Micro Radar generates revenue per reveal.

#### Acceptance Criteria

1. THE Poll_Endpoint SHALL omit the fields `ativo`, `corretora`, and `preco_atual` from the response payload for alerts where `revelado_por` is NULL or does not match the requesting user's ID
2. WHEN a user has paid 50 credits to reveal an alert, THE Poll_Endpoint SHALL include the fields `ativo`, `corretora`, and `preco_atual` in the response for that alert
3. THE Alert_Card SHALL display only: score, motivos (reasons), active timeframes, direction, alert type, and timestamp WHILE the alert has not been revealed by the current user
4. THE Alert_Card SHALL NOT display the asset symbol, exchange name, or current price WHILE the alert has not been revealed by the current user

### Requirement 2: Remove Floating Popup Alerts

**User Story:** As a platform operator, I want to remove the floating popup alerts (AlertaPopup.tsx), so that all alert rendering is consolidated inside the Micro Radar component.

#### Acceptance Criteria

1. THE Radar_Feed SHALL render all alerts inside the ConfluenceScore.tsx component as a vertical feed of cards
2. THE Application SHALL cease rendering the AlertaPopup floating overlay component in the top-right corner
3. WHEN new alerts arrive via polling, THE Radar_Feed SHALL append them to the vertical feed within ConfluenceScore.tsx

### Requirement 3: Credit Cost Reduction

**User Story:** As a platform operator, I want each reveal to cost 50 credits instead of 75, so that the pricing matches the updated business model.

#### Acceptance Criteria

1. WHEN a user clicks "Revelar e Analisar", THE Credits_System SHALL debit exactly 50 credits from the user's balance
2. THE Alert_Card SHALL display "50 créditos" as the cost label on the reveal button
3. IF the user's credit balance is below 50, THEN THE Reveal_Flow SHALL display an insufficient credits error and prevent the debit

### Requirement 4: Vertical Feed of Alert Cards

**User Story:** As a user, I want to see up to 5 alerts queued in a vertical feed inside the Micro Radar component, so that I can evaluate multiple opportunities at once.

#### Acceptance Criteria

1. THE Radar_Feed SHALL display a maximum of 5 Alert_Cards simultaneously in a vertical stack
2. WHEN more than 5 alerts are available, THE Radar_Feed SHALL display only the 5 most recent alerts
3. THE Radar_Feed SHALL order Alert_Cards from newest (top) to oldest (bottom)
4. WHEN no alerts are available, THE Radar_Feed SHALL display a "monitoring" idle state with appropriate visual feedback

### Requirement 5: Confluence Badges

**User Story:** As a user, I want to see color-coded confluence badges based on how many timeframes confirm the anomaly, so that I can quickly assess signal strength.

#### Acceptance Criteria

1. WHEN an alert has anomalies confirmed in exactly 1 timeframe, THE Alert_Card SHALL display a green badge (normal, no label)
2. WHEN an alert has anomalies confirmed in exactly 2 timeframes, THE Alert_Card SHALL display a yellow badge with the label "CONFLUÊNCIA"
3. WHEN an alert has anomalies confirmed in exactly 3 timeframes, THE Alert_Card SHALL display an orange badge with the label "CONFLUÊNCIA FORTE"
4. WHEN an alert has anomalies confirmed in 4 or more timeframes, THE Alert_Card SHALL display a red pulsing badge with the label "CONFLUÊNCIA MÁXIMA"

### Requirement 6: Expiration Visual Indicator

**User Story:** As a user, I want alerts older than 4 hours to appear visually faded with an "EXPIRADO" badge, so that I can distinguish stale alerts from fresh ones.

#### Acceptance Criteria

1. WHILE an alert's `criado_em` timestamp is older than 4 hours relative to the current time, THE Alert_Card SHALL render with reduced opacity (visually faded)
2. WHILE an alert's `criado_em` timestamp is older than 4 hours relative to the current time, THE Alert_Card SHALL display an Expiration_Badge with the text "EXPIRADO"
3. WHILE an alert's `criado_em` timestamp is less than 4 hours old, THE Alert_Card SHALL render at full opacity without an Expiration_Badge

### Requirement 7: Reveal Flow and Redirect

**User Story:** As a user, I want to pay 50 credits to reveal the asset and be redirected to the analysis page with pre-filled fields, so that I can immediately analyze the opportunity.

#### Acceptance Criteria

1. WHEN the user clicks "Revelar e Analisar" and the debit succeeds, THE Reveal_Flow SHALL mark the alert as revealed by setting `revelado_por` to the user's ID and `revelado_em` to the current timestamp
2. WHEN the alert is successfully revealed, THE Reveal_Flow SHALL redirect the user to `/nova-analise?symbol={ativo}&exchange={corretora}&timeframe={first_active_timeframe}&radar_id={alert_id}`
3. WHEN the user clicks "Revelar e Analisar", THE Reveal_Flow SHALL use an idempotency key to prevent double-debiting on network retries
4. IF the debit API call fails due to network error, THEN THE Reveal_Flow SHALL display an error message and allow retry without duplicate charges

### Requirement 8: Database Migration

**User Story:** As a developer, I want the `genesis_alertas` table extended with new columns, so that the system can store motivos, timeframes, expiration, and reveal data.

#### Acceptance Criteria

1. THE Genesis_Alertas table SHALL include a `motivos` column of type JSON that stores an array of reason objects
2. THE Genesis_Alertas table SHALL include a `timeframes` column of type JSON that stores an array of active timeframe strings
3. THE Genesis_Alertas table SHALL include an `expires_at` column of type TIMESTAMP that stores the alert expiration time (4 hours after creation)
4. THE Genesis_Alertas table SHALL include a `revelado_por` column of type INTEGER (nullable) that references the user who revealed the alert
5. THE Genesis_Alertas table SHALL include a `revelado_em` column of type TIMESTAMP (nullable) that stores when the alert was revealed

### Requirement 9: Worker Python Field Population

**User Story:** As a developer, I want the Worker_Python to populate the new columns (motivos, timeframes, expires_at) when saving an alert, so that the frontend has the data needed for the new card layout.

#### Acceptance Criteria

1. WHEN the Worker_Python saves a new alert to Genesis_Alertas, THE Worker_Python SHALL populate the `motivos` field with a JSON array of reason objects containing at minimum a label and a value for each detected anomaly reason
2. WHEN the Worker_Python saves a new alert to Genesis_Alertas, THE Worker_Python SHALL populate the `timeframes` field with a JSON array of the timeframe strings (from the set: "15m", "1h", "4h", "12h", "1d") where the anomaly was confirmed
3. WHEN the Worker_Python saves a new alert to Genesis_Alertas, THE Worker_Python SHALL set `expires_at` to exactly 4 hours after the alert creation timestamp
4. THE Worker_Python SHALL preserve all existing detection logic without modification

### Requirement 10: Backend Poll Endpoint Filtering

**User Story:** As a developer, I want the poll endpoint to conditionally include or exclude asset data based on reveal status, so that the paywall is enforced server-side.

#### Acceptance Criteria

1. WHEN the Poll_Endpoint returns alerts, THE Poll_Endpoint SHALL include the fields `motivos`, `timeframes`, `score`, `tipo`, `direcao`, `criado_em`, and `expires_at` for all alerts regardless of reveal status
2. WHEN the Poll_Endpoint returns an alert where `revelado_por` matches the authenticated user's ID, THE Poll_Endpoint SHALL include `ativo`, `corretora`, and `preco_atual` in that alert's payload
3. WHEN the Poll_Endpoint returns an alert where `revelado_por` is NULL or does not match the authenticated user's ID, THE Poll_Endpoint SHALL exclude `ativo`, `corretora`, and `preco_atual` from that alert's payload
4. THE Poll_Endpoint SHALL continue using HTTP GET polling without implementing SSE or WebSocket connections
