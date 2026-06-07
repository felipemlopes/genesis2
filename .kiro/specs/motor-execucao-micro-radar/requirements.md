# Documento de Requisitos — MotorExecução + Micro Radar

## Introdução

Este documento especifica os requisitos para duas funcionalidades críticas do sistema Genesis:

1. **MotorExecução (Etapa 8)**: Reescrita completa da lógica de cálculo de setups (setupLong/setupShort) para ancorar entradas, stops e take-profits em níveis estruturais reais (LVN, HVN, POC, clusters de liquidação, elementos visuais do LuxAlgo). Inclui geração de Plano A (antecipação no preço atual) e Plano B (entrada técnica em nível estrutural), validação de direção, RR mínimo 1:1.5 e recalculo dinâmico por alavancagem.

2. **Micro Radar**: Sistema de monitoramento em tempo real que detecta oportunidades e alerta membros via interface minimalista. Inclui correções no monitor_worker.py, endpoints API para revelação de alertas com débito de créditos, e componente frontend com polling.

## Glossário

- **MotorExecucao**: Serviço PHP (`MotorExecucaoService.php`) responsável por calcular matematicamente os parâmetros de execução de trades (entrada, stop, TPs, alavancagem, liquidação, RR).
- **Plano_A**: Setup de antecipação com entrada no preço atual, stop ancorado em nível estrutural e TPs em HVN/clusters acima.
- **Plano_B**: Setup de entrada técnica em nível estrutural específico (primeiro HVN abaixo para LONG, primeiro HVN acima para SHORT), stop mais curto, TPs recalculados.
- **HVN**: High Volume Node — zona de alto volume no Volume Profile, atua como suporte/resistência forte.
- **LVN**: Low Volume Node — zona de baixo volume no Volume Profile, preço tende a atravessar rapidamente.
- **POC**: Point of Control — nível de preço com maior volume negociado no período.
- **LuxAlgo**: Indicador do TradingView que fornece níveis de suporte/resistência visuais extraídos via OCR.
- **PDH**: Previous Day High — máxima do dia anterior.
- **PDL**: Previous Day Low — mínima do dia anterior.
- **ATR**: Average True Range — medida de volatilidade média.
- **RR**: Risk-Reward Ratio — relação risco/retorno entre stop e target.
- **Monitor_Worker**: Processo Python (`monitor_worker.py`) que monitora 15 pares via WebSocket em 4 exchanges e calcula scores em tempo real.
- **Score_Minimo**: Threshold numérico que dispara alertas OPORTUNIDADE (valor: 65).
- **Creditos**: Moeda interna do sistema que membros gastam para revelar e analisar oportunidades.
- **Frontend_Radar**: Componente React/TypeScript que exibe alertas de oportunidade ao membro.
- **Genesis_API**: Backend Laravel PHP que expõe endpoints REST para o sistema.

## Requisitos

### Requisito 1: Hierarquia de Stop para LONG (Plano A)

**User Story:** Como trader, quero que o stop do meu setup LONG seja ancorado no nível estrutural mais relevante abaixo do preço, para que o stop reflita zonas reais de invalidação da tese.

#### Critérios de Aceitação

1. WHEN a direção é LONG e existem LVN do LuxAlgo abaixo do preço, THE MotorExecucao SHALL usar o LVN mais próximo abaixo do preço como stop primário.
2. WHEN a direção é LONG e não existem LVN do LuxAlgo abaixo do preço, THE MotorExecucao SHALL buscar suporte visual (elementos visuais extraídos do gráfico) como segundo nível da hierarquia.
3. WHEN a direção é LONG e não existem LVN nem suportes visuais, THE MotorExecucao SHALL usar o PDL como terceiro nível da hierarquia.
4. WHEN a direção é LONG e não existem LVN, suportes visuais nem PDL válido, THE MotorExecucao SHALL usar o POC como quarto nível da hierarquia.
5. WHEN nenhum nível estrutural está disponível, THE MotorExecucao SHALL calcular o stop via ATR multiplicado pelo fator de volatilidade como fallback.
6. THE MotorExecucao SHALL posicionar o stop com margem de 0.3% abaixo do nível estrutural selecionado para evitar stops em wicks.

### Requisito 2: Hierarquia de Stop para SHORT (Plano A)

**User Story:** Como trader, quero que o stop do meu setup SHORT seja ancorado no nível estrutural mais relevante acima do preço, para que o stop reflita zonas reais de invalidação da tese.

#### Critérios de Aceitação

1. WHEN a direção é SHORT e existem HVN do LuxAlgo acima do preço, THE MotorExecucao SHALL usar o HVN mais próximo acima do preço como stop primário.
2. WHEN a direção é SHORT e não existem HVN do LuxAlgo acima do preço, THE MotorExecucao SHALL buscar resistência visual (elementos visuais extraídos do gráfico) como segundo nível da hierarquia.
3. WHEN a direção é SHORT e não existem HVN nem resistências visuais, THE MotorExecucao SHALL usar o PDH como terceiro nível da hierarquia.
4. WHEN a direção é SHORT e não existem HVN, resistências visuais nem PDH válido, THE MotorExecucao SHALL usar Fibonacci 0.618 da última perna como quarto nível da hierarquia.
5. WHEN nenhum nível estrutural está disponível, THE MotorExecucao SHALL calcular o stop via ATR multiplicado pelo fator de volatilidade como fallback.
6. THE MotorExecucao SHALL posicionar o stop com margem de 0.3% acima do nível estrutural selecionado para evitar stops em wicks.

### Requisito 3: Take-Profits Ancorados em Estrutura

**User Story:** Como trader, quero que os take-profits sejam ancorados em HVN, clusters de liquidação e POC, para que os alvos correspondam a zonas onde o preço tende a reagir.

#### Critérios de Aceitação

1. WHEN a direção é LONG, THE MotorExecucao SHALL definir TP1 como o primeiro HVN acima do preço de entrada.
2. WHEN a direção é LONG, THE MotorExecucao SHALL definir TP2 como o primeiro cluster de liquidação acima do preço de entrada.
3. WHEN a direção é LONG e não existem HVN acima, THE MotorExecucao SHALL usar POC como TP1 e PDH como TP2.
4. WHEN a direção é SHORT, THE MotorExecucao SHALL definir TP1 como o primeiro HVN abaixo do preço de entrada.
5. WHEN a direção é SHORT, THE MotorExecucao SHALL definir TP2 como o primeiro cluster de liquidação abaixo do preço de entrada.
6. WHEN a direção é SHORT e não existem HVN abaixo, THE MotorExecucao SHALL usar POC como TP1 e PDL como TP2.
7. THE MotorExecucao SHALL calcular TP3 como extensão de 8% além de TP2 na direção do trade.

### Requisito 4: Plano B — Entrada Técnica

**User Story:** Como trader, quero receber um Plano B com entrada em nível técnico específico, para que eu tenha uma alternativa com stop mais curto e melhor RR caso o preço recue ao nível ideal.

#### Critérios de Aceitação

1. WHEN a direção é LONG, THE MotorExecucao SHALL definir a entrada do Plano B no primeiro HVN abaixo do preço atual.
2. WHEN a direção é SHORT, THE MotorExecucao SHALL definir a entrada do Plano B no primeiro HVN acima do preço atual.
3. WHEN não existem HVN válidos para Plano B, THE MotorExecucao SHALL usar o POC como nível de entrada alternativo.
4. THE MotorExecucao SHALL calcular o stop do Plano B com multiplicador ATR reduzido em 20% em relação ao Plano A (fator 0.8x).
5. THE MotorExecucao SHALL recalcular TPs do Plano B usando a mesma hierarquia estrutural a partir do preço de entrada do Plano B.
6. THE MotorExecucao SHALL gerar campo descritivo explicando o cenário técnico necessário para validar a entrada do Plano B (Wyckoff, padrões gráficos, zonas de liquidez, CVD e pressão do orderbook).

### Requisito 5: Validação de Direção e RR Mínimo

**User Story:** Como trader, quero que o sistema valide a coerência direcional e garanta RR mínimo de 1.5, para que eu receba setups matematicamente viáveis e consistentes com o score.

#### Critérios de Aceitação

1. WHEN a direção é LONG e a entrada calculada está acima do stop, THE MotorExecucao SHALL validar o setup como geometricamente correto.
2. WHEN a direção é SHORT e a entrada calculada está abaixo do stop, THE MotorExecucao SHALL validar o setup como geometricamente correto.
3. IF a entrada LONG está abaixo do stop, THEN THE MotorExecucao SHALL rejeitar o setup e informar "Contradição geométrica: entrada abaixo do stop para LONG".
4. IF a entrada SHORT está acima do stop, THEN THE MotorExecucao SHALL rejeitar o setup e informar "Contradição geométrica: entrada acima do stop para SHORT".
5. WHEN o RR calculado é menor que 1.5, THE MotorExecucao SHALL tentar recalcular TPs buscando o próximo HVN disponível na direção do trade.
6. IF após recalcular TPs o RR continua menor que 1.5, THEN THE MotorExecucao SHALL informar o risco ao trader sem bloquear a operação.
7. WHEN o score viés indica direção oposta à direção do setup Gemini, THE MotorExecucao SHALL emitir alerta de contradição direcional no campo validacaoDirecao.

### Requisito 6: Alavancagem Dinâmica e Liquidação

**User Story:** Como trader, quero que cada mudança de alavancagem recalcule automaticamente stop em USD, preço de liquidação e RR, para que eu entenda o impacto real de cada nível de alavancagem.

#### Critérios de Aceitação

1. THE MotorExecucao SHALL recalcular preço de liquidação, risco percentual e RR sempre que a alavancagem for alterada.
2. WHEN a alavancagem é 1x, THE MotorExecucao SHALL exibir liquidação como "próxima de zero — sem risco prático".
3. WHEN o stop calculado está mais próximo do preço de liquidação que a margem de segurança de 5%, THE MotorExecucao SHALL reduzir a alavancagem em decrementos de 0.5 até atingir margem segura.
4. THE MotorExecucao SHALL limitar a alavancagem máxima com base no score: score < 50 limita a 2x, score 50-64 limita a 3x, score 65-74 limita a 5x, score >= 75 permite até 10x.
5. THE MotorExecucao SHALL exibir o tamanho sugerido da posição no formato "$margem (Nx) = $total → quantidade contratos | Risco: $USD".

### Requisito 7: Carga de Histórico Inicial no Monitor Worker (Correção A)

**User Story:** Como operador do sistema, quero que o monitor_worker carregue 200 candles iniciais via REST API ao iniciar, para que o scoring funcione imediatamente sem precisar aguardar 50h de dados WebSocket.

#### Critérios de Aceitação

1. WHEN o Monitor_Worker é inicializado, THE Monitor_Worker SHALL carregar 200 candles via REST API da Binance Futures para cada par monitorado.
2. WHEN a carga inicial falha para um par específico, THE Monitor_Worker SHALL registrar warning no log e continuar com os demais pares sem interromper a inicialização.
3. WHEN a carga inicial é concluída, THE Monitor_Worker SHALL registrar no log a quantidade de pares carregados com sucesso.
4. THE Monitor_Worker SHALL armazenar os candles carregados no candles_cache com chave "{symbol}_BINANCE".

### Requisito 8: Bloqueio de Alertas Consecutivos do Mesmo Par (Correção B)

**User Story:** Como membro, quero que o mesmo par nunca apareça em dois alertas OPORTUNIDADE consecutivos, para que o radar apresente diversidade de oportunidades.

#### Critérios de Aceitação

1. WHEN um alerta OPORTUNIDADE é disparado para um par, THE Monitor_Worker SHALL registrar o par como último par alertado.
2. WHEN o próximo alerta OPORTUNIDADE é para o mesmo par do último alerta, THE Monitor_Worker SHALL descartar o alerta silenciosamente e aguardar o próximo par diferente.
3. THE Monitor_Worker SHALL permitir que o mesmo par volte a gerar alertas após qualquer outro par ter gerado um alerta intermediário.

### Requisito 9: Disparo de Alerta OPORTUNIDADE (Correção C)

**User Story:** Como membro, quero receber alertas OPORTUNIDADE quando o score de um par ultrapassa o threshold, para que eu seja notificado de oportunidades em tempo real.

#### Critérios de Aceitação

1. WHEN o score calculado de um par ultrapassa o Score_Minimo, THE Monitor_Worker SHALL disparar um alerta do tipo OPORTUNIDADE via processar_alerta().
2. THE Monitor_Worker SHALL incluir no alerta OPORTUNIDADE os campos: ativo, tipo="OPORTUNIDADE", direcao do viés, urgencia="ALTA", corretora, preco_atual e score.
3. IF o alerta OPORTUNIDADE é para o mesmo par do último alerta OPORTUNIDADE, THEN THE Monitor_Worker SHALL descartar o alerta conforme regra de bloqueio consecutivo.

### Requisito 10: Threshold de Score Ajustado (Correção D)

**User Story:** Como operador do sistema, quero que o threshold de score para alertas seja 65, para que mais oportunidades válidas sejam detectadas sem comprometer qualidade.

#### Critérios de Aceitação

1. THE Monitor_Worker SHALL usar 65 como valor de SCORE_MINIMO para disparo de alertas.
2. WHEN o score de um par atinge exatamente 65, THE Monitor_Worker SHALL considerar o threshold como ultrapassado e disparar o alerta.

### Requisito 11: Chamada de detectar_book_imbalance em processar_candle (Correção E)

**User Story:** Como operador do sistema, quero que a função detectar_book_imbalance() seja chamada durante o processamento de cada candle, para que imbalances do orderbook sejam detectados em tempo real.

#### Critérios de Aceitação

1. WHEN um candle é processado pelo Monitor_Worker, THE Monitor_Worker SHALL chamar detectar_book_imbalance() com os dados de mercado do ativo.
2. WHEN detectar_book_imbalance() identifica imbalance significativo (ratio > 0.6 ou < -0.6), THE Monitor_Worker SHALL disparar alerta do tipo BOOK_IMBALANCE.

### Requisito 12: API — Listar Alertas do Radar

**User Story:** Como membro, quero consultar o último alerta de oportunidade disponível sem ver detalhes do par, para que eu saiba que existe uma oportunidade antes de gastar créditos.

#### Critérios de Aceitação

1. WHEN um membro faz GET /api/radar/alertas, THE Genesis_API SHALL retornar o alerta OPORTUNIDADE mais recente ainda não revelado pelo membro.
2. THE Genesis_API SHALL retornar apenas campos genéricos do alerta: id, tipo, urgencia, criado_em e status.
3. THE Genesis_API SHALL omitir os campos ativo, corretora e timeframe na resposta de listagem.
4. WHEN não existem alertas pendentes, THE Genesis_API SHALL retornar resposta vazia com status 200.

### Requisito 13: API — Revelar Alerta (Débito de Créditos)

**User Story:** Como membro, quero revelar uma oportunidade pagando 50 créditos, para que eu tenha acesso ao par, exchange e timeframe e possa prosseguir para análise.

#### Critérios de Aceitação

1. WHEN um membro faz POST /api/radar/revelar/{id}, THE Genesis_API SHALL verificar se o membro possui saldo mínimo de 50 créditos.
2. WHEN o saldo é suficiente, THE Genesis_API SHALL debitar 50 créditos do saldo do membro.
3. WHEN o débito é realizado, THE Genesis_API SHALL retornar os campos revelados: ativo, corretora, timeframe.
4. IF o saldo do membro é inferior a 50 créditos, THEN THE Genesis_API SHALL retornar erro 402 com mensagem "Créditos insuficientes".
5. IF o alerta já foi revelado pelo mesmo membro, THEN THE Genesis_API SHALL retornar os dados revelados sem debitar créditos novamente.
6. THE Genesis_API SHALL registrar a revelação no histórico do membro com timestamp.

### Requisito 14: API — Histórico de Alertas Revelados

**User Story:** Como membro, quero consultar meu histórico dos últimos 50 alertas já revelados, para que eu possa revisitar oportunidades passadas.

#### Critérios de Aceitação

1. WHEN um membro faz GET /api/radar/historico, THE Genesis_API SHALL retornar os últimos 50 alertas revelados pelo membro, ordenados por data decrescente.
2. THE Genesis_API SHALL incluir nos resultados: id, ativo, corretora, timeframe, criado_em e revelado_em.
3. THE Genesis_API SHALL omitir a direção do alerta nos resultados do histórico.
4. THE Genesis_API SHALL paginar resultados com limit padrão de 50 registros.

### Requisito 15: Frontend — Exibição de Oportunidade Detectada

**User Story:** Como membro, quero ver uma notificação visual "Oportunidade detectada" com botão pulsante ANALISAR quando existe um alerta disponível, para que eu identifique rapidamente que há algo para analisar.

#### Critérios de Aceitação

1. THE Frontend_Radar SHALL fazer polling GET /api/radar/alertas a cada 30 segundos.
2. WHEN a API retorna um alerta pendente, THE Frontend_Radar SHALL exibir o texto "Oportunidade detectada" e um botão ANALISAR com animação de pulso.
3. THE Frontend_Radar SHALL omitir qualquer informação sobre par, exchange, direção ou tipo de anomalia na tela de radar.
4. WHEN o membro clica em ANALISAR, THE Frontend_Radar SHALL fazer POST /api/radar/revelar/{id} para debitar créditos e obter dados do par.
5. WHEN a revelação é bem-sucedida, THE Frontend_Radar SHALL redirecionar o membro para a tela de análise Genesis com par, exchange e timeframe pré-preenchidos.
6. IF a revelação falha por créditos insuficientes, THEN THE Frontend_Radar SHALL exibir mensagem "Créditos insuficientes" sem redirecionar.

### Requisito 16: Fluxo Completo de Créditos por Oportunidade

**User Story:** Como operador do sistema, quero que cada oportunidade analisada custe 150 créditos no total (50 para revelar + 100 para análise), para que o modelo de monetização funcione corretamente.

#### Critérios de Aceitação

1. WHEN o membro clica ANALISAR no radar, THE Genesis_API SHALL debitar 50 créditos pela revelação.
2. WHEN o membro envia o gráfico para análise na tela Genesis, THE Genesis_API SHALL debitar 100 créditos pela análise completa.
3. THE Genesis_API SHALL verificar saldo suficiente antes de cada débito separadamente.
4. IF o membro possui 50 créditos mas não possui 100 adicionais, THEN THE Genesis_API SHALL permitir a revelação mas bloquear a análise com mensagem "Créditos insuficientes para análise".
