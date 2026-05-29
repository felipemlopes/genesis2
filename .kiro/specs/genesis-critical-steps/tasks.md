# Plano de Implementação: Gênesis 2.0 — 8 Passos Críticos

## Visão Geral

Implementação dos 8 passos críticos pós-auditoria, ordenados por dependência: migrations primeiro, depois rotas backend/BFF, e por fim alterações no frontend. Todos os comentários de código em português.

## Tarefas

- [x] 1. Migrations Laravel — Colunas ATH e Tabelas Telegram
  - [x] 1.1 Criar migration para adicionar colunas ATH às 3 tabelas de carteira
    - Criar arquivo `genesis-api/database/migrations/2025_05_28_000001_add_ath_columns_to_carteiras.php`
    - Adicionar `max_price DECIMAL(24,12)`, `max_price_date DATETIME`, `max_variation_pct DECIMAL(10,2)` nullable às tabelas `genesis_carteira_mae`, `genesis_carteira_gemas`, `genesis_carteira_membro`
    - Incluir método `down()` para rollback
    - _Requisitos: 1.1_

  - [x] 1.2 Criar migration para tabelas de alertas Telegram
    - Criar arquivo `genesis-api/database/migrations/2025_05_28_000002_create_telegram_alert_tables.php`
    - Criar tabela `genesis_alertas_telegram_config` com colunas: id, wallet_type ENUM, ativo, threshold_minimo, gap_minimo, intervalo_horas, template, atualizado_em, UNIQUE(wallet_type)
    - Criar tabela `genesis_alertas_telegram_estado` com colunas: id, wallet_type, wallet_asset_id, ultimo_alerta_pct, ultima_verificacao, ultimo_disparo, total_disparos, UNIQUE(wallet_type, wallet_asset_id)
    - Inserir seeds com templates padrão para 'mae' e 'gemas'
    - Incluir método `down()` para rollback
    - _Requisitos: 1.2, 1.3, 1.4_

- [x] 2. Correção tamanhoSugerido no Laravel
  - [x] 2.1 Corrigir cálculo em GeminiAnalysisService.php
    - Editar `genesis-api/app/Services/GeminiAnalysisService.php`
    - Adicionar fallback: se `$entryValue <= 0` ou vazio, usar `$margemBase = 100`
    - Garantir que `tamanhoSugerido = max($entryValue, 100) * $leverage`
    - Formatar resultado como `$X.XX` com duas casas decimais
    - Nunca retornar `$0.00`
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 2.2 Escrever teste de propriedade P1: tamanhoSugerido nunca produz zero
    - **Propriedade 1: Cálculo de tamanhoSugerido nunca produz zero**
    - Usar data providers com combinações de entryValue (0, vazio, negativo, positivo) e leverage (1..125)
    - Verificar que resultado é sempre > 0
    - **Valida: Requisitos 2.1, 2.2**

  - [ ]* 2.3 Escrever teste de propriedade P2: Formatação de tamanhoSugerido
    - **Propriedade 2: Formatação de tamanhoSugerido**
    - Verificar que string formatada corresponde a `$X.XX` e parse > 0
    - **Valida: Requisitos 2.3, 2.5**

- [x] 3. Rota GET /api/price/{symbol} no Laravel
  - [x] 3.1 Implementar rota de preços com fallback de exchanges
    - Criar `genesis-api/app/Services/PriceProxyService.php` com lógica de fallback
    - Criar `genesis-api/app/Http/Controllers/Api/PriceController.php`
    - Registrar rota GET em `genesis-api/routes/api.php`
    - Implementar fallback: Binance → Bybit → OKX → Bitget (usando Http facade)
    - Retornar JSON com campos: price, exchange, symbol, timestamp
    - Retornar 502 se todas falharem
    - Nunca expor API keys ou stack traces na resposta
    - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.7_

  - [ ]* 3.2 Escrever teste de propriedade P4: Resposta do proxy contém campos obrigatórios
    - **Propriedade 4: Resposta do proxy de preços contém campos obrigatórios**
    - Mock Http facade, verificar campos price > 0, exchange não-vazia, symbol não-vazia, timestamp ISO
    - **Valida: Requisitos 5.1, 5.4**

  - [ ]* 3.3 Escrever teste de propriedade P5: Fallback de exchanges em ordem
    - **Propriedade 5: Fallback de exchanges em ordem**
    - Simular falhas em N exchanges consecutivas via Http::fake(), verificar que próxima é tentada
    - **Valida: Requisito 5.2**

  - [ ]* 3.4 Escrever teste de propriedade P6: Respostas de erro não expõem dados internos
    - **Propriedade 6: Respostas de erro não expõem dados internos**
    - Verificar que respostas de erro não contêm API keys, stack traces ou URLs internas
    - **Valida: Requisito 5.7**

- [x] 4. Rota PUT /api/historico-analises/{id} no Laravel
  - [x] 4.1 Implementar método de atualização de resultado no AnaliseController
    - Editar `genesis-api/app/Http/Controllers/Api/AnaliseController.php`
    - Adicionar método `atualizarResultado($id)` que atualiza `resultado`, `preco_resultado`, `data_resultado` na tabela `genesis_analises`
    - Registrar rota PUT em `genesis-api/routes/api.php`
    - Retornar 404 para id inválido
    - _Requisitos: 5.5, 5.6_

  - [ ]* 4.2 Escrever teste de propriedade P12: Atualização de resultado via PUT
    - **Propriedade 12: Atualização de resultado via PUT**
    - Verificar que PUT com id válido atualiza registro; id inválido retorna 404
    - **Valida: Requisitos 5.5, 5.6, 6.3**

- [x] 5. Rota POST /api/creditos/debitar no Laravel
  - [x] 5.1 Adicionar tipo 'micro_radar' ao CreditController::consume()
    - Editar `genesis-api/app/Http/Controllers/Api/CreditController.php`
    - Adicionar `elseif($type=="micro_radar")` com `$amount = setting('cost_micro_radar_credits')` e `$description = "Micro Radar"`
    - O controller já usa bavix/wallet (`withdrawFloat`) e já tem proteção anti-duplicação (verifica transação nos últimos 20s)
    - Retornar 402 (via `responder()->error()`) se saldo insuficiente — já implementado no início do método
    - _Requisitos: 8.5, 8.6_

  - [x] 5.2 Adicionar setting cost_micro_radar_credits = 75
    - Adicionar seed na tabela `settings`: `['key' => 'cost_micro_radar_credits', 'value' => '75']`
    - Pode ser via migration ou adicionando ao `SettingsSeeder.php`
    - _Requisitos: 8.1, 8.5_

  - [x] 5.3 Reforçar proteção anti-duplicação com idempotency_key
    - No `CreditController::consume()`, além do check de 20s existente, aceitar parâmetro opcional `idempotency_key` no request
    - Se `idempotency_key` fornecido: verificar se já existe transação com essa meta antes de debitar
    - Isso protege contra retries de rede que podem chegar após os 20s
    - _Requisitos: 8.7_

  - [ ]* 5.3 Escrever teste de propriedade P10: Débito com saldo insuficiente
    - **Propriedade 10: Débito de créditos com saldo insuficiente**
    - Verificar que saldo < 75 retorna 402 e saldo não é alterado
    - **Valida: Requisitos 8.4, 8.6**

  - [ ]* 5.4 Escrever teste de propriedade P11: Débito com saldo suficiente
    - **Propriedade 11: Débito de créditos com saldo suficiente**
    - Verificar que saldo ≥ 75 resulta em novo saldo = saldo_anterior - 75
    - **Valida: Requisitos 8.3, 8.5**

  - [ ]* 5.5 Escrever teste de propriedade P13: Idempotência de débito
    - **Propriedade 13: Débito duplicado com mesma idempotency_key não altera saldo**
    - Enviar POST duas vezes com mesma chave, verificar que saldo é debitado apenas uma vez
    - **Valida: Requisito 8.7**

- [x] 6. Checkpoint — Verificar migrations e rotas
  - Garantir que todas as migrations rodam sem erro, rotas respondem corretamente. Perguntar ao usuário se há dúvidas.

- [x] 7. Eliminar localStorage do histórico de análises
  - [x] 7.1 Remover localStorage de AnalysisHistoryDashboard.tsx
    - Editar `G-nesis-2.0-main/components/AnalysisHistoryDashboard.tsx`
    - Remover todas as chamadas a `localStorage.getItem`, `localStorage.setItem`, `localStorage.removeItem` relacionadas ao histórico
    - Substituir por chamadas à API: GET /api/historico-analises, POST /api/salvar-analise, DELETE /api/historico-analises/:id
    - _Requisitos: 3.1, 3.2, 3.3, 3.5_

  - [x] 7.2 Remover localStorage de GenesisPage (se existir)
    - Verificar e remover referências a localStorage para histórico em `G-nesis-2.0-main/app/routes/genesis.tsx` ou componente equivalente
    - _Requisitos: 3.6_

  - [ ]* 7.3 Escrever teste de propriedade P9: Persistência round-trip via API
    - **Propriedade 9: Persistência de análise via API (round-trip)**
    - Salvar via POST e buscar via GET, verificar que campos retornam iguais
    - **Valida: Requisitos 3.2, 3.4**

- [x] 8. Mapeamento TP2/TP3 — círculos sem N/A
  - [x] 8.1 Corrigir mapeamento de take_profit_2 e take_profit_3
    - Editar `G-nesis-2.0-main/components/AnalysisHistoryDashboard.tsx`
    - Mapear `take_profit_2` → `target_price2` e `take_profit_3` → `target_price3` usando `parseFloat(value) || 0`
    - Alterar condição de renderização de `(value)` para `(value !== undefined && value !== null)`
    - Renderizar círculo com 0% quando valor é zero (não exibir "N/A")
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 8.2 Escrever teste de propriedade P3: Mapeamento TP com parseFloat e fallback
    - **Propriedade 3: Mapeamento TP2/TP3 com parseFloat e fallback**
    - Testar com null, undefined, string numérica, 0 — resultado sempre number ≥ 0
    - **Valida: Requisitos 4.1, 4.2**

- [x] 9. Reescrever checkPrices — proxy + progresso circular
  - [x] 9.1 Reescrever função checkPrices para usar proxy
    - Editar `G-nesis-2.0-main/components/AnalysisHistoryDashboard.tsx`
    - Remover chamada direta a `https://api.binance.com/api/v3/ticker/price`
    - Usar `GET /api/price/:symbol` para cada símbolo pendente
    - Calcular progresso percentual para TP1, TP2, TP3, Stop usando fórmulas:
      - LONG: `clamp(((currentPrice - entryPrice) / (targetPrice - entryPrice)) * 100, 0, 100)`
      - SHORT: `clamp(((entryPrice - currentPrice) / (entryPrice - targetPrice)) * 100, 0, 100)`
    - Passar valores de progresso para `strokeDasharray` dos SVG circles
    - Enviar PUT /api/historico-analises/:id quando alvo é atingido
    - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 9.2 Escrever teste de propriedade P7: Progresso clamped entre 0 e 100
    - **Propriedade 7: Progresso percentual clamped entre 0 e 100**
    - Gerar combinações aleatórias de entry, current, target (positivos)
    - Verificar que resultado está sempre no intervalo [0, 100]
    - **Valida: Requisitos 6.2, 6.6, 6.7**

- [x] 10. ATH no polling da carteira
  - [x] 10.1 Adicionar lógica ATH ao hook useMonitoramentoCarteira
    - Editar `G-nesis-2.0-main/hooks/useMonitoramentoCarteira.ts`
    - No ciclo de polling: se `preco_atual > max_price` (ou max_price é null/0), enviar PUT para atualizar ATH
    - Calcular `max_variation_pct = ((preco_atual - preco_entrada) / preco_entrada) * 100`
    - Atualizar `max_price_date` com datetime ISO atual
    - Tratar erros de rede com console.warn sem interromper polling
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 10.2 Escrever teste de propriedade P8: ATH atualizado quando preço supera máximo
    - **Propriedade 8: ATH atualizado quando preço supera máximo**
    - Gerar combinações de preco_atual, max_price, preco_entrada
    - Verificar que variação é calculada corretamente e max_price = preco_atual quando supera
    - **Valida: Requisitos 7.1, 7.2**

- [x] 11. Micro Radar — 75 créditos + tooltip + débito real
  - [x] 11.1 Atualizar ConfluenceScore.tsx com custo correto e tooltip
    - Editar `G-nesis-2.0-main/components/ConfluenceScore.tsx`
    - Alterar texto de "50 creditos" para "75 creditos"
    - Adicionar tooltip com padrão `group-hover` (seguir FundingMonitor.tsx / MarketWidget.tsx)
    - _Requisitos: 8.1, 8.2_

  - [x] 11.2 Implementar débito de créditos no handleAnalyze com proteção anti-duplicação
    - No handler de clique "Analisar Agora": POST /api/consume/micro_radar com idempotency_key (crypto.randomUUID())
    - Adicionar estado `isDebiting` para desabilitar botão durante request (prevenir double-click)
    - Mostrar loading spinner no botão enquanto request está em andamento
    - Se sucesso: navegar para análise
    - Se falha (saldo insuficiente ou erro): exibir mensagem de erro, bloquear navegação, reabilitar botão
    - _Requisitos: 8.3, 8.4, 8.8, 8.9_

- [x] 12. Checkpoint final — Validação completa
  - Garantir que todas as rotas funcionam, localStorage foi eliminado, preços vêm via proxy, créditos debitam corretamente. Perguntar ao usuário se há dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam corretude universal; testes unitários validam exemplos e edge cases
- Todos os comentários de código devem ser escritos em português
