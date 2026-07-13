# Caso de contrato: schema inválido

**Natureza da prova:** teste unitário PHPUnit (fixtures sintéticas). Ver `phpunit.txt`.

## Regra provada

`TraderAuditor::auditar()` rejeita (`ok=false`) quando:
1. `direcao` fora de `LONG`/`SHORT` (inclui `NEUTRO` — explicitamente banido no contrato R3.2).
2. Qualquer família (`estrutura`, `order_flow`, `derivativos`, `momentum`) ausente, fora dos
   limites (`estrutura` ±30, `order_flow`/`derivativos` ±28, `momentum` ±14), ou com tipo
   errado (ex.: string `"20"` em vez de integer `20`).
3. `score_contexto.*` que não seja array (ex.: `familias_divergentes` como string em vez de
   lista).

Quando `ok=false`, `GeminiAnalysisService::analisar()` reenvia com nota corretiva pedindo o
JSON completo — até 3 rodadas. Se persistir inválido: `INVALID_SCHEMA_AFTER_RETRY` →
`INDISPONIVEL`.

## Testes de referência

- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_neutro_e_tipo_numerico_em_string_sao_rejeitados`
- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_score_contexto_malformado_e_rejeitado`
- `genesis-api/tests/Unit/TraderAuditoriaTest.php::test_rejeita_familia_acima_do_teto`

## Resultado

```
✓ neutro e tipo numerico em string sao rejeitados
✓ score contexto malformado e rejeitado
✓ rejeita familia acima do teto
```
(saída completa em `../../phpunit.txt`)
