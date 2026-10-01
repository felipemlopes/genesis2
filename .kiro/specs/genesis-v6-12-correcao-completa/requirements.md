# Requisitos — genesis-v6-12-correcao-completa

**Fonte:** `C:\Users\felip\Downloads\GENESIS_V6_12_CORRECAO_COMPLETA_FELIPE.md` (PO Fabricio Marcilio, 29/09/2026).
Referências do tipo "§5.1" apontam para as seções desse documento.
**Repositórios:** API v2 `genesis-api` (staging → produção `genesis2`) e front v2 `G-nesis-2.0-main` (staging → produção `master`).
**Status:** só planejamento (29/09/2026). Nada foi alterado por esta spec.

## Como o documento foi conferido

Cada afirmação do documento sobre o código foi conferida no código local em 29/09. O documento auditou os ZIPs de 28/09, **antes** das correções da spec `genesis-seguranca-correcoes` (feitas em 29/09 e ainda não commitadas). Por isso, cada requisito abaixo traz o estado real:

- **Confirmado:** o código é como o documento descreve e nada foi feito.
- **Já feito (29/09):** resolvido pela spec de segurança, ainda sem commit.
- **Parcial:** parte feita, parte pendente.
- **Diverge:** o código ou uma decisão anterior não bate com o documento. O motivo está no requisito.

## Regras que valem para todos os requisitos (§1)

1. A IA é a única que decide direção, score, ranking de alvos, stop e Plano B. O PHP só valida integridade e calcula risco.
2. R:R nunca invalida, bloqueia, escolhe ou apaga nada.
3. Análise sempre executável (`executable = true` fica).
4. Alavancagem é do membro; o sistema só adapta a matemática e avisa.
5. Stop é sempre nível técnico; percentual e ATR só avisam.
6. Ausência não é zero: dado ausente sai da conta e da tela; dado inconsistente vira log.
7. Plano A e Plano B sempre aparecem, independentes.
8. Score em múltiplos de 5, teto 90.
9. Nenhum código interno aparece para o membro.
10. Toda análise vai para o histórico com os dois planos e a escolha do membro registrada.
11. Indicadores só com velas fechadas.
12. Nenhum dado de Spot.

Critério de aceite geral (§0): arquivo alterado + teste automatizado + resultado do teste + payload antes e depois nos três casos reais (§16) + screenshot quando a tela muda.

---

## Fase 0 — Segurança de emergência (§3)

### R0.1 Dump de produção fora do repositório (§3.1) — Parcial / Diverge
- QUANDO o repositório for clonado, ENTÃO `genesis_v6_4_proofs/pre-migration-4-dump.sql` NÃO DEVE estar no índice.
  - **Já feito (29/09):** `git rm --cached` feito, falta commit. O `.gitignore` já ignora o arquivo; faltam as regras genéricas `*.sql`, `*.dump`, `genesis_v6_4_proofs/`. Hoje nenhum outro `.sql` ou `.dump` está versionado.
- O histórico DEVE ser reescrito com `git filter-repo` e o push forçado.
  - **Diverge:** em 30/07/2026 o Felipe decidiu não reescrever o histórico (registrado em `.gitignore` e `provas/a04-dump-removido.txt`). O documento do PO manda reescrever. Decisão D1.
- As chaves presentes no dump DEVEM ser rotacionadas no mesmo dia (Gemini, OpenAI se houver, banco, `APP_KEY` se houver). Tarefa do Felipe.
- Todos os tokens DEVEM ser invalidados.
  - **Diverge:** em 31/07/2026 o Felipe decidiu não revogar os tokens daquela época. Além disso, desde o corte de 10/09 os tokens de membro são do `[AUTH]`, não do Sanctum da v2; na v2 o Sanctum só serve o admin. Decisão D2.
- Prova: `git log --all -- genesis_v6_4_proofs/` vazio (se D1 aprovar), lista de chaves rotacionadas com data, contagem de tokens zero.

### R0.2 Telescope desligado por padrão (§3.2) — Parcial
- `config/telescope.php` DEVE ter padrão `false`. **Confirmado:** hoje é `env('TELESCOPE_ENABLED', true)`. Em 29/09 só o `.env.example` mudou.
- Cabeçalhos sensíveis DEVEM ficar ocultos. **Já feito (29/09):** `authorization`, `cookie`, `x-csrf-token`, `x-xsrf-token`, `x-internal-token`, mais campos de cartão, CPF e senha. **Diverge do texto:** o documento cita `x-internal-service-token`, mas o cabeçalho real é `X-Internal-Token` (`InternalServiceToken.php:17`). Faltam `x-api-key` e os parâmetros `token`, `access_token` e `refresh_token`.
- Em produção: `TELESCOPE_ENABLED=false` e `php artisan telescope:clear`. Exige autorização.

### R0.3 CORS restrito (§3.3) — Parcial / Diverge
- **Já feito (29/09):** `allowed_origins` vem de `CORS_ALLOWED_ORIGINS`, e há um padrão para `https://*.genesislabs.com.br` (mais localhost fora de produção).
- O documento pede lista explícita, sem padrão, e também `allowed_methods` e `allowed_headers` fechados (hoje os dois são `*`). O cabeçalho de idempotência que o front envia é `Idempotency-Key` (`services/api.ts`), confirmado.
- Lista explícita contra padrão de subdomínio: Decisão D3.
- Prova: `OPTIONS` de origem fora da lista sem `Access-Control-Allow-Origin`.

---

## Fase 1 — Alvos, risco, slider e régua (§4 a §7, §9, §10)

### R1.1 Alvos publicados por integridade, nunca por R:R (§5.1 a §5.3) — Confirmado
- `TargetEligibilityService::selecionar()` NÃO DEVE descartar alvo por R:R nem por espaçamento. Hoje descarta (`RR_ABAIXO_DO_MINIMO` na linha 81; `ESPACAMENTO_ATR_INSUFICIENTE` na linha 98, 0,50 ATR).
- Só DEVE descartar por: id inexistente, lado errado, preço inválido, fora do horizonte (piso 0,25 ATR, teto por timeframe) e excesso de 3.
- O retorno DEVE trazer `rr` informativo em cada candidata, `ranking_vazio` e `descartados`.
- Os 3 publicados DEVEM sair em ordem crescente de distância (TP1 o mais próximo).
  - **Diverge (ponto aberto):** o código do §5.1 ordena todos os elegíveis por distância e corta os 3 mais próximos. Se a IA rankear 4 ou mais elegíveis, isso descarta a preferência dela, o que contraria a regra 1 e a tabela do §16 ("conforme o ranking real da IA"). Decisão D4.
- `TargetSelectionValidator::assertPublished()` NÃO DEVE mais gerar `TARGET_SELECTION_INTERNAL_TOO_CLOSE_TO_PREVIOUS`; só erro de ordem.
- `AlvoService::calcularAlvos()` NÃO DEVE preencher `tpN_motivo` com "Sem candidata selecionada pela IA…" (linha 86). Alvo ausente é `null` e a tela mostra só o traço.

### R1.2 Logs de acompanhamento dos alvos (§5.4, §4.3) — Confirmado
- QUANDO o ranking vier vazio, ENTÃO `Log::info('genesis.alvos.ranking_vazio')` com `candidatas_do_lado`.
- QUANDO o PHP descartar algum id, ENTÃO `Log::warning('genesis.alvos.descartado_pelo_php')`.
- Vale para o Plano A (`ExecucaoService`) e o Plano B (`PlanoBService`).

### R1.3 Prompt factual (§5.5 e §5.10) — Confirmado
- Linha 113 de `GenesisPrompt.php`: trocar "filtra deterministicamente… (RR mínimo, espaçamento entre alvos, limites de distância)" pela frase de integridade.
- Linha 110: a lista do cardápio passa a citar range Wyckoff, Fibonacci desenhado com rótulo e projeções técnicas.
- Linha 111: tirar "só Fibonacci" dos elementos fracos e acrescentar a frase do Fibonacci desenhado. É o único ajuste de critério, aprovado pelo PO em 29/09.

### R1.4 R:R do Plano B sem alvo é `null` (§5.6) — Confirmado
- `PlanoBService.php:182-184` devolve `0.0` sem TP1. Passa a devolver `null`, e os consumidores aceitam `?float`.

### R1.5 Projeções técnicas no catálogo (§5.8 a §5.12) — Confirmado
- Novo `TechnicalProjectionService`: medida de figura (validada, com viés) e bordas e projeções do range Wyckoff válido. **Confirmado:** `TargetCandidateCatalog` hoje não lê `wyckoff.range`.
- Fibonacci NUNCA é calculado; só o desenhado e lido por OCR (confiança ≥ 0,70) entra, com peso 5 (hoje 0 nos dois arquivos) e o rótulo lido.
- Pesos: `range_wyckoff` 7, `projecao_figura` 6, `projecao_range` 6, `fibonacci` 5, em `TargetCandidateCatalog` e `AlvoService`.
- O `candidate_id` da projeção DEVE ser igual na montagem do bundle e na execução.
- Nenhum código interno na tela. No front, etiqueta cinza "Projeção" ao lado do preço.
- Ausência não gera log. Leitura incerta segue com os logs que já existem (§5.11).

### R1.6 Risco nunca maior que a margem (§6) — Confirmado
- `ExecucaoService::calcularTamanhoSugerido()` (linha 1016) DEVE usar a distância até a liquidação quando ela vier antes do stop, e limitar `risco_usd` à margem.
- O retorno ganha `stop_alem_da_liquidacao` e `distancia_liquidacao_pct`.
- Os três chamadores passam a distância de liquidação: `ExecucaoService:213` (A), `ExecucaoService:542` (B) e `RepricingService:85`. **Diverge do texto:** o documento põe o Plano B em `PlanoBService::gerar()`, mas a chamada fica em `ExecucaoService:542`.
- Nenhum bloqueio. O aviso "liquida antes do stop" fica.

### R1.7 Slider ligado à tela inteira (§7) — Confirmado
- `StopSlider` ganha `onRepriceState` e um guarda de sequência. Resposta fora de ordem é descartada.
- `AnalysisResult` guarda o reprice por plano e calcula `planoEfetivo`. Todos os números de risco leem `planoEfetivo`. **Confirmado:** a linha 1106 não passa callback e a linha 927 confirma `planoAtivo`.
- O botão de confirmar fica desabilitado enquanto o reprice está pendente ou com erro ("Recalculando…" ou "Reprecificação indisponível") e confirma com `planoEfetivo`.
- `planoAtivoCompleto` com `Number.isFinite(Number(...))` não muda (DP-03).

### R1.8 Uma régua só para o stop (§9) — Confirmado
- `NivelService` deixa de ter `TETO_ATR_NORMAL`/`TETO_ATR_AMPLIADO` fixos (linhas 36 e 37) e lê `genesis.stop_slider.wide_caution_above_atr` (3,0) e `wide_red_above_atr` (4,5).
- `StopRiskZoneClassifier` e `utils/stopRiskZone.ts` usam os dois limiares, na ordem do §9.2.
- Os limiares saem no payload público (`stop_slider_limiares`); o front não duplica constantes.
- O aviso "Stop mais largo que o normal" segue a zona de `planoEfetivo`.

### R1.9 Log de figura com estado inválido (§10) — Confirmado
- `LeituraVisualCompartilhada.php:94-96` descarta em silêncio. Passa a logar `genesis.visao.pattern_estado_invalido`.

### R1.10 Contrato de teste do stop (§15) — novo
- As 12 linhas do contrato do §15, cada uma com teste no backend, no front ou nos dois.

---

## Fase 2 — Posição confirmada e revelação (§8, §11.1)

### R2.1 Confirmar posição grava no backend (§8) — Confirmado
- **Confirmado:** `handleSaveTrade` (`GenesisPage.tsx:454`) só grava no estado local; `stop_user_adjusted` existe e nada escreve nele; `trades` não tem coluna de stop (colunas `string`, migration de 09/01).
- Rota nova `POST /v1/analises/{id}/confirmar-posicao`: reprecifica no servidor, grava `stop_user_adjusted`, `posicao_confirmada_em`, `posicao_confirmada_snapshot` e cria o `Trade` com o stop efetivo.
- A análise de outro membro devolve 404. O servidor ignora qualquer preço do cliente além de `stop_effective`.
- A confirmação não cobra crédito.
- Migrations em `trades` e `genesis_analise_planos`. Exigem autorização para rodar (D5).
- O front carrega as posições de `GET /v1/trades` (a rota já existe, `routes/api.php:137`) e elas sobrevivem ao recarregamento.

### R2.2 Rota antiga de trades sem débito (§8.2) — Confirmado
- `TradeController::store` debita `cost_analisys_credits` (linha 77). O débito sai. A rota pode ser removida quando nenhum cliente a usar.

### R2.3 Revelação por membro (§11.1) — Confirmado
- **Confirmado:** `AlertaController::reveal()` sobrescreve `revelado_por` (linha 217) e `poll()` compara com o usuário atual (linha 97). Quando o membro B revela, o membro A perde a revelação.
- Um `RevealAlertService` com transação e `lockForUpdate` em `user_revelacoes` (tabela que já existe), usado por `AlertaController::reveal/poll` e `RadarController::revelar`.
- Migração de dados de `revelado_por` para `user_revelacoes` antes de parar de ler a coluna.
- Duas revelações concorrentes do mesmo membro debitam uma vez.
- Com os créditos no `[AUTH]` (`GENESIS_AUTH_CREDITS_FULL_ENABLED=true` em produção), reserva e captura com a mesma chave de idempotência.

---

## Fase 3 — Laravel (§11.2 a §11.6)

### R3.1 Limite no login admin (§11.2) — Parcial
- **Já feito (29/09):** `throttle:login`, com 5 por minuto por e-mail+IP e 20 por minuto por IP, e resposta genérica para quem não é admin.
- Pendente: limite de 30 por hora por IP e `Log::warning('admin.login.falha')` com e-mail e IP.

### R3.2 SSE sem vazar o paywall e sem consumo global (§11.3) — Confirmado
- **Confirmado:** `stream()` envia `$alerta->toArray()` (com `ativo`, `corretora` e `preco_atual`) e grava `enviado_sse = 1` para todos (linhas 258 a 270).
- Um presenter só para `poll()` e `stream()`, e cursor por conexão (`Last-Event-ID`).
- `enviado_sse` deixa de ser escrito pelo stream. Antes, conferir se `VarreduraMicroRadarCommand` ou outro job depende dele.

### R3.3 Teto de resolução no upload (§11.4) — Confirmado
- `app/Http/Requests/Api/GraphicalAnalysisRequest.php` (o documento omite o `Api/`) só valida o piso. Entram `max_long_side` 8000 e `max_megapixels` 25.

### R3.4 Docblock do middleware de autenticação (§11.5) — Confirmado
- O docblock de `VerifyGenesisAuthToken` ainda fala em "ativação". Corrigir para o estado real, fail-closed.

### R3.5 Proxy Gemini no Laravel (§11.6) — Diverge
- O documento diz que não existe rota de prompt livre no Laravel. **Existe:** `POST /gemini-proxy` (`UtilityGeminiProxyController`, `routes/genesis_graphical_v6.php:40`). Em 29/09 ela ganhou o teto de 30 por dia por membro (spec de segurança, S13). Nada novo a fazer; só registrar a divergência.

---

## Fase 4 — Node legado (§12)

### R4.1 Node legado removido (§12.1 a §12.5) — Parcial
- **Já feito (29/09, Fase 7 da spec de segurança):** removidos `routes/api.js`, `services/database.ts`, o login JWT, o stream sem login e o proxy da Bybit. O `server.ts` só entrega o site.
- **Confirmado:** o `ecosystem.config.cjs` sobe `npm run preview` na porta 3010, então o `server.ts` não roda em produção. Ele ainda é o script `dev` (`tsx server.ts`) e é empacotado no `build`.
- Pendente: prova com `pm2 list` em produção; apagar o `server.ts`; `dev` → `vite`; `build` → `vite build`; remover o `start`; remover as dependências `express`, `express-rate-limit`, `jsonwebtoken`, `mysql2` e `cors`, se nada mais usar.
- **Diverge:** o documento manda apagar `services/geminiService.ts` "do lado servidor". Esse arquivo é código do front, usado pela tela (32 KB). Não entra na remoção sem conferir o uso.

### R4.2 CSP e token centralizado (§12.6) — Confirmado
- Meta CSP no `index.html`, conferindo no Console que nada legítimo é bloqueado (o `connect-src` inclui a API, o `[AUTH]`, `fapi.binance.com` e o que mais o front chamar).
- As leituras de `localStorage.getItem('genesis_token')` (11 no código, sem contar `.kilo`; o documento fala em 13) passam por uma função só.
- A migração para cookie HttpOnly fica para a decisão 6 do PO.

---

## Fase 5 — Qualidade (§13)

### R5.1 Timeouts e regra de reserva (§13.1) — Confirmado
- Novos padrões: OpenAI 60, reserva OpenAI 50/40/25, visão Gemini 30, decisão Gemini 45, scan Gemini 20. **Confirmado:** hoje 180, 120/60/45, 45, 90 e 60.
- Ao mudar, recalcular o orçamento do job (hoje 915 s), `GENESIS_QUEUE_RETRY_AFTER` e `GENESIS_CONTEXT_CACHE_LOCK_WAIT_SECONDS`, que são derivados desses timeouts.
- Testes: 503 vai para o próximo elo sem repair; JSON inválido faz um repair e depois o próximo elo; cadeia esgotada termina em erro e estorna o crédito.

### R5.2 Telemetria por chamada de IA (§13.2) — Confirmado
- `AiUsageRecorder::registrar()` ganha `analysis_uuid`, `requested_model`, `actual_model` e `fallback_from`. O job chama `setAnalysisUuid()`.
- Uma tabela no detalhe da análise no painel admin.

### R5.3 Golden tests dos indicadores (§13.3) — Confirmado
- Fixtures para 4 ativos × 5 timeframes, com pelo menos 600 velas fechadas cada. Hoje só existem `locked-candles.json` e `locked-indicators.json`; a pasta `tests/Fixtures/indicators` não existe.
- Gerador Python versionado, fora do CI. `IndicatorGoldenTest` com tolerâncias.
- O snapshot grava `indicator_basis = 'CLOSED_CANDLES'` e `indicators_observed_at`.

### R5.4 Observabilidade sem SaaS (§13.4) — novo
- Canal `genesis` (JSON, diário, 30 dias), `GenesisStage::medir()` em cada etapa do job e comando `genesis:metricas --dias=7`.

### R5.5 CI obrigatório (§13.5) — Parcial
- **Já feito (29/09):** `.github/workflows/secret-scan.yml` (gitleaks) no `genesis-api`.
- Pendente: `genesis-quality-gate.yml` com os jobs backend, frontend, secrets, sca e pacote.
- **Diverge:** o documento usa as branches `main` e `genesis2`. As reais são `staging`/`genesis2` (API) e `staging`/`master` (front).

### R5.6 Evidência declara bolsa e mercado (§13.6) — Confirmado
- Cada item do `EvidenceManifestBuilder` ganha `exchange` e `market_type`. Teste `EvidenceSemSpotTest`.
- `GENESIS_EVIDENCE_UNAVAILABLE` (linha 48): `warning` quando a fonte falha, `debug` quando o dado não existe.

### R5.7 Lista de scores única (§14, decisão 3 do PO) — Confirmado
- `config/genesis_graphical_v6.php:166` usa `range(0, 90, 5)`. Espelhar o enum de 55 a 90 do schema, se o PO confirmar.

---

## Fase 6 — Aceite (§16)

### R6.1 Os três casos reais mudam como o §16 manda
- APT 1w A: TP1 $1.1549 (R:R 0,85), risco $4,10 e 100% da margem.
- BTC 1w B: TP1/TP2/TP3 $85,501.4 / $88,000 / $92,000.
- APT, segundo timeframe: TP1 $0.8749 e uma zona só, `CAUTION_WIDE`.
- Slider que recalcula tudo e posição que sobrevive ao recarregamento.
- Payload antes e depois, log `genesis.alvos.*` do BTC e suítes sem falhas.

## Fora do escopo (§14)
Os itens externos 4, 5, 6, 7, 9.2, 13, 15 (parcial), 16, 17, 20, 31, 34, 42 e 43 não entram, pelos motivos do §14. Nenhum bloqueio de execução, nenhuma troca de modelo e nenhuma mudança no cálculo dos indicadores.
