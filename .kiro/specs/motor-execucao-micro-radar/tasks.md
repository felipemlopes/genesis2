# Plano de Implementação: MotorExecução + Micro Radar

## Visão Geral

Implementação em 4 fases: reescrita do MotorExecucaoService (PHP), correções no monitor_worker (Python), API Micro Radar (Laravel) e componente frontend (React/TypeScript). Cada fase constrói sobre a anterior.

## Tasks

- [x] 1. Reescrita do MotorExecucaoService — Hierarquia de Stops e TPs
  - [x] 1.1 Implementar calcularStopLong() com hierarquia LVN > suporte visual > PDL > POC > ATR fallback
    - Criar método privado estático que percorre a hierarquia e retorna o stop com margem 0.3%
    - Adicionar constante MARGEM_WICK = 0.003
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Implementar calcularStopShort() com hierarquia HVN > resistência visual > PDH > Fibonacci 0.618 > ATR fallback
    - Criar método privado estático análogo ao LONG com margem 0.3% acima
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.3 Implementar calcularTPs() com ancoragem em estrutura
    - LONG: TP1=primeiro HVN acima, TP2=primeiro cluster liq acima, TP3=TP2*1.08
    - SHORT: TP1=primeiro HVN abaixo, TP2=primeiro cluster liq abaixo, TP3=TP2*0.92
    - Fallbacks: POC, PDH/PDL conforme design
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 1.4 Reescrever setupLong() usando calcularStopLong() e calcularTPs()
    - Substituir lógica atual por chamadas aos novos métodos de hierarquia
    - Adicionar campo 'hierarquiaStop' no retorno indicando nível utilizado
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 3.3_

  - [x] 1.5 Reescrever setupShort() usando calcularStopShort() e calcularTPs()
    - Substituir lógica atual por chamadas aos novos métodos de hierarquia
    - Adicionar campo 'hierarquiaStop' no retorno
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.4, 3.5, 3.6_

  - [ ]* 1.6 Escrever property tests P1 e P2 — Hierarquia de Stop LONG e SHORT
    - **Property 1: Hierarquia de Stop LONG respeita prioridade estrutural**
    - **Property 2: Hierarquia de Stop SHORT respeita prioridade estrutural**
    - **Validates: Requirements 1.1-1.5, 2.1-2.5**

  - [ ]* 1.7 Escrever property tests P3, P4, P5, P6 — Margem e TPs
    - **Property 3: Margem de 0.3% aplicada a stops estruturais**
    - **Property 4: Take-Profits LONG ancorados em estrutura**
    - **Property 5: Take-Profits SHORT ancorados em estrutura**
    - **Property 6: TP3 é extensão de 8% além de TP2**
    - **Validates: Requirements 1.6, 2.6, 3.1-3.7**

- [x] 2. MotorExecucaoService — Plano B, Validação e Alavancagem
  - [x] 2.1 Reescrever gerarPlanoB() com entrada no HVN e stop ATR*0.8
    - LONG: entrada no primeiro HVN abaixo (fallback POC), stop com multiplicador 0.8x
    - SHORT: entrada no primeiro HVN acima (fallback POC), stop com multiplicador 0.8x
    - Recalcular TPs a partir da entrada do Plano B
    - Gerar campo 'descricao' com narrativa técnica (>= 20 chars)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 2.2 Implementar validarGeometria() e lógica de RR mínimo 1.5
    - LONG: entrada > stop → OK; senão rejeitar com "Contradição geométrica"
    - SHORT: entrada < stop → OK; senão rejeitar
    - Se RR < 1.5: buscar próximo HVN como novo TP1, recalcular
    - Se ainda < 1.5: informar risco sem bloquear
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 2.3 Implementar validarDirecao() com alerta de contradição
    - score > 54 + SHORT → consistente=false
    - score < 45 + LONG → consistente=false
    - Adicionar campo alertaContradicao no retorno
    - _Requirements: 5.7_

  - [x] 2.4 Implementar limitarAlavancagemPorScore() e recalcularPorAlavancagem()
    - Score < 50 → max 2x; 50-64 → max 3x; 65-74 → max 5x; >= 75 → max 10x
    - Alavancagem 1x → liquidacao "N/A (1x)"
    - Loop de redução 0.5 quando stop dentro da margem 5% da liquidação
    - Formato tamanhoSugerido: "$margem (Nx) = $total → quantidade | Risco: $USD"
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.5 Integrar todos os novos métodos em gerarSetup()
    - Conectar calcularStopLong/Short, calcularTPs, gerarPlanoB, validarGeometria, validarDirecao, limitarAlavancagemPorScore
    - Garantir que GeminiAnalysisService continua chamando gerarSetup() sem alteração de assinatura
    - _Requirements: 1-6 (integração completa)_

  - [ ]* 2.6 Escrever property tests P7-P10 — Plano B
    - **Property 7: Plano B entrada no HVN correto com fallback POC**
    - **Property 8: Plano B stop usa multiplicador ATR 0.8x**
    - **Property 9: Plano B TPs calculados a partir da entrada B**
    - **Property 10: Plano B inclui descrição técnica não-vazia**
    - **Validates: Requirements 4.1-4.6**

  - [ ]* 2.7 Escrever property tests P11-P17 — Validação e Alavancagem
    - **Property 11: Consistência geométrica entrada/stop/direção**
    - **Property 12: Recálculo de TPs quando RR < 1.5**
    - **Property 13: Alerta de contradição direcional**
    - **Property 14: Invariante de segurança stop/liquidação**
    - **Property 15: Alavancagem 1x implica liquidação nula**
    - **Property 16: Limite de alavancagem por faixa de score**
    - **Property 17: Formato do tamanho sugerido**
    - **Validates: Requirements 5.1-5.7, 6.1-6.5**

- [x] 3. Checkpoint — Verificar MotorExecucaoService
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Correções do Monitor Worker (Python)
  - [x] 4.1 Implementar método _disparar_oportunidade() com bloqueio consecutivo
    - Verificar _ultimo_par_oportunidade antes de disparar
    - Atualizar _ultimo_par_oportunidade após disparo
    - Chamar processar_alerta() com tipo='OPORTUNIDADE', urgencia='ALTA'
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2_

  - [x] 4.2 Integrar disparo OPORTUNIDADE no loop de processamento de candle
    - Após calcular_indicadores_e_score(), verificar se score >= 65
    - Se sim, chamar _disparar_oportunidade()
    - Garantir que filtrar_score() usa >= (não >) para incluir exatamente 65
    - _Requirements: 9.1, 9.3, 10.1, 10.2_

  - [x] 4.3 Adicionar chamada detectar_book_imbalance() no processamento de candle
    - Chamar _calcular_book_imbalance(symbol) dentro do loop de candle
    - Se ratio > 0.6 ou < -0.6: disparar alerta BOOK_IMBALANCE
    - _Requirements: 11.1, 11.2_

  - [x] 4.4 Verificar e corrigir _carregar_historico_inicial()
    - Garantir que carrega 200 candles por par via REST Binance Futures
    - Warning no log se falhar para um par (sem interromper)
    - Log final com quantidade de pares carregados
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 4.5 Escrever property tests P18-P20 com Hypothesis
    - **Property 18: Bloqueio de par consecutivo em OPORTUNIDADE**
    - **Property 19: Estrutura do alerta OPORTUNIDADE**
    - **Property 20: Alerta de book imbalance por threshold**
    - **Validates: Requirements 8.1-8.3, 9.1-9.2, 11.2**

- [x] 5. Checkpoint — Verificar Monitor Worker
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API Micro Radar — Migration, Model e Controller
  - [x] 6.1 Criar migration para tabela user_revelacoes
    - Campos: id, user_id, alerta_id, revelado_em, timestamps
    - Unique key (user_id, alerta_id)
    - Index (user_id, revelado_em DESC)
    - Foreign keys para users e genesis_alertas
    - _Requirements: 13.6_

  - [x] 6.2 Criar model UserRevelacao com relacionamentos
    - Fillable: user_id, alerta_id, revelado_em
    - Cast revelado_em como datetime
    - Relationships: belongsTo User, belongsTo Alerta (genesis_alertas)
    - _Requirements: 13.5, 13.6_

  - [x] 6.3 Criar RadarController com endpoint alertas()
    - GET /api/v1/radar/alertas — retorna último alerta OPORTUNIDADE não revelado
    - Omitir campos ativo, corretora, timeframe, direcao
    - Retornar apenas: id, tipo, urgencia, criado_em, status
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 6.4 Implementar endpoint revelar() no RadarController
    - POST /api/v1/radar/revelar/{id} — verificar saldo >= 50
    - Debitar 50 créditos via wallet (withdrawFloat)
    - Registrar em user_revelacoes
    - Retornar ativo, corretora, timeframe
    - Idempotente: se já revelado, retornar sem debitar
    - Erro 402 se saldo insuficiente
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [x] 6.5 Implementar endpoint historico() no RadarController
    - GET /api/v1/radar/historico — últimos 50 alertas revelados pelo membro
    - Ordenados por revelado_em DESC
    - Incluir: id, ativo, corretora, timeframe, criado_em, revelado_em
    - Omitir direcao
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 6.6 Registrar rotas no arquivo de rotas da API
    - Adicionar grupo /radar com middleware auth:sanctum
    - GET /radar/alertas → RadarController@alertas
    - POST /radar/revelar/{id} → RadarController@revelar
    - GET /radar/historico → RadarController@historico
    - _Requirements: 12, 13, 14_

  - [ ]* 6.7 Escrever property tests P21-P25 — API Micro Radar
    - **Property 21: Listagem do radar omite campos sensíveis**
    - **Property 22: Débito de créditos na revelação**
    - **Property 23: Idempotência da revelação**
    - **Property 24: Histórico ordenado e limitado a 50**
    - **Property 25: Verificações de saldo independentes por operação**
    - **Validates: Requirements 12.1-12.3, 13.1-13.5, 14.1-14.4, 16.2-16.3**

- [ ] 7. Checkpoint — Verificar API Micro Radar
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend — MicroRadarPanel
  - [x] 8.1 Criar componente MicroRadarPanel.tsx com polling 30s
    - Implementar useEffect com setInterval de 30000ms chamando GET /api/v1/radar/alertas
    - State para alerta atual, loading e erro
    - Limpar interval no cleanup
    - _Requirements: 15.1_

  - [x] 8.2 Implementar UI "Oportunidade detectada" com botão ANALISAR pulsante
    - Exibir texto "Oportunidade detectada" quando alerta pendente
    - Botão ANALISAR com classe animate-pulse (Tailwind)
    - Omitir qualquer informação de par, exchange, direção
    - _Requirements: 15.2, 15.3_

  - [x] 8.3 Implementar handler handleAnalisar() com revelação e redirecionamento
    - POST /api/v1/radar/revelar/{id} ao clicar ANALISAR
    - Se sucesso: redirecionar para tela de análise com par, exchange e timeframe
    - Se 402: exibir mensagem "Créditos insuficientes"
    - _Requirements: 15.4, 15.5, 15.6_

  - [x] 8.4 Integrar MicroRadarPanel no layout principal da aplicação
    - Importar e renderizar componente no local adequado do dashboard
    - _Requirements: 15.1_

- [ ] 9. Checkpoint Final — Verificar integração completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser ignoradas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental entre fases
- Property tests validam propriedades universais de correção
- Unit tests validam exemplos específicos e edge cases
