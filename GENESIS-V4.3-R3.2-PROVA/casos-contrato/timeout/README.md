# Caso de contrato: timeout / falha técnica / orçamento esgotado

**Natureza da prova:** teste unitário PHPUnit (fixtures sintéticas). Ver `phpunit.txt`.
**Não executado como falha real de rede** — a Gemini API não foi de fato derrubada nesta
sessão para observar o timeout acontecer end-to-end; a prova é da lógica de tratamento.

## Regra provada

1. Falha técnica pura (timeout, HTTP, chave ausente, JSON/schema inválido após tentativas):
   `analysis.status = INDISPONIVEL`, `execution = ExecucaoService::indisponivel($reasonCode)`
   — `executable=false`, `action=null`, `candidate_setup=null`, `reason_code` preenchido
   (ex.: `TIMEOUT`, `MISSING_KEY`, `HTTP_ERROR`, `INVALID_SCHEMA_AFTER_RETRY`).
2. **Caso especial (P0 do Documento Mestre):** se o orçamento de 5 requisições se esgota
   *depois* de já existir uma resposta com schema válido porém incoerente, o resultado é
   `ANALISE_INCONSISTENTE` — **nunca** `INDISPONIVEL`. Só a ausência total de resposta válida
   permite `INDISPONIVEL`.
3. Toda requisição de IA é contada antes do envio (`AnalysisContext::consume()`), inclusive
   retry — a 6ª chamada é bloqueada antes do HTTP sair.

## Testes de referência

- `genesis-api/tests/Unit/ExecucaoContratoTest.php::test_falha_tecnica_e_unico_indisponivel`
- `genesis-api/tests/Unit/AnalysisContextTest.php` — **não existe ainda** (gap registrado em
  `tasks.md`, Requisito 8.2 / Task 7.2 não concluída)

## Resultado

```
✓ falha tecnica e unico indisponivel
```
(saída completa em `../../phpunit.txt`)

## Gap conhecido

O teste dedicado ao cenário "orçamento esgotado com resposta válida-incoerente já existente"
(`GeminiAnalysisOrchestrationTest::test_budget_exceeded_after_valid_incoherent_response_quarantines`,
citado na Seção 18.4 do Documento Mestre) não foi escrito nesta sessão. A lógica está
implementada e revisada por leitura de código em `GeminiAnalysisService::analisar()`
(bloco `catch (AiRequestException $e)`), mas não tem teste automatizado dedicado.
