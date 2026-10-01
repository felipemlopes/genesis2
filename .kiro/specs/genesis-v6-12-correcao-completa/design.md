# Design — genesis-v6-12-correcao-completa

O código proposto está no documento-fonte (`GENESIS_V6_12_CORRECAO_COMPLETA_FELIPE.md`) e não é repetido aqui. Este design registra só o que muda em relação a ele: onde o código real é diferente, o que ele não previu, a ordem com a spec de segurança e as decisões que dependem do Felipe ou do PO.

## 1. Relação com a spec `genesis-seguranca-correcoes`

A spec de segurança deixou alterações sem commit nos mesmos arquivos que esta vai mexer (`routes/api.php`, `RouteServiceProvider`, `AuthController`, `TelescopeServiceProvider`, `config/cors.php`, `server.ts`).

- **Recomendação:** commitar o trabalho da spec de segurança **antes** de começar esta. Assim, "um commit por item" (§2) fica possível, sem misturar as duas.
- Mapa de sobreposição:

| V6.12 | Segurança | Estado |
|---|---|---|
| §3.1 dump | Fase 8 (8.2 a 8.4) | índice feito; histórico → D1 |
| §3.2 Telescope | S6 (Fase 3) | cabeçalhos feitos; padrão do config pendente |
| §3.3 CORS | S15 (Fase 6) | padrão feito; lista/métodos/headers → D3 |
| §11.2 admin login | S10 (Fase 5) | limite feito; por hora + log pendentes |
| §11.6 proxy Gemini | S13 (Fase 6) | teto diário feito |
| §12.1 a §12.5 Node | S8/S17 (Fase 7) | rotas removidas; `server.ts` e deps pendentes |
| §13.5 secrets | Fase 8 (8.3) | gitleaks feito; gate completo pendente |

A spec de segurança continua dona do que o V6.12 não cobre: webhooks (S3), admin da v1 (S5), crédito e quiz (S1/S2), cartão nos logs (S4) e LGPD.

## 2. Fase 1 — pontos de design

### 2.1 Corte dos 3 alvos (D4)
O `selecionar()` do §5.1 faz `usort` por distância em todos os elegíveis e publica os 3 primeiros. Com 4 ou mais elegíveis no ranking, a IA perde a escolha: vencem os 3 mais próximos, não os 3 preferidos.

**Recomendação:** percorrer o ranking na ordem da IA, pegar os 3 primeiros elegíveis e só então ordenar esses 3 por distância. Continua valendo "TP1 é sempre o mais próximo" e a regra 1 é respeitada. Enquanto D4 não sai, o teste fica escrito para a recomendação e marcado como dependente da decisão.

### 2.2 Onde está a chamada do Plano B
O documento põe o cálculo de tamanho do Plano B em `PlanoBService::gerar()`, mas a chamada de `calcularTamanhoSugerido` fica em `ExecucaoService:542`. O parâmetro novo entra nos três chamadores reais: `ExecucaoService:213`, `ExecucaoService:542` e `RepricingService:85`. Os logs de alvo (§5.4) vão onde o `selecionar()` é chamado de fato; conferir com grep na execução.

### 2.3 Testes que mudam por consequência
Além dos listados no §15:
- `tests/Unit/AlvoServiceCalcularAlvosTest.php:54` confere a frase de culpa e passa a esperar `null`.
- `tests/Unit/DecisionMechanicalRepairTest.php:542` usa `TARGET_SELECTION_TOO_CLOSE_TO_PREVIOUS` como exemplo de erro que o reparo não trata. Esse é o código da **IA**, não o `_INTERNAL_` do validador. Conferir se esse código ainda é emitido; se não for, trocar o exemplo.
- `tests/Unit/NivelServiceStopFinalAtrTest.php` cita as constantes no comentário.
- `tests/Unit/StopRiskZoneClassifierTest.php` ganha os casos de 3,58, 5 e 2 ATR.
- Comentário em `app/Support/GenesisDecisionSchema.php:198`.

### 2.4 Identidade das projeções
O `candidate_id` depende de símbolo, timeframe, lado, preço e tipo. Projeção de figura depende da visão, e a visão é lida uma vez e compartilhada (`LeituraVisualCompartilhada`). O teste de igualdade monta o catálogo pelo `CanonicalBundleBuilder` e pelo `ExecutionPipelineService` com a mesma entrada congelada e compara os ids.

### 2.5 Matemática da liquidação (§6)
Em margem isolada, a distância até a liquidação já é cerca de `1/alavancagem` menos a manutenção. Com ela como distância efetiva, `risco_usd` fica próximo da margem. O teto `min(risco, margem)` do §6.2 protege contra arredondamento e bracket. A liquidação prévia é calculada sobre o nocional estimado, em uma passada, como o documento indica. O teste do APT usa os números do §6.1.

### 2.6 Front
- `planoEfetivo` não muda `planoAtivo`. Entrada, alvos, textos e gatilho continuam vindo do plano original.
- Os nomes de campo do §7.3 são uma sugestão. Ajustar ao `PlanoSetup` real em `types.ts` e ao que a tela lê hoje.
- A troca de análise (`analiseId`) zera o reprice dos dois planos.

## 3. Fase 2 — pontos de design

### 3.1 Migrations (D5)
São três: colunas em `trades`, colunas em `genesis_analise_planos` e `unique(user_id, alerta_id)` mais `idempotency_key` em `user_revelacoes`, com a migração de dados de `revelado_por`. **Nenhuma roda sem autorização** (regra do projeto). Os testes usam sqlite com `DatabaseTransactions`; `RefreshDatabase` é proibido.

Antes do `unique`, conferir se há duplicatas em `user_revelacoes` de produção. Se houver, a migration precisa deduplicar antes.

### 3.2 `trades` guarda texto
As colunas atuais de `trades` são `string` (inclusive `entryPrice`). As novas (`stopPrice`, `stopRecommended`) entram como `decimal`, como o documento pede. A tela de performance precisa aceitar as duas formas.

### 3.3 `confirmarPosicao`
O código do §8.2 usa `$analise->symbol`, `$plano->direcao`, `$plano->entrada`, `$plano->tp1` e `responder()`. Conferir os nomes reais em `Analise`, `AnalisePlano` e no controller antes de copiar. A busca é por `uuid` e `user_id` do membro autenticado pelo `genesis.auth`.

### 3.4 Revelação com créditos no `[AUTH]`
Produção está com `GENESIS_AUTH_CREDITS_FULL_ENABLED=true`, então o `withdrawFloat` local não é o caminho real: o débito vai para o `[AUTH]`. O `RevealAlertService` segue o padrão que já existe na v2 para o quiz (`Cache::lock` + `adjustCreditForUser` com chave de idempotência, S2 da spec de segurança):
1. Fazer o lock por membro e alerta.
2. Conferir a linha em `user_revelacoes`.
3. Debitar no `[AUTH]` com a chave `reveal:{user}:{alerta}`.
4. Gravar a linha.

A chave fixa por membro e alerta faz o `[AUTH]` recusar o segundo débito mesmo se a gravação local falhar no meio.

## 4. Fase 3 — pontos de design

- **SSE:** o stream autentica por `?token=` na query (`routes/api.php:76-80`), não pelo cabeçalho. O presenter usa o usuário resolvido por esse caminho. O cursor começa no maior `id` existente, ou no `Last-Event-ID`.
- **`enviado_sse`:** o `VarreduraMicroRadarCommand:190` grava `0`. Conferir se alguém lê a coluna para outro fim, além do stream, antes de parar de escrever nela.
- **Admin login:** somar ao limitador `login` que já existe um `Limit::perHour(30)->by(ip)` só para a rota admin. Ou criar o `admin-login` do documento e manter o `login` nas outras rotas. Recomendação: criar o `admin-login` e deixar o `login` como está.

## 5. Fase 4 — pontos de design

- A remoção do `server.ts` muda o `npm run dev`. Ele passa a ser `vite`, e o proxy de desenvolvimento, se houver, vai para o `vite.config.ts`. O `build` perde o `esbuild`.
- Antes de remover `cors` e `express`, conferir com grep que nada mais os importa (testes inclusive).
- CSP: começar em `Content-Security-Policy-Report-Only`? O meta não aceita report-only. Então o teste é manual, pelo Console em desenvolvimento e no `vite preview`, com todas as telas: análise, radar, alertas, pagamento e login.

## 6. Fase 5 — pontos de design

- **Timeouts:** o `config/genesis_graphical_v6.php` (em volta da linha 297) deriva as esperas de lock dos timeouts. O orçamento do job (915 s) e o `GENESIS_QUEUE_RETRY_AFTER=1000` de produção foram calculados com os valores atuais. Recalcular e documentar os novos números no mesmo commit, e avisar que o `.env` de produção muda.
- **Golden tests:** precisam de candles reais da Binance Futuros (fapi) e de Python com `pandas` e `ta` na máquina local. As fixtures são geradas uma vez e versionadas. O CI só roda o PHP.
- **CI:** o job backend precisa de sqlite, `.env` de teste e as envs do fallback zeradas (senão cai nas 39 falhas já conhecidas). `npm audit` e `trivy` com `exit-code 1` podem ficar vermelhos logo no primeiro dia. A triagem inicial entra na tarefa.
- **Evidência:** `macro` e `sentimento` declaram `MACRO` e `SENTIMENT`. O teste lê o manifesto de uma análise congelada.

## 7. Aceite (Fase 6)

Não dá para gerar análises reais deste ambiente: o Gemini não é acessível daqui, e chamadas pagas exigem autorização. O caminho é **replay**:
1. O Felipe exporta de produção as três análises do §16 (linhas de `genesis_analises` e `genesis_analise_planos`, com a decisão da IA e o snapshot).
2. Elas viram fixtures sem dados pessoais (só símbolo, timeframe, decisão, snapshot e catálogo).
3. Um teste roda a execução (`ExecutionPipelineService`, `ExecucaoService`, `PlanoBService`) com a decisão congelada, **antes e depois** das mudanças, e grava os dois payloads.
4. Os screenshots saem do front local, apontado para uma API local com essas análises.

Decisão D6: acesso às três análises de produção.

## 8. Decisões

| # | Decisão | Quem | Recomendação |
|---|---|---|---|
| D1 | Reescrever o histórico do Git (§3.1 passo 2). Contraria a decisão de 30/07 | Felipe | Seguir o documento do PO (ele prevalece), mas só depois de rotacionar as chaves e avisar quem tem clone |
| D2 | Invalidar tokens (§3.1 passo 4). Contraria a decisão de 31/07; os tokens de membro estão no `[AUTH]` | Felipe | Invalidar no `[AUTH]` (membros) e na v2 (admin), depois que os fronts tratarem 401 |
| D3 | CORS com lista explícita (documento) ou padrão `*.genesislabs.com.br` (feito em 29/09) | Felipe/PO | Lista explícita (o documento prevalece), levantando antes todos os domínios reais em uso |
| D4 | Corte dos 3 alvos: preferência da IA ou proximidade | PO | Preferência da IA e depois ordem por distância (§2.1) |
| D5 | Rodar as migrations das Fases 2 (trades, planos, revelações) | Felipe | Autorizar localmente para os testes; produção só no deploy |
| D6 | Exportar as três análises reais de produção para o replay | Felipe | Exportar só símbolo, timeframe, decisão, snapshot e catálogo |
| D7 | Timeouts do Gemini (§13.1 pede decisão 45s e visão 30s). Logs locais mostram decisões reais de 51–84s e leituras de 34–45s | PO | Manter 90/45 até o p95 de `genesis:metricas` em produção; aplicar o resto do §13.1 (feito) |
| D8 | Job `pacote` do CI barra `genesis_v6_4_proofs/` inteiro — hoje há 40 arquivos de prova versionados ali | Felipe | `git rm --cached` da pasta (cópia local fica) ou estreitar a regra para dumps/env/backup |
| PO-1 a PO-6 | §17 do documento (alavancagem, cadeia, score, Node, MFA, cookie) | PO | Não bloqueiam as Fases 1 a 3. PO-3 bloqueia R5.7; PO-4 já tem a recomendação atendida pela Fase 7 da segurança |

## 9. Regras de execução

- Reler o `tasks.md` no começo de cada fase e marcar cada item concluído.
- Cada correção começa pelo teste que falha (prova), segue com a correção e termina com o teste verde.
- Suíte da v2 com as envs do fallback zeradas e sem `bootstrap/cache/config.php`.
- Commit e push só quando o Felipe pedir. Deploy, `.env` de produção e limpeza (`telescope:clear`, tokens) só com autorização explícita.
- Nenhum item muda como a IA decide, exceto a linha 111 do prompt, aprovada pelo PO.
