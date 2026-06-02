# Documento de Requisitos — Carteiras Mãe & Gema: Monitoramento com Alertas Telegram

## Introdução

Este documento especifica os requisitos para o sistema de monitoramento de variação das carteiras Mãe e Gema no G-nesis 2.0, com disparo de alertas automáticos via Telegram. O sistema calcula a variação percentual do valor total de cada carteira em relação ao valor de criação (baseline fixo) e envia notificações escalonadas para um grupo Telegram fixo quando limiares configurados são atingidos.

## Glossário

- **Sistema**: A plataforma G-nesis 2.0 (frontend React/TypeScript + backend PHP)
- **Carteira_Mãe**: Carteira única no sistema, gerenciada exclusivamente pelo administrador, contendo ativos do tipo "PRJ" (projetos)
- **Carteira_Gema**: Carteira única no sistema, gerenciada exclusivamente pelo administrador, contendo ativos do tipo "GEMA" (gemas)
- **Carteira_Individual**: Carteira pessoal de cada membro, sem monitoramento automático
- **Admin**: Usuário com permissões administrativas completas
- **Membro**: Usuário regular do sistema com permissões limitadas
- **Baseline**: Valor total da carteira no momento de sua criação, usado como referência fixa para cálculo de variação
- **Variação**: Diferença percentual entre o valor atual da carteira e o Baseline
- **Passo_Alerta**: Incremento percentual configurado que define os limiares de disparo (ex: 5%, 10%, 15%)
- **Corretora_API**: Interface de programação da corretora (Binance, Bybit, Bitget, OKX) para consulta de pares e preços
- **Par_Trading**: Par de negociação disponível na corretora (ex: BTCUSDT, ETHBTC)
- **Módulo_Monitoramento**: Componente backend responsável por verificar periodicamente a variação das carteiras
- **Serviço_Telegram**: Componente backend responsável por enviar mensagens ao grupo Telegram fixo

## Requisitos

### Requisito 1: Unicidade das Carteiras Mãe e Gema

**User Story:** Como administrador, quero que exista apenas uma Carteira Mãe e uma Carteira Gema no sistema, para que sirvam como referência única para todos os membros.

#### Critérios de Aceitação

1. THE Sistema SHALL garantir que exista no máximo uma Carteira_Mãe ativa no sistema
2. THE Sistema SHALL garantir que exista no máximo uma Carteira_Gema ativa no sistema
3. IF o Admin tentar criar uma segunda Carteira_Mãe ou Carteira_Gema, THEN THE Sistema SHALL rejeitar a operação e exibir mensagem informando que a carteira já existe

### Requisito 2: Gestão de Carteiras pelo Administrador

**User Story:** Como administrador, quero criar, editar e excluir as carteiras Mãe e Gema, para gerenciar os ativos de referência do grupo.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Admin crie a Carteira_Mãe com os campos: ativo, corretora, par de trading, preço de entrada e data de entrada
2. THE Sistema SHALL permitir que o Admin crie a Carteira_Gema com os campos: ativo, corretora, par de trading, preço de entrada e data de entrada
3. THE Sistema SHALL permitir que o Admin edite qualquer campo dos ativos nas carteiras Mãe e Gema
4. THE Sistema SHALL permitir que o Admin remova ativos individuais das carteiras Mãe e Gema
5. IF um Membro sem permissão de Admin tentar criar, editar ou excluir a Carteira_Mãe ou Carteira_Gema, THEN THE Sistema SHALL bloquear a operação e exibir mensagem de permissão negada

### Requisito 3: Visualização de Carteiras por Membros

**User Story:** Como membro, quero visualizar as carteiras Mãe e Gema, para acompanhar os ativos de referência do grupo.

#### Critérios de Aceitação

1. THE Sistema SHALL exibir a Carteira_Mãe para todos os Membros autenticados em modo somente leitura
2. THE Sistema SHALL exibir a Carteira_Gema para todos os Membros autenticados em modo somente leitura
3. THE Sistema SHALL ocultar os botões de edição, criação e exclusão da Carteira_Mãe e Carteira_Gema para Membros sem permissão de Admin

### Requisito 4: Carteira Individual do Membro

**User Story:** Como membro, quero gerenciar minha própria carteira individual, para acompanhar meus investimentos pessoais.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que cada Membro crie, edite e exclua ativos em sua própria Carteira_Individual
2. THE Sistema SHALL impedir que um Membro acesse ou modifique a Carteira_Individual de outro Membro
3. THE Sistema SHALL não aplicar monitoramento automático de variação na Carteira_Individual

### Requisito 5: Busca de Pares de Trading via API da Corretora

**User Story:** Como administrador, quero selecionar pares de trading disponíveis na corretora ao adicionar um ativo, para garantir que apenas pares válidos sejam cadastrados.

#### Critérios de Aceitação

1. WHEN o Admin selecionar uma corretora ao adicionar ou editar um ativo, THE Sistema SHALL buscar todos os pares de trading disponíveis na Corretora_API correspondente
2. THE Sistema SHALL apresentar os pares retornados pela Corretora_API em uma lista selecionável para o Admin
3. IF a Corretora_API não responder dentro de 10 segundos, THEN THE Sistema SHALL exibir mensagem de erro informando falha na comunicação com a corretora
4. IF a Corretora_API retornar lista vazia, THEN THE Sistema SHALL informar que nenhum par foi encontrado para a corretora selecionada

### Requisito 6: Cálculo de Variação com Baseline Fixo

**User Story:** Como administrador, quero que a variação da carteira seja calculada com base no valor de criação, para ter uma referência fixa e confiável de desempenho.

#### Critérios de Aceitação

1. WHEN a Carteira_Mãe ou Carteira_Gema for criada, THE Sistema SHALL registrar o valor total da carteira naquele momento como Baseline
2. THE Sistema SHALL manter o Baseline inalterado durante toda a vida útil da carteira
3. THE Módulo_Monitoramento SHALL calcular a variação percentual usando a fórmula: ((valor_atual - Baseline) / Baseline) * 100
4. WHEN novos ativos forem adicionados à carteira após a criação, THE Sistema SHALL recalcular o Baseline somando o valor de entrada do novo ativo ao Baseline existente

### Requisito 7: Configuração de Alertas pelo Administrador

**User Story:** Como administrador, quero configurar os parâmetros de alerta para cada carteira, para controlar quando as notificações são disparadas.

#### Critérios de Aceitação

1. THE Sistema SHALL permitir que o Admin configure o percentual de valorização para disparo de alerta na Carteira_Mãe e na Carteira_Gema
2. THE Sistema SHALL permitir que o Admin configure o percentual de desvalorização para disparo de alerta na Carteira_Mãe e na Carteira_Gema
3. THE Sistema SHALL permitir que o Admin configure o intervalo de verificação (em minutos) para o Módulo_Monitoramento da Carteira_Mãe e da Carteira_Gema
4. IF um Membro sem permissão de Admin tentar alterar as configurações de alerta, THEN THE Sistema SHALL bloquear a operação e exibir mensagem de permissão negada

### Requisito 8: Monitoramento Periódico de Variação

**User Story:** Como sistema, quero verificar periodicamente a variação das carteiras Mãe e Gema, para detectar quando limiares de alerta são atingidos.

#### Critérios de Aceitação

1. THE Módulo_Monitoramento SHALL consultar os preços atuais de todos os ativos da Carteira_Mãe e Carteira_Gema nas respectivas Corretora_APIs no intervalo configurado pelo Admin
2. THE Módulo_Monitoramento SHALL calcular o valor total atual de cada carteira somando (quantidade * preço_atual) de cada ativo
3. THE Módulo_Monitoramento SHALL comparar a variação percentual calculada com os limiares de Passo_Alerta configurados
4. IF o Módulo_Monitoramento não conseguir obter o preço de um ativo, THEN THE Módulo_Monitoramento SHALL registrar o erro em log e continuar o cálculo com o último preço conhecido

### Requisito 9: Disparo de Alertas Telegram por Passo

**User Story:** Como membro, quero receber alertas no Telegram quando a carteira Mãe ou Gema atingir um novo passo de variação, para acompanhar o desempenho sem ser inundado de mensagens repetidas.

#### Critérios de Aceitação

1. WHEN a variação da Carteira_Mãe ou Carteira_Gema atingir um novo Passo_Alerta de valorização, THE Serviço_Telegram SHALL enviar uma mensagem ao grupo Telegram fixo
2. WHEN a variação da Carteira_Mãe ou Carteira_Gema atingir um novo Passo_Alerta de desvalorização, THE Serviço_Telegram SHALL enviar uma mensagem ao grupo Telegram fixo
3. THE Serviço_Telegram SHALL não enviar alerta repetido para o mesmo Passo_Alerta já notificado anteriormente
4. WHEN a variação ultrapassar múltiplos passos entre duas verificações (ex: de 4% para 12% com passo de 5%), THE Serviço_Telegram SHALL enviar alerta apenas para o passo mais recente atingido (10%)
5. THE Serviço_Telegram SHALL incluir na mensagem: nome da carteira (Mãe ou Gema), tipo de variação (valorização ou desvalorização), percentual atingido, valor atual da carteira e valor do Baseline

### Requisito 10: Grupo Telegram Fixo

**User Story:** Como administrador, quero que os alertas sejam enviados para um grupo Telegram fixo configurado no sistema, para centralizar as notificações do grupo.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar um identificador de grupo Telegram fixo definido nas variáveis de ambiente do backend
2. THE Sistema SHALL utilizar um token de bot Telegram fixo definido nas variáveis de ambiente do backend
3. IF o Serviço_Telegram não conseguir enviar a mensagem ao grupo, THEN THE Serviço_Telegram SHALL registrar o erro em log e tentar reenviar na próxima verificação

### Requisito 11: Persistência do Estado de Alertas

**User Story:** Como sistema, quero persistir o último passo de alerta disparado para cada carteira, para evitar reenvios após reinicializações.

#### Critérios de Aceitação

1. THE Sistema SHALL armazenar no banco de dados o último Passo_Alerta de valorização disparado para a Carteira_Mãe
2. THE Sistema SHALL armazenar no banco de dados o último Passo_Alerta de desvalorização disparado para a Carteira_Mãe
3. THE Sistema SHALL armazenar no banco de dados o último Passo_Alerta de valorização disparado para a Carteira_Gema
4. THE Sistema SHALL armazenar no banco de dados o último Passo_Alerta de desvalorização disparado para a Carteira_Gema
5. WHEN o Módulo_Monitoramento reiniciar, THE Módulo_Monitoramento SHALL recuperar o último estado de alertas do banco de dados antes de iniciar novas verificações
