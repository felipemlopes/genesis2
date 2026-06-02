# Plano de Implementação: Centralização do Backend do Radar Geopolítico

## Visão Geral

Migrar a coleta de eventos geopolíticos do frontend (chamadas diretas ao Gemini via proxy) para um cron job centralizado no backend Laravel. Implementar persistência em banco, controle de notificações por usuário, endpoint REST, polling no frontend e notificações via Telegram e in-app.

## Tarefas

- [x] 1. Criar migrations e model GeoEvent no backend
  - [x] 1.1 Criar migration `create_geo_events_table` com todos os campos definidos no design (title, summary, category, latitude, longitude, location, region, severity, market_bias, asset, impacted_assets JSON, us_market_impact, crypto_impact, source_url, market_weight, relevance, confidence, status, expires_at) e índices em `created_at`, `expires_at` e `title`
    - _Requisitos: 2.1, 2.3_
  - [x] 1.2 Criar migration `create_geo_event_user_table` (pivot) com campos user_id, geo_event_id, notified_at e índice UNIQUE composto (user_id, geo_event_id)
    - _Requisitos: 3.1_
  - [x] 1.3 Criar model `App\Models\GeoEvent` com fillable, casts e relação `notifiedUsers()` BelongsToMany
    - _Requisitos: 2.1, 3.1_

- [x] 2. Implementar GeoEventService no backend
  - [x] 2.1 Criar `App\Services\GeoEventService` com método `fetchAndStore()` que chama a Gemini API com o prompt e config de `google_search_retrieval`, normaliza os dados raw, faz deduplicação case-insensitive por título, persiste novos eventos com `expires_at = created_at + 10 min`, e envia notificação Telegram para cada evento novo
    - _Requisitos: 1.1, 1.2, 1.4, 1.5, 2.2, 6.1_
  - [x] 2.2 Implementar método `getUnnotifiedForUser(int $userId)` que retorna eventos criados nos últimos 10 minutos que NÃO possuem registro na pivot para o usuário
    - _Requisitos: 3.3, 4.2_
  - [x] 2.3 Implementar método `markAsNotified(int $userId, array $eventIds)` que registra na pivot com `notified_at` preenchido
    - _Requisitos: 3.2, 4.3_
  - [x] 2.4 Implementar formatação da mensagem Telegram com título, severidade, localização, impacto mercado americano, impacto crypto e viés de mercado (market_bias)
    - _Requisitos: 6.2, 6.3, 6.4_
  - [ ]* 2.5 Escrever teste de propriedade para normalização e persistência completa
    - **Propriedade 1: Normalização e persistência completa**
    - **Valida: Requisitos 1.2, 2.1**
  - [ ]* 2.6 Escrever teste de propriedade para deduplicação por título
    - **Propriedade 2: Deduplicação por título**
    - **Valida: Requisito 1.5**
  - [ ]* 2.7 Escrever teste de propriedade para invariante de expiração
    - **Propriedade 3: Invariante expires_at**
    - **Valida: Requisito 2.2**
  - [ ]* 2.8 Escrever teste de propriedade para Telegram enviado para eventos novos
    - **Propriedade 8: Telegram enviado para eventos novos**
    - **Valida: Requisito 6.1**
  - [ ]* 2.9 Escrever teste de propriedade para formato da mensagem Telegram
    - **Propriedade 9: Formato da mensagem Telegram**
    - **Valida: Requisito 6.2**

- [x] 3. Criar Artisan Command e registrar no Scheduler
  - [x] 3.1 Criar `App\Console\Commands\FetchGeoEventsCommand` com signature `geo:fetch-events` que invoca `GeoEventService::fetchAndStore()`, trata exceções com `Log::error` e não interrompe o agendamento em caso de falha
    - _Requisitos: 1.1, 1.3_
  - [x] 3.2 Registrar o command no `Kernel.php` com `->everyFiveMinutes()`
    - _Requisitos: 1.1_

- [x] 4. Implementar GeoEventController e rota
  - [x] 4.1 Criar `App\Http\Controllers\Api\GeoEventController` com método `index()` que usa `GeoEventService::getUnnotifiedForUser()`, serializa no formato JSON compatível com a interface frontend (coordinates como array [lat, lng], market_impact como objeto, timestamp em milliseconds), registra na pivot via `markAsNotified()` e retorna array vazio com HTTP 200 quando não há eventos
    - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 4.2 Registrar rota `GET /api/v1/geo-events` no arquivo de rotas com middleware de autenticação Sanctum
    - _Requisitos: 4.1_
  - [ ]* 4.3 Escrever teste de propriedade para filtragem de eventos por usuário e tempo
    - **Propriedade 4: Filtragem de eventos por usuário e tempo**
    - **Valida: Requisitos 3.3, 4.2**
  - [ ]* 4.4 Escrever teste de propriedade para registro na pivot após consulta
    - **Propriedade 5: Registro na pivot após consulta**
    - **Valida: Requisitos 3.2, 4.3**
  - [ ]* 4.5 Escrever teste de propriedade para serialização compatível com interface frontend
    - **Propriedade 6: Serialização compatível com interface frontend**
    - **Valida: Requisito 4.5**

- [x] 5. Checkpoint - Garantir que o backend está funcional
  - Garantir que todas as migrations rodam sem erro, os testes passam e o endpoint responde corretamente. Perguntar ao usuário se há dúvidas.

- [x] 6. Refatorar geopoliticalEngine.ts no frontend
  - [x] 6.1 Remover toda a lógica de chamada ao `/api/v1/gemini-proxy` e o método `fetchRawSignals()`. Substituir por polling ao endpoint `GET /api/v1/geo-events` a cada 30 segundos com token Bearer do localStorage
    - _Requisitos: 5.1, 5.4_
  - [x] 6.2 Manter a interface `GeoEvent`, tipos exportados e o sistema de subscribers. Adaptar `start()` para iniciar o polling e `stop()` para interrompê-lo
    - _Requisitos: 5.2_
  - [x] 6.3 Implementar tratamento de erros: `console.error` em caso de falha, retry no próximo ciclo de 30s sem interromper o radar
    - _Requisitos: 5.5_
  - [x] 6.4 Remover métodos não mais necessários: `normalizeAndProcess()`, `synthesizeWithGemini()`, `getFallbackData()`, `getCoordinatesForRegion()`, `calculateMarketWeight()`, `calculateRelevance()`
    - _Requisitos: 5.4_
  - [ ]* 6.5 Escrever teste de propriedade para eventos adicionados ao contexto frontend
    - **Propriedade 7: Eventos adicionados ao contexto frontend**
    - **Valida: Requisito 5.3**

- [x] 7. Atualizar GeoEngineContext.tsx e criar GeoNotificationToast
  - [x] 7.1 Atualizar `GeoEngineContext.tsx` para detectar se o usuário está na página do Radar Geopolítico (via `useLocation` ou equivalente) e expor essa informação no contexto
    - _Requisitos: 7.4_
  - [x] 7.2 Adicionar lógica no contexto para disparar notificação toast quando novos eventos chegam E o usuário NÃO está na página do Radar
    - _Requisitos: 7.1, 7.4_
  - [x] 7.3 Criar componente `GeoNotificationToast.tsx` que exibe título, severidade e localização do evento, desaparece automaticamente após 10 segundos e navega para a página do Radar ao ser clicado
    - _Requisitos: 7.2, 7.3, 7.5_
  - [ ]* 7.4 Escrever teste de propriedade para notificação toast condicionada à página
    - **Propriedade 10: Notificação toast condicionada à página**
    - **Valida: Requisitos 7.1, 7.4**
  - [ ]* 7.5 Escrever teste de propriedade para conteúdo do toast
    - **Propriedade 11: Conteúdo do toast**
    - **Valida: Requisito 7.2**

- [x] 8. Configurar variáveis de ambiente do Telegram
  - [x] 8.1 Adicionar `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` ao `.env.example` do backend e documentar no config/services.php
    - _Requisitos: 6.4_

- [ ] 9. Checkpoint final - Validação completa
  - Garantir que todos os testes passam, o cron job executa corretamente, o frontend consome o novo endpoint, notificações Telegram são enviadas e o toast in-app funciona. Perguntar ao usuário se há dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam invariantes universais de corretude
- Testes unitários validam exemplos específicos e edge cases
