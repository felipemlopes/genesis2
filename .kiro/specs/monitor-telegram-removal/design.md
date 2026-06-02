# Monitor Telegram Removal Bugfix Design

## Overview

O `monitor_worker.py` envia mensagens via Telegram para cada alerta detectado, mas essa funcionalidade não deveria existir. O fix remove completamente a integração com Telegram do monitor worker: a chamada a `enviar_telegram`, o método em si, e as constantes `TELEGRAM_TOKEN`/`TELEGRAM_CHAT_ID`. O campo `enviado_telegram` no banco passa a ser sempre `0`.

## Glossary

- **Bug_Condition (C)**: Qualquer alerta processado pelo monitor — todos invocam `enviar_telegram` incondicionalmente
- **Property (P)**: Alertas devem ser gravados no banco com `enviado_telegram = 0`, sem nenhuma chamada à API do Telegram
- **Preservation**: Gravação no banco (todos os campos do alerta), deduplicação de alertas, e logging devem permanecer inalterados
- **processar_alerta**: Método em `monitor/monitor_worker.py` que processa alertas detectados, grava no banco e (incorretamente) envia Telegram
- **enviar_telegram**: Método em `monitor/monitor_worker.py` que envia mensagem formatada via API do Telegram
- **TELEGRAM_TOKEN / TELEGRAM_CHAT_ID**: Constantes carregadas do `.env` usadas exclusivamente pelo método `enviar_telegram`

## Bug Details

### Bug Condition

O bug manifesta-se sempre que `processar_alerta` é chamado. O método incondicionalmente invoca `self.enviar_telegram(alerta)` e passa o resultado como `enviado_telegram` para `self.gravar_banco`. Isso causa envio indesejado de mensagens Telegram e gravação de `enviado_telegram = 1` no banco.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type AlertaProcessado
  OUTPUT: boolean
  
  RETURN input.tipo IN ['SPIKE_VOLUME', 'MOVIMENTO_BRUSCO', 'CVD_DIVERGENCIA',
                        'FUNDING_EXTREMO', 'OI_SPIKE', 'BOOK_IMBALANCE',
                        'LIQUIDATION_CASCADE', 'SPOT_FUTURES_DIVERGENCIA']
         AND input passa pela verificação de deduplicação (não é duplicado)
END FUNCTION
```

### Examples

- Alerta SPIKE_VOLUME para BTCUSDT: atualmente envia Telegram e grava `enviado_telegram=1`. Esperado: apenas grava no banco com `enviado_telegram=0`
- Alerta MOVIMENTO_BRUSCO para ETHUSDT: atualmente envia Telegram e grava `enviado_telegram=1`. Esperado: apenas grava no banco com `enviado_telegram=0`
- Alerta com TELEGRAM_TOKEN vazio: atualmente `enviar_telegram` retorna `False` e grava `enviado_telegram=0`. Esperado: nem tenta chamar `enviar_telegram`
- Alerta duplicado dentro do intervalo: continua sendo ignorado (sem mudança)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Gravação de todos os campos do alerta no banco (ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe, preco_atual, variacao_pct) deve continuar funcionando exatamente como antes
- Deduplicação de alertas via `ultimos_alertas` e `intervalo_duplicatas` deve continuar funcionando
- Logging informativo sobre alertas detectados deve continuar funcionando
- A assinatura pública de `processar_alerta` (parâmetros de entrada) deve permanecer inalterada
- O método `gravar_banco` deve continuar funcionando normalmente (apenas recebe `False` fixo)

**Scope:**
Todas as funcionalidades que NÃO envolvem Telegram devem ser completamente inalteradas:
- Conexão WebSocket com exchanges
- Detecção de alertas (lógica de análise)
- Conexão e gravação no MySQL
- Cálculo de scores e indicadores

## Hypothesized Root Cause

O problema é simples e confirmado pela leitura do código:

1. **Chamada incondicional a `enviar_telegram`**: Na linha `enviado_telegram = self.enviar_telegram(alerta)` dentro de `processar_alerta`, o método é sempre chamado para todo alerta não-duplicado

2. **Propagação do resultado para o banco**: O valor retornado por `enviar_telegram` (True/False) é passado para `gravar_banco`, que converte para `1`/`0` no campo `enviado_telegram`

Não há condição de guarda, feature flag, ou configuração que desabilite o envio. A funcionalidade foi implementada como parte do fluxo principal sem mecanismo de desativação.

## Correctness Properties

Property 1: Bug Condition - Nenhum envio de Telegram ocorre

_For any_ alerta processado pelo monitor (que passa pela verificação de deduplicação), a função `processar_alerta` corrigida SHALL gravar o alerta no banco com `enviado_telegram = 0` sem realizar nenhuma chamada HTTP à API do Telegram.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Gravação no banco e deduplicação inalteradas

_For any_ alerta processado pelo monitor, a função `processar_alerta` corrigida SHALL produzir exatamente os mesmos registros no banco de dados (exceto o campo `enviado_telegram` que será sempre `0`) e manter o mesmo comportamento de deduplicação e logging da função original.

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `monitor/monitor_worker.py`

**Specific Changes**:

1. **Remover constantes TELEGRAM_TOKEN e TELEGRAM_CHAT_ID** (linhas 30-31):
   - Remover `TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN')`
   - Remover `TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')`

2. **Remover o método `enviar_telegram`** inteiro (~20 linhas):
   - Remover o método que faz POST para `api.telegram.org`

3. **Alterar `processar_alerta`** — substituir as duas linhas:
   ```python
   enviado_telegram = self.enviar_telegram(alerta)
   self.gravar_banco(alerta, enviado_telegram)
   ```
   Por:
   ```python
   self.gravar_banco(alerta, False)
   ```

4. **Manter import `requests`**: O módulo `requests` é usado em outros métodos (funding rate, open interest, preço spot), portanto NÃO deve ser removido.

## Testing Strategy

### Validation Approach

A estratégia de teste segue duas fases: primeiro, demonstrar que o código atual envia Telegram (counterexample), depois verificar que o fix remove o envio e preserva a gravação no banco.

### Exploratory Bug Condition Checking

**Goal**: Confirmar que o código atual chama `enviar_telegram` para todo alerta processado.

**Test Plan**: Criar mock de `enviar_telegram` e verificar que é chamado quando `processar_alerta` é invocado no código não-corrigido.

**Test Cases**:
1. **Alerta SPIKE_VOLUME**: Chamar `processar_alerta` com tipo SPIKE_VOLUME — `enviar_telegram` é invocado (falha esperada no código não-corrigido)
2. **Alerta MOVIMENTO_BRUSCO**: Chamar `processar_alerta` com tipo MOVIMENTO_BRUSCO — `enviar_telegram` é invocado
3. **Múltiplos alertas**: Processar 3 alertas diferentes — `enviar_telegram` é chamado 3 vezes

**Expected Counterexamples**:
- `enviar_telegram` é chamado para cada alerta não-duplicado
- `enviado_telegram` é gravado como `1` quando o token está configurado

### Fix Checking

**Goal**: Verificar que após o fix, nenhum alerta resulta em chamada ao Telegram.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := processar_alerta_fixed(input)
  ASSERT telegram_api_not_called()
  ASSERT banco_campo_enviado_telegram(result) = 0
END FOR
```

### Preservation Checking

**Goal**: Verificar que a gravação no banco permanece idêntica (exceto `enviado_telegram = 0`).

**Pseudocode:**
```
FOR ALL input WHERE alerta_valido(input) DO
  ASSERT campos_gravados_fixed(input) = campos_gravados_original(input)
         EXCEPT enviado_telegram = 0
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitas combinações de alertas automaticamente
- Verifica que todos os campos são gravados corretamente independente do tipo/ativo
- Garante que a deduplicação continua funcionando para inputs variados

**Test Plan**: Observar comportamento de gravação no código não-corrigido, depois verificar que o fix mantém os mesmos campos gravados.

**Test Cases**:
1. **Preservação de campos**: Verificar que todos os 9 campos do alerta são gravados identicamente após o fix
2. **Preservação de deduplicação**: Verificar que alertas duplicados continuam sendo ignorados
3. **Preservação de logging**: Verificar que logs informativos continuam sendo emitidos

### Unit Tests

- Testar que `processar_alerta` grava no banco com `enviado_telegram = 0`
- Testar que nenhuma chamada HTTP é feita durante processamento de alertas
- Testar deduplicação de alertas (comportamento preservado)
- Testar que todos os campos do alerta são passados corretamente para `gravar_banco`

### Property-Based Tests

- Gerar alertas com tipos/ativos/corretoras aleatórios e verificar que `enviado_telegram` é sempre `0`
- Gerar sequências de alertas e verificar que deduplicação funciona corretamente
- Gerar alertas com campos variados e verificar que todos são gravados no banco

### Integration Tests

- Testar fluxo completo: detecção de alerta → processamento → gravação no banco (sem Telegram)
- Verificar que o worker inicia corretamente sem as constantes TELEGRAM_TOKEN/TELEGRAM_CHAT_ID
- Verificar que outros métodos que usam `requests` (funding rate, open interest) continuam funcionando normalmente
