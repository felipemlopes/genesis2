# Caso de contrato: incoerência persistente (quarentena analítica)

**Natureza da prova:** teste unitário PHPUnit (fixtures sintéticas). Ver `phpunit.txt`.

## Regra provada

Quando a direção declarada diverge do sinal da soma das famílias (ex.: soma negativa mas
direção LONG) e a resposta permanece incoerente após as tentativas corretivas:

1. A direção **não é trocada** pelo PHP — `TraderAuditor::auditar()` preserva a direção
   original do Gemini mesmo quando `coerente=false`.
2. `precisa_correcao=true` dispara o loop de correção em `GeminiAnalysisService::analisar()`
   (até 3 rodadas).
3. Se persistir incoerente até o fim do orçamento: `analysis.status = ANALISE_INCONSISTENTE`
   (nunca `INDISPONIVEL`) e `execution = ExecucaoService::inconsistente()` —
   `status = BLOQUEADA_ANALISE_INCONSISTENTE`, `executable=false`, `candidate_setup=null`.

## Testes de referência

- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_incoerencia_nao_troca_direcao_e_dispara_correcao`
- `genesis-api/tests/Unit/ExecucaoContratoTest.php::test_quarentena_nao_e_indisponivel`

## Resultado

```
✓ incoerencia nao troca direcao e dispara correcao
✓ quarentena nao e indisponivel
```
(saída completa em `../../phpunit.txt`)
