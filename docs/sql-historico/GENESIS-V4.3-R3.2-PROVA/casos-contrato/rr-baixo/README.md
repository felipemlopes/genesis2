# Caso de contrato: RR líquido abaixo do mínimo

**Natureza da prova:** teste unitário PHPUnit com Mockery (não é uma chamada real ao
Gemini/Binance). Ver `phpunit.txt` na raiz do pacote.

## Regra provada

Quando `rr_liquido_estimado < GENESIS_RR_MINIMO` (default 1.50):
1. `candidate_setup` continua **completo** — stop, tp1/tp2/tp3, entrada, tudo calculado.
2. `execution.status = NAO_RECOMENDADA_RR`, `executable = false`, `action = null`.
3. `executable_setup = null` (não pode ser confirmado como operação).
4. `candidate_setup.rr_aviso` traz a mensagem legível ("RR líquido estimado é de 1:X,
   abaixo do mínimo esperado de 1:Y...") — a mesma que o frontend exibe, sem recalcular
   nada no cliente.

## Fórmula do RR líquido (provada separadamente)

`(recompensa_preco − custo_preco) / (risco_preco + custo_preco)`, onde `custo_preco` é o
mesmo custo de round-trip (`custos_bps` somados) aplicado nos dois lados — nunca duplicado.

## Testes de referência

- `genesis-api/tests/Unit/ExecucaoContratoTest.php::test_rr_reprovado_preserva_direcao_e_zera_niveis`
- `genesis-api/tests/Unit/FolhaIntegridadeTest.php::test_rr_liquido_aplica_um_round_trip_em_cada_cenario`

## Resultado

```
✓ rr reprovado preserva direcao e zera niveis
✓ rr liquido aplica um round trip em cada cenario
```
(saída completa em `../../phpunit.txt`)
