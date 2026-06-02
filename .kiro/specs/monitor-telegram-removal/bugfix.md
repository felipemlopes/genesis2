# Bugfix Requirements Document

## Introduction

O `monitor_worker.py` está enviando mensagens no Telegram para todos os tipos de alertas detectados (SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE, LIQUIDATION_CASCADE, SPOT_FUTURES_DIVERGENCIA). O monitor deveria apenas gravar os alertas no banco de dados MySQL, sem enviar nenhuma notificação via Telegram. O problema está na função `processar_alerta` que sempre invoca `self.enviar_telegram(alerta)` antes de gravar no banco.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN qualquer alerta é detectado (SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE, LIQUIDATION_CASCADE, SPOT_FUTURES_DIVERGENCIA) e TELEGRAM_TOKEN e TELEGRAM_CHAT_ID estão configurados THEN the system envia uma mensagem via API do Telegram com os detalhes do alerta

1.2 WHEN qualquer alerta é detectado THEN the system grava `enviado_telegram = 1` no banco de dados quando o envio do Telegram é bem-sucedido, indicando incorretamente que o Telegram é um canal ativo do monitor

### Expected Behavior (Correct)

2.1 WHEN qualquer alerta é detectado (SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE, LIQUIDATION_CASCADE, SPOT_FUTURES_DIVERGENCIA) THEN the system SHALL gravar o alerta no banco de dados MySQL sem enviar nenhuma mensagem via Telegram

2.2 WHEN qualquer alerta é detectado THEN the system SHALL gravar `enviado_telegram = 0` no banco de dados, pois nenhum envio de Telegram deve ocorrer

### Unchanged Behavior (Regression Prevention)

3.1 WHEN qualquer alerta é detectado THEN the system SHALL CONTINUE TO gravar corretamente todos os campos do alerta (ativo, tipo, mensagem, direcao, urgencia, corretora, timeframe, preco_atual, variacao_pct) no banco de dados MySQL

3.2 WHEN um alerta duplicado é detectado dentro do intervalo de duplicatas THEN the system SHALL CONTINUE TO ignorar o alerta duplicado sem gravar no banco

3.3 WHEN um alerta não-duplicado é detectado THEN the system SHALL CONTINUE TO registrar log informativo sobre o novo alerta detectado

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type AlertaProcessado
  OUTPUT: boolean
  
  // O bug ocorre sempre que processar_alerta é chamado,
  // pois enviar_telegram é sempre invocado incondicionalmente
  RETURN X.tipo IN {SPIKE_VOLUME, MOVIMENTO_BRUSCO, CVD_DIVERGENCIA, FUNDING_EXTREMO, OI_SPIKE, BOOK_IMBALANCE, LIQUIDATION_CASCADE, SPOT_FUTURES_DIVERGENCIA}
END FUNCTION
```

```pascal
// Property: Fix Checking - Nenhum alerta deve ser enviado via Telegram
FOR ALL X WHERE isBugCondition(X) DO
  result ← processar_alerta'(X)
  ASSERT telegram_enviado(result) = false
  ASSERT banco_gravado(result) = true
  ASSERT banco_campo_enviado_telegram(result) = 0
END FOR
```

```pascal
// Property: Preservation Checking - Gravação no banco permanece inalterada
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
END FOR
```

Nota: Como `isBugCondition` cobre todos os tipos de alerta processados pelo monitor, a preservação se aplica ao comportamento de deduplicação e logging que não envolve o Telegram.
