# Plano de Implementação: Monitoramento de Carteiras com Alertas Telegram

## Visão Geral

Implementação do sistema de monitoramento de variação das carteiras Mãe e Gema com disparo de alertas escalonados via Telegram. O plano segue uma abordagem incremental: banco de dados → serviços backend → controllers → cron job → frontend → testes.

## Tarefas

- [x] 1. Migrações de banco de dados
  - [x] 1.1 Criar tabelas de alerta (genesis_alerta_config, genesis_alerta_estado, genesis_alerta_log)
    - Criar arquivo SQL com as 3 tabelas conforme design: `genesis_alerta_config`, `genesis_alerta_estado`, `genesis_alerta_log`
    - Incluir índices, constraints UNIQUE e valores DEFAULT
    - _Requisitos: 7.1, 7.2, 7.3, 11.1, 11.2, 11.3, 11.4_

  - [x] 1.2 Alterar tabelas existentes para adicionar campo baseline_valor
    - Executar ALTER TABLE em `genesis_carteira_mae` e `genesis_carteira_gemas` adicionando coluna `baseline_valor DECIMAL(20,8)`
    - _Requisitos: 6.1, 6.2_

- [x] 2. Implementar ExchangeService (Backend PHP)
  - [x] 2.1 Criar classe ExchangeService com método buscarPrecoSpot
    - Criar `e:\Programas\wamp64\www\genesis-api\services\ExchangeService.php`
    - Implementar consulta de preço spot para Binance, Bybit, Bitget e OKX usando suas APIs REST públicas
    - Implementar timeout de 10 segundos e tratamento de erros HTTP 4xx/5xx
    - _Requisitos: 5.1, 8.1, 8.4_

  - [x] 2.2 Implementar método buscarParesTrading no ExchangeService
    - Buscar lista de pares de trading disponíveis em cada corretora
    - Retornar array de pares ou mensagem de erro em caso de falha/timeout
    - _Requisitos: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 2.3 Escrever testes unitários para ExchangeService
    - Testar timeout de 10s retorna erro apropriado
    - Testar exchange retorna lista vazia
    - Testar fallback quando exchange retorna erro HTTP
    - _Requisitos: 5.3, 5.4, 8.4_

- [x] 3. Implementar TelegramService (Backend PHP)
  - [x] 3.1 Criar classe TelegramService com método enviarAlerta
    - Criar `e:\Programas\wamp64\www\genesis-api\services\TelegramService.php`
    - Ler TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID das variáveis de ambiente
    - Implementar envio via API do Telegram Bot (sendMessage)
    - Implementar retry com espera de 1s em caso de rate limit
    - Retornar boolean indicando sucesso/falha
    - _Requisitos: 10.1, 10.2, 10.3_

  - [ ]* 3.2 Escrever testes unitários para TelegramService
    - Testar que falha no envio retorna false e não lança exceção
    - Testar retry em caso de rate limit (HTTP 429)
    - _Requisitos: 10.3_

- [x] 4. Implementar MonitoramentoService (Backend PHP)
  - [x] 4.1 Criar classe MonitoramentoService com método calcularValorCarteira
    - Criar `e:\Programas\wamp64\www\genesis-api\services\MonitoramentoService.php`
    - Buscar todos os ativos ativos da carteira (mae ou gemas)
    - Para cada ativo, consultar preço atual via ExchangeService
    - Se preço indisponível, usar último `preco_atual` da tabela
    - Calcular soma total dos preços atuais
    - _Requisitos: 8.1, 8.2, 8.4_

  - [x] 4.2 Implementar método calcularVariacao
    - Aplicar fórmula: ((valor_atual - baseline) / baseline) * 100
    - Retornar variação percentual como float
    - _Requisitos: 6.3_

  - [ ]* 4.3 Escrever teste de propriedade para fórmula de variação
    - **Propriedade 10: Fórmula de variação percentual**
    - **Valida: Requisito 6.3**

  - [x] 4.4 Implementar método verificarLimiares
    - Calcular passo atingido: floor(|variação| / passo_configurado)
    - Determinar direção (valorização se positivo, desvalorização se negativo)
    - Comparar com último passo disparado no banco (genesis_alerta_estado)
    - Retornar passo atingido se maior que último disparado, ou null
    - _Requisitos: 8.3, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 4.5 Escrever teste de propriedade para determinação de passo
    - **Propriedade 14: Determinação de passo atingido**
    - **Valida: Requisito 8.3**

  - [ ]* 4.6 Escrever teste de propriedade para disparo de alerta ao atingir novo passo
    - **Propriedade 15: Disparo de alerta ao atingir novo passo**
    - **Valida: Requisitos 9.1, 9.2**

  - [ ]* 4.7 Escrever teste de propriedade para idempotência
    - **Propriedade 16: Idempotência — não reenvia alerta do mesmo passo**
    - **Valida: Requisito 9.3**

  - [ ]* 4.8 Escrever teste de propriedade para salto múltiplo
    - **Propriedade 17: Salto múltiplo — alerta apenas do passo mais recente**
    - **Valida: Requisito 9.4**

  - [x] 4.9 Implementar método executarCiclo
    - Orquestrar o ciclo completo: ler config → calcular valor → calcular variação → verificar limiares → disparar alerta → persistir estado
    - Formatar mensagem com campos obrigatórios: nome carteira, tipo variação, percentual, valor atual, baseline
    - Registrar alerta em genesis_alerta_log com flag enviado_com_sucesso
    - Atualizar genesis_alerta_estado somente se envio Telegram for bem-sucedido
    - _Requisitos: 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [ ]* 4.10 Escrever teste de propriedade para mensagem de alerta
    - **Propriedade 18: Mensagem de alerta contém campos obrigatórios**
    - **Valida: Requisito 9.5**

- [x] 5. Checkpoint — Verificar serviços backend
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 6. Implementar Controllers (Backend PHP)
  - [x] 6.1 Criar AlertaConfigController
    - Criar `e:\Programas\wamp64\www\genesis-api\controllers\AlertaConfigController.php`
    - GET /api/v1/admin/alerta-config → retorna configurações de ambas as carteiras
    - PUT /api/v1/admin/alerta-config/{carteira} → atualiza configuração (validar: passo > 0 e <= 100, intervalo >= 1 e <= 1440)
    - Verificar permissão de admin em ambas as rotas
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 6.2 Escrever teste de propriedade para round-trip de configuração
    - **Propriedade 12: Round-trip de configuração de alertas**
    - **Valida: Requisitos 7.1, 7.2, 7.3**

  - [x] 6.3 Criar MonitorController
    - Criar `e:\Programas\wamp64\www\genesis-api\controllers\MonitorController.php`
    - GET /api/v1/admin/monitor/status → retorna estado atual (último check, variação, próximo passo)
    - POST /api/v1/admin/monitor/reset/{carteira} → reseta estado de alertas (zera ultimo_passo_disparado)
    - GET /api/v1/admin/monitor/log → retorna histórico de alertas com paginação
    - _Requisitos: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 7. Implementar lógica de Baseline nas carteiras
  - [x] 7.1 Atualizar lógica de criação de carteira para registrar baseline
    - Ao criar Carteira_Mãe ou Carteira_Gema, calcular soma dos preços de entrada e salvar em baseline_valor
    - Criar registro correspondente em genesis_alerta_config com o baseline
    - _Requisitos: 6.1_

  - [ ]* 7.2 Escrever teste de propriedade para baseline na criação
    - **Propriedade 8: Baseline calculado na criação**
    - **Valida: Requisito 6.1**

  - [x] 7.3 Atualizar lógica de adição de ativo para recalcular baseline
    - Ao adicionar novo ativo à carteira, somar preco_entrada ao baseline existente
    - Atualizar genesis_alerta_config.baseline e genesis_carteira_mae/gemas.baseline_valor
    - _Requisitos: 6.4_

  - [ ]* 7.4 Escrever teste de propriedade para baseline ao adicionar ativo
    - **Propriedade 11: Baseline atualizado ao adicionar ativo**
    - **Valida: Requisito 6.4**

- [x] 8. Implementar Cron Job (cron_monitoramento.php)
  - [x] 8.1 Criar script cron_monitoramento.php
    - Criar `e:\Programas\wamp64\www\genesis-api\cron_monitoramento.php`
    - Carregar dependências e configuração do banco
    - Instanciar MonitoramentoService e chamar executarCiclo()
    - Verificar se intervalo mínimo desde último check foi respeitado
    - Registrar início e fim da execução em log
    - _Requisitos: 8.1, 8.2, 8.3, 11.5_

  - [ ]* 8.2 Escrever teste de propriedade para persistência de estado
    - **Propriedade 19: Persistência e recuperação de estado de alertas**
    - **Valida: Requisitos 11.1, 11.2, 11.3, 11.4, 11.5**

- [x] 9. Checkpoint — Verificar backend completo
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

- [x] 10. Implementar componentes Frontend (React/TypeScript)
  - [x] 10.1 Criar serviço de API para alertas no frontend
    - Adicionar funções em `services/api.ts` (ou criar novo arquivo) para chamar os endpoints:
      - GET /api/v1/admin/alerta-config
      - PUT /api/v1/admin/alerta-config/{carteira}
      - GET /api/v1/admin/monitor/status
      - POST /api/v1/admin/monitor/reset/{carteira}
      - GET /api/v1/admin/monitor/log
    - _Requisitos: 7.1, 7.2, 7.3_

  - [x] 10.2 Criar componente AlertConfigPanel.tsx
    - Criar painel de configuração de alertas (somente visível para admin)
    - Campos: passo_valorizacao, passo_desvalorizacao, intervalo_minutos, toggle ativo/inativo
    - Separar configuração por carteira (Mãe e Gema)
    - Validação de campos no frontend (passo > 0, intervalo >= 1)
    - Integrar com endpoint PUT para salvar configurações
    - _Requisitos: 7.1, 7.2, 7.3, 7.4_

  - [x] 10.3 Criar componente MonitorStatusWidget.tsx
    - Exibir estado atual do monitoramento: último check, variação atual, último passo disparado
    - Botão de reset de alertas por carteira
    - Exibir histórico de alertas enviados (últimos N registros)
    - Integrar com endpoints GET /status e GET /log
    - _Requisitos: 11.1, 11.2, 11.3, 11.4_

  - [x] 10.4 Integrar componentes na página de carteiras
    - Adicionar AlertConfigPanel e MonitorStatusWidget na página CarteiraCripto.tsx
    - Condicionar exibição à permissão de admin
    - Ocultar botões de edição/criação/exclusão para membros sem permissão
    - _Requisitos: 3.1, 3.2, 3.3, 7.4_

- [ ] 11. Testes de propriedade adicionais (Frontend)
  - [ ]* 11.1 Escrever teste de propriedade para cálculo de valor total da carteira
    - **Propriedade 13: Cálculo de valor total da carteira**
    - **Valida: Requisito 8.2**

  - [ ]* 11.2 Escrever teste de propriedade para controle de acesso
    - **Propriedade 5: Controle de acesso — operações admin-only**
    - **Valida: Requisitos 2.5, 7.4**

- [x] 12. Checkpoint final — Garantir integração completa
  - Garantir que todos os testes passam, perguntar ao usuário se houver dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
- O cron job deve ser configurado no Windows Task Scheduler (ambiente WAMP)
