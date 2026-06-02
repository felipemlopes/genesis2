# Documento de Requisitos

## Introdução

Refatoração do Radar Geopolítico para centralizar todas as chamadas à API Gemini no backend Laravel. Atualmente, cada cliente frontend chama a API Gemini independentemente via proxy, gerando custos elevados e sem controle de notificações duplicadas. A nova arquitetura implementa um cron job no backend que busca eventos uma única vez, armazena em banco de dados, controla notificações por usuário e envia alertas via Telegram.

## Glossário

- **Cron_Job**: Tarefa agendada no backend Laravel que executa a cada 5 minutos para buscar novos eventos geopolíticos
- **Geo_Event**: Evento geopolítico com impacto no mercado financeiro, armazenado na tabela `geo_events`
- **Pivot_Table**: Tabela intermediária `geo_event_user` que rastreia quais eventos cada usuário já foi notificado
- **API_Endpoint**: Rota `GET /api/v1/geo-events` que retorna eventos não notificados ao usuário
- **Frontend_Poller**: Módulo no frontend que faz polling periódico ao endpoint de eventos
- **Telegram_Notifier**: Serviço que envia mensagens formatadas ao grupo Telegram via Bot API
- **In_App_Notification**: Notificação visual exibida no frontend quando o usuário não está na página do Radar Geopolítico
- **Gemini_API**: API do Google Generative AI com Google Search Retrieval para busca de eventos em tempo real
- **Sistema**: O sistema Genesis (backend Laravel + frontend React)

## Requisitos

### Requisito 1: Cron Job de Coleta de Eventos

**User Story:** Como operador do sistema, quero que o backend busque eventos geopolíticos automaticamente a cada 5 minutos, para que apenas uma chamada à API Gemini seja feita independente do número de usuários conectados.

#### Critérios de Aceitação

1. WHEN o intervalo de 5 minutos é atingido, THE Cron_Job SHALL executar uma chamada à Gemini_API com Google Search Retrieval para buscar eventos geopolíticos das últimas 24 horas
2. WHEN a Gemini_API retorna eventos, THE Cron_Job SHALL normalizar os dados e armazená-los na tabela `geo_events`
3. IF a Gemini_API retornar erro ou timeout, THEN THE Cron_Job SHALL registrar o erro em log e tentar novamente na próxima execução sem interromper o agendamento
4. THE Cron_Job SHALL utilizar o mesmo prompt e configuração de tools (google_search_retrieval) atualmente usado no `geopoliticalEngine.ts`
5. WHEN um evento com título já existente na tabela `geo_events` é retornado, THE Cron_Job SHALL ignorar o evento duplicado sem criar novo registro

### Requisito 2: Armazenamento de Eventos no Banco de Dados

**User Story:** Como desenvolvedor, quero que os eventos geopolíticos sejam persistidos em banco de dados com todos os campos necessários, para que possam ser consultados de forma eficiente e confiável.

#### Critérios de Aceitação

1. THE Sistema SHALL armazenar cada Geo_Event com os campos: id, title, summary, category, latitude, longitude, location, region, severity, market_bias, asset, impacted_assets (JSON), us_market_impact, crypto_impact, source_url, market_weight, relevance, confidence, status, created_at, expires_at
2. WHEN um novo Geo_Event é criado, THE Sistema SHALL definir o campo `expires_at` como 10 minutos após o `created_at`
3. THE Sistema SHALL indexar os campos `created_at` e `expires_at` para consultas eficientes de filtragem temporal

### Requisito 3: Controle de Notificação por Usuário

**User Story:** Como usuário, quero receber cada evento geopolítico apenas uma vez, para que não seja bombardeado com notificações duplicadas.

#### Critérios de Aceitação

1. THE Pivot_Table SHALL armazenar a relação entre usuário e evento com os campos: user_id, geo_event_id, notified_at
2. WHEN o API_Endpoint retorna eventos ao usuário, THE Sistema SHALL registrar na Pivot_Table que aquele usuário foi notificado sobre cada evento retornado
3. WHEN um usuário consulta o API_Endpoint, THE Sistema SHALL excluir eventos que já possuem registro na Pivot_Table para aquele usuário

### Requisito 4: Endpoint de Consulta de Eventos

**User Story:** Como frontend, quero consultar um endpoint que retorne apenas eventos novos e relevantes para o usuário autenticado, para exibir no Radar Geopolítico sem duplicatas.

#### Critérios de Aceitação

1. THE API_Endpoint SHALL responder na rota `GET /api/v1/geo-events` com autenticação obrigatória via token Bearer
2. WHEN o usuário autenticado faz uma requisição, THE API_Endpoint SHALL retornar apenas eventos que não estão na Pivot_Table para aquele usuário E que foram criados nos últimos 10 minutos (created_at >= now - 10 minutos)
3. WHEN eventos são retornados com sucesso, THE API_Endpoint SHALL registrar na Pivot_Table cada evento retornado com o timestamp atual no campo `notified_at`
4. WHEN não existem eventos novos para o usuário, THE API_Endpoint SHALL retornar um array vazio com status HTTP 200
5. THE API_Endpoint SHALL retornar os eventos no formato JSON compatível com a interface `GeoEvent` do frontend, incluindo: id, title, summary, category, coordinates (array [lat, lng]), location, region, severity, market_impact (objeto com signal, asset, impacted_assets, us_market_impact, crypto_impact), timestamp, marketWeight, relevance, confidence, status, sourceUrl

### Requisito 5: Polling no Frontend

**User Story:** Como usuário, quero que o Radar Geopolítico exiba eventos em tempo quase real sem que eu precise recarregar a página, consumindo o novo endpoint centralizado.

#### Critérios de Aceitação

1. WHEN o radar está ativo, THE Frontend_Poller SHALL fazer requisições ao API_Endpoint a cada 30 segundos
2. WHEN o radar é desativado pelo usuário, THE Frontend_Poller SHALL interromper todas as requisições de polling
3. WHEN novos eventos são recebidos do API_Endpoint, THE Frontend_Poller SHALL adicioná-los à lista de eventos do contexto GeoEngine e disparar notificações visuais no mapa
4. THE Frontend_Poller SHALL substituir completamente a chamada direta ao `/api/v1/gemini-proxy` que existe atualmente no `geopoliticalEngine.ts`
5. IF o API_Endpoint retornar erro, THEN THE Frontend_Poller SHALL registrar o erro no console e tentar novamente no próximo ciclo de polling sem interromper o funcionamento do radar

### Requisito 6: Notificação via Telegram

**User Story:** Como operador do sistema, quero receber alertas no Telegram quando novos eventos geopolíticos são detectados, para acompanhar a situação em tempo real sem precisar acessar a plataforma.

#### Critérios de Aceitação

1. WHEN o Cron_Job detecta um evento que não existe previamente na tabela `geo_events`, THE Telegram_Notifier SHALL enviar uma mensagem formatada ao grupo Telegram configurado
2. THE Telegram_Notifier SHALL incluir na mensagem: título do evento, severidade, localização, impacto no mercado americano, impacto em criptomoedas e viés de mercado (bias)
3. IF o envio ao Telegram falhar, THEN THE Telegram_Notifier SHALL registrar o erro em log sem impedir o armazenamento do evento no banco de dados
4. THE Telegram_Notifier SHALL utilizar a API do Telegram Bot com o token e chat_id configurados via variáveis de ambiente (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)

### Requisito 7: Notificação In-App Fora da Página do Radar

**User Story:** Como usuário, quero ser notificado visualmente quando novos eventos geopolíticos são detectados mesmo que eu não esteja na página do Radar Geopolítico, para que eu não perca alertas importantes enquanto navego em outras seções da plataforma.

#### Critérios de Aceitação

1. WHEN o Frontend_Poller recebe novos eventos E o usuário NÃO está na página do Radar Geopolítico, THE In_App_Notification SHALL exibir uma notificação visual (toast/banner) informando sobre o novo evento
2. THE In_App_Notification SHALL exibir o título do evento, a severidade e a localização de forma resumida
3. WHEN o usuário clica na In_App_Notification, THE Sistema SHALL navegar o usuário para a página do Radar Geopolítico
4. WHEN o usuário ESTÁ na página do Radar Geopolítico, THE In_App_Notification SHALL NÃO ser exibida (os eventos já aparecem diretamente no mapa)
5. THE In_App_Notification SHALL desaparecer automaticamente após 10 segundos caso o usuário não interaja
