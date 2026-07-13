# Caso de contrato: score/convicção baixa

**Natureza da prova:** teste unitário PHPUnit (não é uma chamada real ao Gemini/Binance — usa
fixtures sintéticas). Ver `phpunit.txt` na raiz do pacote para confirmação de que passou.

## Regra provada

Score/convicção abaixo do limiar (`GENESIS_CONVICCAO_FRACA_ABAIXO`, default 50):
1. **Preserva** a direção declarada (LONG/SHORT) — nunca vira NEUTRO.
2. Exige explicação estruturada (`justificativa_score` com ≥80 caracteres **e**
   pelo menos um item em `score_contexto`) — senão dispara correção (`precisa_correcao=true`).
3. Marca `leitura_fraca=true`, que no `execution` final produz `NAO_RECOMENDADA_CONVICCAO`
   quando abaixo de `GENESIS_CONVICCAO_MIN_EXECUCAO`.

## Testes de referência

- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_score_45_preserva_long_e_exige_explicacao`
- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_score_baixo_sem_contexto_dispara_correcao`
- `genesis-api/tests/Unit/ExecucaoContratoTest.php` (branch `NAO_RECOMENDADA_CONVICCAO` em `ExecucaoService::montar()`)

## Resultado

```
✓ score 45 preserva long e exige explicacao
✓ score baixo sem contexto dispara correcao
```
(saída completa em `../../phpunit.txt`)
