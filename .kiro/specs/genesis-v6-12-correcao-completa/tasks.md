# Tarefas — genesis-v6-12-correcao-completa

Legenda: `[ ]` pendente · `[x]` feito · `[~]` parcial · `[D]` depende de decisão (design §8) · `[F]` tarefa do Felipe fora do código.
Repositórios: **API** = `genesis-api` · **FE** = `G-nesis-2.0-main`.
Cada item: teste que falha → correção → teste verde. Reler este arquivo no começo de cada fase.
O código de cada item está no documento-fonte (`C:\Users\felip\Downloads\GENESIS_V6_12_CORRECAO_COMPLETA_FELIPE.md`), na seção §N indicada no `requirements.md`. As tarefas não o copiam; onde o código real diverge do documento, vale o `design.md`.

## Pré-requisito

- [ ] P.1 Commitar o trabalho da spec `genesis-seguranca-correcoes`, que está pendente nos mesmos arquivos (design §1). Só quando o Felipe pedir.
- [ ] P.2 Suíte de base antes de mexer: API com as envs do fallback zeradas (anotar as 5 falhas conhecidas) e FE (`npm test`).

## Fase 0 — Segurança de emergência (dia 1)

- [~] 0.1 Dump fora do índice (API)
  - [x] 0.1.1 `git rm --cached genesis_v6_4_proofs/pre-migration-4-dump.sql` (29/09, spec de segurança)
  - [x] 0.1.2 `.gitignore`: `*.sql` e `*.dump` já estavam; acrescentada a pasta `genesis_v6_4_proofs/` (os 40 arquivos já versionados continuam até a D8)
  - [ ] 0.1.3 Commit
  - _R0.1_
- [D] 0.2 Reescrever o histórico com `git filter-repo` + push forçado + aviso para reclonar — **D1** (contraria a decisão de 30/07)
- [F] 0.3 Rotacionar as chaves do dump (Gemini, OpenAI, banco, `APP_KEY`), com lista e data
- [D] 0.4 Invalidar tokens: `[AUTH]` (membros) e v2 (admin) — **D2** (contraria 31/07; exige que os fronts tratem 401)
- [F] 0.5 Procurar cópias do dump em backups, forks, ZIPs e drive
- [~] 0.6 Telescope (API) — `S6TelescopeOcultaDadosSensiveisTest`
  - [x] 0.6.1 Teste: sem `TELESCOPE_ENABLED` no ambiente, desligado
  - [x] 0.6.2 `config/telescope.php` com padrão `false`
  - [x] 0.6.3 + `x-api-key` nos cabeçalhos; + `token`, `access_token`, `refresh_token` nos parâmetros (o cabeçalho interno real é `X-Internal-Token`, já oculto)
  - [ ] 0.6.4 [F] Produção: `TELESCOPE_ENABLED=false` + `php artisan telescope:clear` (com autorização)
  - _R0.2_
- [~] 0.7 CORS (API)
  - [x] 0.7.1 Origem por `CORS_ALLOWED_ORIGINS` + padrão `*.genesislabs.com.br` (29/09, S15)
  - [D] 0.7.2 Lista explícita sem padrão — **D3** (levantar antes todos os domínios reais que chamam a API)
  - [x] 0.7.3 Métodos GET/POST/PUT/PATCH/DELETE/OPTIONS; cabeçalhos Accept, Authorization, Content-Type, X-Requested-With, Idempotency-Key, X-Request-Id (medição) e Last-Event-ID (retomada do stream). O front só envia os quatro primeiros
  - [x] 0.7.4 `S15CorsRestritoTest`: preflight sem `*`, sem TRACE e sem `x-internal-token`
  - _R0.3_

## Fase 1 — Alvos, risco, slider e régua

- [ ] 1.0 Prova com os três casos reais (depende de **D6**)
  - [ ] 1.0.1 [F] Exportar de produção as análises APT 1w (28/09 11:17), BTC 1w (28/09 10:58) e APT segundo timeframe
  - [ ] 1.0.2 Fixtures sem dados pessoais em `tests/Fixtures/v612/`
  - [ ] 1.0.3 Teste de replay que grava o payload "antes" (TP1/2/3 com traço, risco $10,00, 243,6%)
  - _R6.1_
- [x] 1.1 `TargetEligibilityService` só por integridade (API) — 30/09
  - [x] 1.1.1 Testes novos (+ `EXCEDEU_TRES` e "sem stop, rr null"). **Prova:** com o código antigo, APT 1w e BTC 1w saíam com zero alvos
  - [x] 1.1.2 Os 3 testes de R:R e espaçamento apagados; `FORA_DOS_LIMITES` virou `FORA_DO_HORIZONTE` (nome do §5.1; nada no front lia)
  - [D] 1.1.3 Corte dos 3: **implementado como o documento (os 3 mais próximos), igual ao comportamento que já existia**. A recomendação do design §2.1 (preferência da IA, depois distância) segue aberta em **D4**; é uma linha a mudar
  - [x] 1.1.4 Arquivo substituído pelo §5.1
  - _R1.1_
- [x] 1.2 `assertPublished()` sem espaçamento, constante apagada, teste reescrito (dois níveis a 0,2 ATR não são bug), comentários do `GenesisDecisionSchema` atualizados — _R1.1_
- [x] 1.3 `AlvoService` sem a frase de culpa; `AlvoServiceCalcularAlvosTest` e `V69CriticalInvariantsTest` esperam `null` — _R1.1_
- [x] 1.4 `DecisionMechanicalRepairTest:542` usa o código só como exemplo de erro "não tratável em código" — continua válido, sem mudança
- [x] 1.5 Logs nos planos A e B via `TargetEligibilityService::registrarLogs()` (um lugar só) + `V612AlvosLogsTest` — _R1.2_
- [x] 1.6 Prompt linha 113 + `GenesisPromptTargetSelectionTest` — _R1.3_
- [x] 1.7 `rr1` do Plano B `null` sem TP1 (consumidores já aceitavam) — _R1.4_
- [x] 1.8 Projeções técnicas (API + FE) — `V612ProjecoesTecnicasTest` (15 testes)
  - [x] 1.8.1 Testes do §5.12
  - [x] 1.8.2 `TechnicalProjectionService`
  - [x] 1.8.3 `TargetCandidateCatalog` (construtor, pesos, projeções, Fibonacci com rótulo lido, `tipoRotulo()`)
  - [x] 1.8.4 `AlvoService::PESOS` igual ao catálogo (`range_wyckoff` era 9, virou 7; só afeta o peso padrão — o `NivelService` sempre passa o próprio)
  - [x] 1.8.5 Fibonacci: sem desenho nada; 1,618 com 0,9 entra com rótulo e força > 0,15; 0,5 fica fora e loga
  - [x] 1.8.6 `candidate_id` igual em duas montagens (o catálogo é montado uma vez e repassado à execução)
  - [x] 1.8.7 Projeção sobre barreira real forma grupo único com a barreira como fonte primária
  - [x] 1.8.8 Regressão: nenhum `extensao_fib` em `app/`
  - [x] 1.8.9 Prompt linhas 110 e 111 + teste
  - [x] 1.8.10 `PublicVocabularyService` não tem lista de fontes; a lista fechada é a do front (`utils/rotulos.ts`) — projeções e Fibonacci desenhado acrescentados lá
  - [x] 1.8.11 Etiqueta "Projeção" nos três alvos + `v612Projecao.test.ts`
  - _R1.3, R1.5_
- [x] 1.9 Risco limitado pela liquidação (API) — `TamanhoLiquidacaoTest`
  - [x] 1.9.1 Teste do APT (liquidação estimada 0,6581, a mesma do print)
  - [x] 1.9.2 `calcularTamanhoSugerido()` com a distância de liquidação e o teto na margem
  - [x] 1.9.3 Os três chamadores via `ExecucaoService::distanciaLiquidacaoPrevia()` (uma conta só)
  - [x] 1.9.4 **Prova no `/reprice`:** antes, risco $10 sobre margem de $8,34; depois, risco ≤ margem
  - **Divergência interna do documento, para o PO:** o código do §6.2 redimensiona a posição pela distância da liquidação (APT: nocional $20,53 → $51,28, risco segue $10, 97,5% da margem). A tabela do §16 diz "risco $4,10; 100% da margem", que só sairia mantendo o tamanho antigo. Implementado o §6.2 (é o que o teste do §15 pede)
  - _R1.6_
- [x] 1.10 Slider ligado à tela (FE + API)
  - [x] 1.10.1 Lógica pura em `utils/planoEfetivo.ts` + `v612PlanoEfetivo.test.ts` (pendente/erro desabilita, resposta velha descartada, confirmação com o stop efetivo)
  - [x] 1.10.2 `StopSlider`: `onRepriceState` + guarda de sequência. **Ajuste ao §7.2:** parado no stop recomendado, o slider não trava o botão (sem isso, uma falha de rede ao abrir a tela bloquearia a confirmação sem o membro mexer em nada)
  - [x] 1.10.3 `AnalysisResult`: `repriceA/B`, reset por análise, `planoEfetivo` em todos os números de risco, botão com "Recalculando..." / "Reprecificação indisponível"
  - [x] 1.10.4 `stopSliderNoNetworkCall.test.ts` continua verde
  - **Acréscimo necessário na API:** o `/reprice` não devolvia % do capital, % da margem, margem sobre o capital, R:R bruto, stop além da liquidação nem a verificação stop × liquidação — sem isso a tela misturaria números velhos e novos. Acrescentados (aditivo)
  - **Achado:** o tipo `PlanoSetup` nunca declarou `risco_planejado`/`risco_real`/`risco_desvio_pct` (4 erros de `tsc` antigos) — declarados; `tsc` zerado
  - _R1.7_
- [x] 1.11 Régua única do stop (API + FE)
  - [x] 1.11.1 Casos 3,58 / 5 / 2 ATR no PHP e no TS. **Mudança de comportamento prevista pelo §9:** sem liquidação conhecida, 10 ATR deixa de ser "zona técnica" e vira crítico (teste antigo atualizado)
  - [x] 1.11.2 Limiares em `config/genesis.php`; `NivelService` lê a config
  - [x] 1.11.3 Ordem do §9.2 no PHP e no TS
  - [x] 1.11.4 `execution.stop_slider_limiares` + `stop_risk_zone`/`stop_distance_atr` em cada plano (`PayloadPublicadoTest`, que ainda exigia 0,50 ATR entre alvos — trocado por ordem crescente)
  - [x] 1.11.5 Front usa os limiares do servidor (`limiaresDoServidor`); aviso "Stop mais largo" segue a zona do plano efetivo (análise antiga cai no `VALID_WIDE`)
  - _R1.8_
- [x] 1.12 Log `genesis.visao.pattern_estado_invalido` + teste — _R1.9_
- [x] 1.13 Contrato do stop (§15) — _R1.10_. Front: `v612PlanoEfetivo.test.ts`; API: `RepricingEndpointTest::test_contrato_do_stop_no_reprice` (com dois brackets reais simulados)
  - [x] 1.13.1 Entrada não muda
  - [x] 1.13.2 Preços de TP1/TP2/TP3 não mudam
  - [x] 1.13.3 R:R de TP1, TP2 e TP3 muda
  - [x] 1.13.4 Distância (% e ATR) muda
  - [x] 1.13.5 Risco em USD e em % do capital muda
  - [x] 1.13.6 Quantidade e nocional mudam
  - [x] 1.13.7 Margem comprometida muda
  - [x] 1.13.8 Liquidação muda quando o nocional troca de bracket
  - [x] 1.13.9 Zona da régua e aviso de stop largo mudam juntos
  - [x] 1.13.10 "Liquida antes do stop" acende e apaga
  - [x] 1.13.11 Confirmar grava o `stop_effective` exibido (front envia o plano efetivo; `ConfirmarPosicaoTest` confere `trades.stopPrice`)
  - [x] 1.13.12 Recarregar mantém o stop confirmado (`GET /v1/trades` + `useCarregarPosicoes`)
- [ ] 1.14 Replay depois: os três casos batem com a tabela do §16 — _R6.1_ (depende de **D6**, como o 1.0)
- [x] 1.15 Suítes (30/09): API 1440 testes, 4 falhas, todas conhecidas (2 do `.env` local com `gemini-3.5-flash`, 2 do `GraphicalAnalysisAttemptJobTest` que dependem da ordem); FE 511 passando, `tsc` sem erros. **Atenção:** duas execuções simultâneas da suíte deixaram análises gravadas no `testing.sqlite` e produziram 19 falhas falsas — as 8 análises de 30/09 foram removidas só desse sqlite

## Fase 2 — Posição confirmada e revelação

- [~] 2.0 Migrations — **D5 em parte**: as três foram escritas e aplicadas só no `database/testing.sqlite` (o bootstrap dos testes faz isso sozinho, com trava que aborta fora desse sqlite). **MySQL local e produção não foram migrados** — continuam dependendo de autorização
  - `2026_09_30_000001_add_posicao_confirmada_to_trades`
  - `2026_09_30_000002_add_posicao_confirmada_to_genesis_analise_planos`
  - `2026_09_30_000003_copy_revelado_por_to_user_revelacoes` (dados; idempotente; `down()` não apaga revelações pagas)
- [x] 2.1 Confirmar posição (API) — `ConfirmarPosicaoTest` (8 testes)
  - [x] 2.1.1 Migrations + `$fillable`/`$casts` (`AnalisePlano`, `Trade`)
  - [x] 2.1.2 Testes: grava `stop_user_adjusted`, snapshot e `trades.stopPrice` = `stop_effective`; stop recomendado não marca ajuste; sem débito; outro membro → 404; preços do cliente ignorados; stop do lado errado → 422 sem gravar
  - [x] 2.1.3 `POST /v1/analises/{id}/confirmar-posicao` (throttle 30/min, mesma checagem de alavancagem do `/reprice`)
  - **Achado:** `TradeController::index()`/`show()` estavam vazios — `GET /v1/trades` não devolvia nada. Implementados, restritos ao dono
  - **Acréscimo (consequência do §8.3):** `PATCH /v1/trades/{id}` (só status: Pendente/Executada/Finalizada) e `DELETE /v1/trades/{id}`, restritos ao dono — sem isso, "executar", "encerrar" e "limpar" voltavam no F5
  - _R2.1_
- [x] 2.2 `TradeController::store` sem débito (e sem a pré-checagem de saldo que só existia por causa dele). **Prova:** a rota antiga quebrava com 500 no teste — _R2.2_
- [x] 2.3 Confirmar posição (FE) — `v612Posicoes.test.ts`
  - [x] 2.3.1 `confirmarPosicao()`, `listarPosicoes()`, `atualizarStatusPosicao()`, `removerPosicao()` em `services/api.ts`
  - [x] 2.3.2 `onSaveTrade(planoEfetivo, plano)`; `handleSaveTrade` grava no servidor antes de mostrar; a posição exibida é a que o servidor gravou (`utils/posicoes.ts`). Botão trava com "Gravando..." (clique duplo não grava duas)
  - [x] 2.3.3 `ActiveTrade` com `analysisUuid`, `plano`, `stopPrice`, `stopSource`
  - [x] 2.3.4 `useCarregarPosicoes()` nas telas de posições ativas e de histórico (Finalizada vai para o histórico)
  - [x] 2.3.5 Testes vitest
  - _R2.1_
- [x] 2.4 Revelação por membro (API) — `V612RevelacaoPorMembroTest` (7 testes)
  - [x] 2.4.1 **Prova contra o código antigo:** B revelava e A perdia o `ativo`; A pagava duas vezes ($900 em vez de $950); o que o Radar revelava não aparecia no poll; a chave enviada ao `[AUTH]` não era fixa
  - [x] 2.4.2 `unique(user_id, alerta_id)` **já existia** em `user_revelacoes` — nenhuma coluna nova precisou
  - [x] 2.4.3 Migração de dados `revelado_por` → `user_revelacoes` (as colunas antigas ficam, nada é apagado)
  - [x] 2.4.4 `RevealAlertService`: lock por membro e alerta, checagem dentro do lock, chave `revelacao-alerta:{id}` nos dois caminhos de crédito (carteira local em transação; `[AUTH]` recusa um segundo débito com a mesma chave)
  - [x] 2.4.5 `AlertaController::reveal/poll` e `RadarController::revelar` usando o serviço. `revelado_por` deixou de ser lido e escrito. O `idempotency_key` do cliente continua aceito por compatibilidade, mas quem decide é a linha em `user_revelacoes`
  - _R2.3_
- [x] 2.5 Suítes: mesma rodada do 1.15 (as duas fases juntas). `CreditosCompletoTradeControllerTest` atualizado: a rota antiga deixou de cobrar no `[AUTH]`

## Fase 3 — Laravel

- [x] 3.1 Login admin (API) — `S10S11AdminLoginTest` (6 testes)
  - [x] 3.1.1 5/min por e-mail+IP e 20/min por IP; resposta genérica (29/09, S10)
  - [x] 3.1.2 Limitador próprio `admin-login` com + 30/hora por IP (o `login` genérico ficou como estava)
  - [x] 3.1.3 `admin.login.falha` com e-mail e IP (senha errada e não-admin)
  - [x] 3.1.4 Testes: 6ª tentativa/min → 429 (já existia); 31ª na hora → 429; falha gera log
  - _R3.1_
- [x] 3.2 Stream de alertas (API) — `V612StreamAlertasTest`
  - [x] 3.2.1 Sem revelação: sem `ativo`/`corretora`/`preco_atual`; quem revelou recebe; dois membros recebem o mesmo alerta
  - [x] 3.2.2 `enviado_sse`: só o stream lia; o radar e o worker Python só gravam 0 na criação — nada quebra
  - [x] 3.2.3 `AlertaPublicoService::apresentar()` — mesmo formato no `poll()` e no stream (conferido por teste)
  - [x] 3.2.4 Cursor por conexão (`Last-Event-ID` ou o alerta mais recente), eventos com `id:`; o stream não escreve mais `enviado_sse`
  - **Achado:** o stream mandava `Access-Control-Allow-Origin: *` fixo, furando o CORS restrito — removido
  - **Achado:** nenhuma tela do front chama `connectAlertasSSE` (que ainda passava o token por query string, que o middleware não lê). O vazamento era alcançável por quem chamasse a API direto com o token no cabeçalho
  - _R3.2_
- [x] 3.3 Teto de resolução: `max_long_side` 8000 e `max_megapixels` 25; PNG que declara 10000×10000 em poucos bytes → 422 (antes aceitava: 200); 4K continua aceito. A classe de teste ganhou `DatabaseTransactions` (deixava análises gravadas) — _R3.3_
- [x] 3.4 Docblock do `VerifyGenesisAuthToken`: ativo desde 10/09, fail-closed, disponibilidade do [AUTH] = da API, medido na etapa `auth` — _R3.4_
- [x] 3.5 Proxy Gemini: teto diário já feito (29/09, S13); divergência com o §11.6 registrada — _R3.5_
- [x] 3.6 Suítes (30/09, Binance acessível de novo): API 1475 testes — só as falhas conhecidas (2 do `.env` local, 2 do job dependentes de ordem, 1 colisão de e-mail do Faker); 1 aviso risky do `ob_end_clean()` do stream

## Fase 4 — Node legado

- [F] 4.1 `pm2 list` e `ss -ltnp` em produção, com a saída anexada (o `ecosystem.config.cjs` versionado sobe `vite preview`, não o `server.ts`)
- [x] 4.2 Remoção (FE) — `s8LegadoNode.test.ts` reescrito
  - [x] 4.2.1 `routes/api.js`, `services/database.ts`, JWT, stream e Bybit removidos (29/09, S8/S17)
  - [x] 4.2.2 Só o `server.ts` importava `express`, `cors`, `express-rate-limit`, `jsonwebtoken`, `mysql2` e `dotenv`
  - [x] 4.2.3 `server.ts` apagado; `dev` → `vite`; `build` → `vite build`; `start` removido; as 6 dependências + `@types/express`/`@types/cors` desinstaladas (o `esbuild` fica — o Vitest e o tsx usam). **Efeito:** `npm audit` de produção caiu de 4 moderadas para 1 moderada e 1 baixa
  - [x] 4.2.4 Teste reescrito para o estado final
  - [x] 4.2.5 `services/geminiService.ts` fica (é código do front)
  - _R4.1_
- [x] 4.3 CSP e token (FE) — `v612TokenECsp.test.ts`
  - [x] 4.3.1 Domínios levantados do código: API/[AUTH]/v1 (das variáveis `VITE_*`), Binance Futuros (REST e WebSocket), Binance Spot, Bybit, OKX, Bitget, Deribit, Yahoo, CoinGecko, alternative.me, CryptoCompare, AwesomeAPI e três proxies de CORS (corsproxy, allorigins, codetabs)
  - [x] 4.3.2 CSP injetada **só no build** por um plugin do Vite (`csp.config.ts`) — o dev server injeta scripts inline que uma CSP estrita quebraria. Script inline do Tailwind liberado **pelo hash** (calculado no build), nunca `unsafe-inline`. Conferido no Edge headless com o build servido: a tela de login carrega, o Tailwind roda e **nenhuma violação de CSP**. Telas logadas não foram abertas (as conexões delas vêm do levantamento do código). `frame-ancestors` não vale em `<meta>` — proteção contra iframe precisa de cabeçalho no Nginx (**pendente, servidor**)
  - [x] 4.3.3 `services/tokenStorage.ts` (`lerToken`/`gravarToken`/`apagarToken`) — as 11 leituras e 2 escritas passaram por ele; teste barra acesso direto à chave
  - _R4.2_
- [x] 4.4 FE: 519 testes passando, `tsc` sem erros, build ok com a CSP injetada

## Fase 5 — Qualidade

- [x] 5.1 Timeouts e regra de reserva (API) — 30/09
  - [x] 5.1.1 `V612RegraDeReservaTest`: transporte → próximo elo sem repair (já era assim); saída inválida → 1 repair no mesmo elo; **repair falhou → próximo elo** (novo: `DecisionProviderComElos`, `decidirAPartirDoElo()`; o job ganhou uma tentativa por elo de reserva — `tentativasMaximas()` = `max_attempts` + elos − 1); cadeia esgotada → FAILED + estorno (`test_falha_apos_esgotar_as_tentativas`). `FinalizarAnalisesTravadas` passou a usar as tentativas totais
  - [~] 5.1.2 Padrões novos: OpenAI 180→60; reserva OpenAI visão 60→40 e scan 45→25; scan Gemini 60→20 (também no `.env.example`). **Não aplicados (divergência, D7):** decisão Gemini 90→45 e visão Gemini 45→30 — nos logs locais, decisões reais levaram 51–84s (várias bateram nos 90s) e leituras reais de 34s e 45s; com os valores do documento elas cairiam na reserva, e a conta OpenAI está sem crédito. Recalibrar pelo p95 de `genesis:metricas`. **Decisão da reserva OpenAI voltou para 120 (01/10):** no teste local com o Gemini fora, o gpt-6-luna levou >50s em 4 de 4 decisões (timeout e análise presa em retry); com 120, a decisão levou 62s e a análise fechou em 99s
  - [x] 5.1.3 Orçamento do job (cadeia de 3 elos + fallback): 915s → 825s por tentativa; `retry_after=1000` e espera de lock de 105s continuam cobrindo. **`.env` de produção** precisa trocar `GENESIS_OPENAI_DECISION_TIMEOUT=180` (se estiver lá) para 60 e os `GENESIS_OPENAI_FALLBACK_*_TIMEOUT` e `GENESIS_GEMINI_SCAN_TIMEOUT` se estiverem setados; o `.env` local também tem `GENESIS_OPENAI_DECISION_TIMEOUT=180`
  - **Achado no teste do job:** com a regra nova, a 3ª tentativa ia para o `gemini_secondary` fora do `Http::fake` — chamava o Gemini REAL com a chave do `.env`. Fixada a reserva do arquivo de teste na OpenAI simulada
  - _R5.1_
- [~] 5.2 Telemetria (API) — `V612TelemetriaIaTest`, `V612AdminConsumoIaTest`
  - [x] `AiUsageRecorder`: `analysis_uuid`, `requested_model`, `actual_model`, `fallback_from` (o campo `model` antigo continua); clientes passam o modelo pedido; cadeia e failover informam o elo anterior; o job define a análise
  - [x] `GET /v1/admin/analises/{uuid}/consumo-ia` (admin) com as chamadas em ordem
  - [ ] Tabela na tela de detalhe do painel admin — o front do admin não está neste workspace
  - _R5.2_
- [~] 5.3 Golden tests — `IndicatorGoldenTest`
  - [F] 5.3.1 `tests/Fixtures/indicators/baixar_candles.py` pronto (4 ativos × 5 tempos, só velas fechadas, Binance Futuros). **A fapi responde 451 nesta rede** — rodar de uma máquina com acesso (a VPS, por exemplo) e versionar o resultado
  - [x] 5.3.2 `gerar_referencia.py` com a biblioteca `ta` (independente) + VWAP ancorado igual ao Gênesis. Referência gerada para as 300 velas de 1h que já estavam no repositório (`LOCKED_BTCUSDT_1h`)
  - [x] 5.3.3 Teste lê todas as fixtures; hoje confere 12 indicadores (EMA 21/50, RSI, MACD e sinal, ADX/+DI/−DI, ATR, estocástico, CMF, VWAP) — **todos batem com a `ta`**. EMA 200 só com ≥ 600 velas (entra com as fixtures do 5.3.1)
  - [x] 5.3.4 `indicator_basis = CLOSED_CANDLES` nos tempos e no `snapshot.technical` (`indicators_observed_at` já existia)
  - _R5.3_
- [x] 5.4 Observabilidade — _R5.4_ (`V612ObservabilidadeTest`, `V612GenesisMetricasTest`)
  - [x] 5.4.1 Canal `genesis` (JSON, diário, 30 dias)
  - [x] 5.4.2 `App\Support\GenesisStage::medir()` / `registrar()`
  - [x] 5.4.3 Etapas medidas: `upload` e `scan` (controllers), `vision`, `context`, `brain`, `persistence` e `total` (job), `market_data` (bundle), `indicators` (snapshot), `execution` (persistência), `response` (resposta pública). Mais `reprice` e `auth` (com `rejected` separado de falha do [AUTH])
  - [x] 5.4.4 `php artisan genesis:metricas --dias=7 [--ate] [--ativo] [--log-dir]`: p50/p95/p99 por etapa, failover por elo, 429/5xx por provedor, Plano A sem TP1/stop/liquidação, Plano B acionado, erro do `/reprice`, latência e erro do [AUTH]
  - [x] 5.4.5 Coberto por `V612TelemetriaIaTest` (503 no primeiro elo → `fallback_from` na chamada seguinte)
- [~] 5.5 CI
  - [x] 5.5.1 gitleaks (o `secret-scan.yml` de 29/09 virou o job `secrets` do gate)
  - [x] 5.5.2 API: `.github/workflows/genesis-quality-gate.yml` (backend, secrets, sca, pacote) em `staging`/`genesis2`. Aviso no YAML: parte da suíte consulta a Binance real e falha por rede se o runner cair numa região bloqueada
  - [x] 5.5.3 Front: `.github/workflows/genesis-quality-gate.yml` (frontend + secrets) em `staging`/`master`; build local ok
  - [x] 5.5.4 Triagem: **API** 3 altas (Laravel CRLF na regra `email` — não explorável na v2, forgot/reset desligados, mas **o [AUTH] tem esse fluxo ativo**; Laravel Excel — só importação de arquivo fixo; PHPUnit — só dev), 6 médias, 2 baixas, todas com motivo em `composer.json` (`config.audit.ignore`) e `.trivyignore`; `composer audit` sai 0. **Front** 4 moderadas (fflate, ip-address, mysql2, qs), nenhuma alta; o audit barra a partir de `high`
  - [ ] 5.5.5 Prova do job secrets — exige push de um branch de teste no GitHub (não feito)
  - [x] 5.5.6 Prova do job pacote (simulada localmente): repositório limpo passa; com um `.sql` falha. **Na API ele falha hoje:** 40 arquivos versionados em `genesis_v6_4_proofs/` (as provas da V6.4) — tirar do índice é decisão (**D8**)
  - [x] 5.5.7 Política no README da API e do front
  - _R5.5_
- [x] 5.6 Evidência: `exchange`/`market_type` por fonte (Binance USDⓈ-M para API, cálculo e leitura do gráfico; `SERVER` para o relógio) + `EvidenceSemSpotTest`; `warning` quando a fonte falha, `debug` quando o dado não existe. Os dois campos saem do pacote enviado à IA (~1 mil tokens a menos). **Achado (regra 12, fora do manifesto):** `MonitorCarteiraMaeCommand` e `ExchangeService` usam a API **Spot** da Binance — não entram na análise; registrado, sem mudança — _R5.6_
- [D] 5.7 Lista de scores igual ao enum 55 a 90 — **PO-3** — _R5.7_
- [x] 5.8 Suítes (30/09): API 1462 testes, 55 falhas — 51 porque a Binance Futuros passou a responder 451 nesta rede (mesmos testes passaram mais cedo com a Binance acessível), 2 do `.env` local (`gemini-3.5-flash`), 2 do job que dependem da ordem (passam isolados). Nenhuma do código novo. FE 511 passando, `tsc` sem erros, build ok. **Refazer a suíte da API com a Binance acessível antes do deploy.**

## Fase 6 — Aceite e entrega

- [ ] 6.1 Payloads antes e depois dos três casos + log `genesis.alvos.*` do BTC — _R6.1_
- [ ] 6.2 Screenshots: alvos, risco, slider, régua única e posição após recarregar
- [ ] 6.3 Suíte completa da API e do FE sem falhas novas (as conhecidas listadas)
- [ ] 6.4 Commits, um por item com o teste junto (§2), e push nas branches de produção — só quando o Felipe pedir
- [ ] 6.5 Deploy, migrations e `.env` em produção — só com autorização
