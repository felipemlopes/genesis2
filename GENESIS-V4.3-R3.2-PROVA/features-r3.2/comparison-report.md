# CONTROL vs CANDIDATE — comparação da folha de decisão

**Natureza da prova:** gerada chamando `GeminiAnalysisService::montarFolhaDecisao()`
diretamente (via `php artisan tinker`) com a mesma fixture de indicadores/zonas em ambas as
variantes — não é uma análise ao vivo (não passa pelo Gemini, pelo OCR nem pela Binance).
Prova a propriedade estrutural do enriquecimento, não o conteúdo real do enriquecimento em
produção (que depende de `RegimeService`/`FeaturePolicy` rodando com dados reais).

## O que foi comparado

- **CONTROL**: `montarFolhaDecisao()` chamada só com os 10 argumentos originais (R3.1) —
  nenhum argumento de enriquecimento passado.
- **CANDIDATE**: mesma chamada, mais `$regime` (de `RegimeService::classificar()`) e
  `$featurePolicy` (de `FeaturePolicy::forTimeframe('1d')`) calculados a partir da mesma
  fixture de indicadores.

## Resultado (diff completo)

Único delta entre `control/folha.json` e `candidate/folha.json`: dois campos **adicionados**
no fim do documento — `contexto_regime` e `feature_policy`. Nada foi removido, alterado ou
sobrescrito no restante da folha (estrutura, order_flow, derivativos, momentum, `ativo`,
`imagem_qualidade`, `multi_timeframe` idênticos byte a byte, exceto `features_version`).

```diff
+    "contexto_regime": {
+        "tipo": "TENDENCIA",
+        "direcao_estrutura": "BAIXA",
+        "forca_tendencia": "MEDIA",
+        "atr_pct": 3.2056,
+        "compressao": false,
+        "mtf_alinhamento": "INDETERMINADO",
+        "regra": "CONTEXTO_NAO_DECISORIO"
+    },
+    "feature_policy": {
+        "trade_flow_enabled": true,
+        "trade_flow_windows_s": [3600, 14400, 86400],
+        "streaming_book_collect": true,
+        "streaming_book_brain": false,
+        "microstructure_weight": "IGNORAR"
+    },
```

Note que `contexto_regime.regra = "CONTEXTO_NAO_DECISORIO"` e o objeto não contém nenhuma
chave `direcao`/`LONG`/`SHORT` — confirma a Propriedade 6 do design (`RegimeService` nunca
declara direção operável).

## Testes automatizados que cobrem esta mesma propriedade

- `tests/Unit/ControlCompatibilityTest.php::test_folha_sem_enriquecimento_e_identica_a_r31_exceto_versao`
- `tests/Unit/ControlCompatibilityTest.php::test_folha_com_enriquecimento_acrescenta_sem_remover_campos_r31`
- `tests/Unit/IncrementalBrainTest.php` (8 testes, `RegimeService`/`FeaturePolicy`/`DataFreshnessGate`/`DerivativesEnrichmentService`/`TradeFlowService`/`OutcomeLabeler` isolados)

## Gaps conhecidos nesta pasta (registrados, não escondidos)

- **`ablation/`**: vazia. Ablação real (completo vs. sem regime vs. sem trade_flow vs. sem
  derivativos enriquecidos) exigiria rodar o mesmo conjunto de análises reais nas duas
  configurações e comparar resultado de mercado — não é possível sem histórico de trades
  reais, que não existe ainda (sistema em shadow mode, sem operação real publicada).
- **`stream-health.json`**: não gerado. `BinancePublicStreamService` não foi implementado
  nesta entrega (decisão de infraestrutura pendente — precisa de biblioteca de WebSocket e
  definição de como o processo de longa duração roda em produção). Sem o coletor, não há
  métrica de persistência/cancelamento/reposição de book para reportar.
- **`outcome-labels.csv`**: vazio. `OutcomeLabeler` existe e está testado isoladamente
  (`IncrementalBrainTest`), mas nenhum job agendado o executa sobre análises passadas ainda
  — não há outcome real rotulado para exportar.
- Os valores em `contexto_regime`/`feature_policy` acima vêm de uma fixture sintética
  chamada manualmente — em produção, `RegimeService`/`FeaturePolicy` já estão conectados ao
  fluxo real de `analisar()` (confirmado por leitura de código), mas isso não foi observado
  numa análise real nesta sessão.
