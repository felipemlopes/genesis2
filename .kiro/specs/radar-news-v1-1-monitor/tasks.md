# Plano de Implementação: Radar News V1.1 — Correção Técnica (pasta `monitor/`)

## Visão Geral

Fonte de verdade: `RADAR_NEWS_V1_1.md` / `RADAR_NEWS_V1_1.pdf` — De Fabrício (Genesis Labs, PO), Para
Felipe (Dev), 02/08/2026. Base: Especificação Oficial Radar News V1.0 (05/07/2026) + auditoria da
entrega recebida.

**Escopo deste plano: só a pasta `monitor/`.** Arquivos tocados —
`monitor/rss_collector.py`, `monitor/ai_classifier.py`, `monitor/telegram_dispatcher.py`,
`monitor/worker_radar_news.py`, `monitor/.env.example`, `monitor/genesis-monitor.conf`, mais um
arquivo novo, `monitor/eventos_graves.py`, e a árvore versionada de `monitor/` (`.gitignore`,
`.hypothesis/`, `__pycache__/`, `.pytest_cache/`).

**Fora de escopo deste plano** (o documento original cobre, este não): migrations do `genesis-api`
(`genesis_radar_dispatch`, `genesis_radar_resumo`, `genesis_radar_telemetria`, `ALTER TABLE
genesis_radar_news` adicionando `title_original`/`supressao`/`adiado_ate`/`piso_aplicado`),
`app/Services/RadarNewsService.php`, `hooks/useRadarNewsAlerts.ts`. Ver seção "Dependência externa"
abaixo — vários itens deste plano **não funcionam em runtime** sem essas migrations, mesmo com o
código Python pronto e correto.

**Achado da auditoria que este plano registra (o documento V1.1 está desatualizado nestes dois
pontos):** a Seção 1 do documento marca C10 (popup com gate por nível) e a Seção 2 (Carteira
Cripto.ico) como "NÃO ENTREGUE". No repositório atual, ambos já existem: `hooks/useRadarNewsAlerts.ts`
e `app/Services/RadarNewsService.php` (com filtro `nivel <= 2`) já estão implementados; a migration
`2026_07_18_000001_create_genesis_carteira_tokens_table.php` e o seeder
`GenesisCarteiraTokensSeeder.php` já existem com os 15 ativos exatos da spec. `monitor/ai_classifier.py`
já lê essa tabela via `load_carteira_tokens()`. Isso não muda nada dentro de `monitor/`, mas significa
que a carteira Cripto.ico já está disponível como fonte de dados para tudo que este plano faz aqui.

**Status geral em 05/08/2026: todas as 8 fases implementadas e verificadas (código + 68 testes
verdes, `python -m pytest monitor/tests/` completo — 97 passed, incluindo a suíte pré-existente do
outro worker).** A6 (fontes RSS novas) ficou pendente de verdade — Reuters Business é link morto
(301→404), não só burocracia. RT-01/02/03/05/06/07/08 seguem pendentes de ratificação do Fabrício —
implementados como o documento propõe, marcados no código, não considerados definitivos. Quatro
tensões reais do próprio documento foram encontradas e documentadas sem eu resolvê-las por conta
própria: D2 (retry de FAILED inviável com o código literal dado), D4 (sem segunda tentativa se o
envio falhar após a reserva), F06 (grep de `impact_summary` zero é inatingível sem renomear a coluna
real do banco), e o bug de regex do Bloco C (esse sim corrigido, pois quebrava a própria prova P18 do
documento). Tudo que depende de migrations do `genesis-api` (`genesis_radar_dispatch`,
`genesis_radar_resumo`, `genesis_radar_telemetria`, colunas `title_original`/`supressao`/
`adiado_ate`/`piso_aplicado`) tem código pronto e testado por mock, com prova real de ponta a ponta
pendente — nenhuma migration foi criada ou sugerida para execução automática.

## Regras do documento que este plano tem que obedecer (não são escolha minha)

1. **Aviso 2 (bloqueante).** A chamada ao Gemini usa a API interna Genesis, nunca a API oficial do
   Google. Chamada direta é proibida por custo — e o efeito colateral real é pior que o custo: quando
   a chamada direta falha, o worker descarta lotes inteiros de notícia em silêncio.
2. **O filtro fica mais rígido, nunca mais frouxo.** A finalidade do Radar News é ruído zero. Nenhum
   item deste plano deveria facilitar disparo — onde o documento abre (categorias 3/4/10
   alcançando o Telegram, Bloco E1), é porque a V1.0 já mandava disparar e a regra de nível fechava a
   porta por engano, não afrouxamento novo.
3. **Regra de entrega do próprio documento:** a devolução volta sem leitura se vier sem as provas P01
   a P24 (seção 10 do documento) e sem os greps obrigatórios (seção 11), cada prova com log do ciclo
   e, onde couber, print do Telegram. Aplico esse mesmo padrão de rigor a cada fase deste plano.
4. **Fail-closed em anti-repetição, fail-open em orçamento.** Onde a dúvida é "já mandei essa
   notícia?", erro = não manda (D1, `_ja_foi_ao_telegram`). Onde a dúvida é "posso gastar orçamento
   nessa notícia?", erro = libera (`_pode_disparar`, mantido). Não inverter essa assimetria em nenhum
   dos dois blocos.
5. **Onde o documento dá código pronto ("REMOVER"/"COLOCAR"), a implementação segue esse código
   literalmente**, sem reescrever por preferência própria — mesmo padrão já usado nos planos
   anteriores deste projeto (V6.5/V6.6).

## Itens que dependem de ratificação do Fabrício antes de codar (RT)

O documento marca 8 decisões como propostas dele mesmo, ainda não fechadas. Destas, as que tocam
`monitor/` **não devem ser implementadas nesta pasta antes da ratificação**:

| ID | Decisão | Toca `monitor/`? |
|---|---|---|
| RT-01 | Listas de entidades de C.1 (corretoras, tesourarias, emissores) | Sim — `eventos_graves.py` (Fase 3) |
| RT-02 | Limiares numéricos de C.2 (US$ 25 mi exploit, 2% depeg, 3%/8% unlock, US$ 500 mi/1 bi ETF, US$ 1 bi liquidação) | Sim — `eventos_graves.py` (Fase 3) |
| RT-03 | Assimetria G03 (venda tesouraria = CRÍTICA, compra = ALTA) | Sim — `eventos_graves.py` (Fase 3) |
| RT-04 | Regra do `UNCERTAIN` (prefere perder notícia a repetir no grupo) | Sim — `worker_radar_news.py` (Fase 5, mas bloqueada pela dependência externa de qualquer forma) |
| RT-05 | 5 fontes RSS novas (SEC, CFTC, Fed, CoinDesk, Reuters) | Sim — `rss_collector.py` (Fase 4) |
| RT-06 | Categorias 2/3/4/10 como sistêmicas em E1 | Sim — `ai_classifier.py` (Fase 6) |
| RT-07 | Janela útil de 6h e adiamento de 45min em E2 | Sim — `worker_radar_news.py` (Fase 6) |
| RT-08 | Limiar de similaridade 85→88 sobre título original | Sim — `rss_collector.py` (Fase 1) |

Também não fechado: o **formato exato do corpo de requisição/resposta da API interna Genesis**
(`GENESIS_AI_URL`) é "[ESPAÇO RESERVADO PARA O DEV]" no próprio documento — preciso desse contrato
(endpoint real, shape do JSON de request/response) antes de codar A1 na Fase 1. Não é RATIFICAR PO,
é informação técnica que falta.

## Dependência externa que este plano não resolve (fora da pasta `monitor/`)

Estas colunas/tabelas do `genesis-api` **não existem ainda** (confirmado nas migrations atuais) e
vários itens abaixo ficam com código pronto mas sem onde persistir até elas existirem:

- `genesis_radar_news.title_original` — sem ela, a similaridade do coletor (A3) não tem título
  original contra o que comparar (a coluna `title` grava o já traduzido).
- `genesis_radar_news.supressao` e `adiado_ate` — sem elas, D1 e E2 não têm onde marcar supressão/
  adiamento.
- `genesis_radar_news.piso_aplicado` — sem ela, a telemetria de C.3 não persiste (a lógica de
  promoção de severidade funciona sem essa coluna; só o registro dela em disco depende dela).
- `genesis_radar_dispatch` — bloqueia inteiramente D2 (idempotência de envio).
- `genesis_radar_resumo` — bloqueia inteiramente D4 (resumo idempotente).
- `genesis_radar_telemetria` — bloqueia inteiramente o Bloco G.

**Decisão de sequenciamento:** escrevo o código Python de cada bloco mesmo assim (ele é testável
isoladamente com mocks/fixtures), mas marco explicitamente em cada tarefa afetada que a prova de
ponta a ponta (rodando contra o worker real) fica pendente até essas migrations existirem. Não crio
nem sugiro criar essas migrations sem autorização explícita — mexer no banco do `genesis-api` (mesmo
o de dev) exige perguntar antes, por acordo já registrado com você.

**Atualização de 13/08/2026 (autorizado por você):** criada a migration
`genesis-api/database/migrations/2026_08_13_000001_alter_genesis_radar_news_add_v1_1_fields.php`,
adicionando as 4 colunas desta lista (`title_original`, `supressao`, `adiado_ate`, `piso_aplicado`) em
`genesis_radar_news`. **Arquivo criado, `php artisan migrate` ainda NÃO rodado** — falta você confirmar
a execução contra o banco (`genesisteste`) separadamente. `genesis_radar_dispatch`,
`genesis_radar_resumo` e `genesis_radar_telemetria` continuam não criadas (fora do escopo desta
migration pontual).

## Dependências técnicas internas (não podem ser invertidas)

- **A3 → A4.** A3 tira a checagem de `title_hash`/similaridade de dentro de `persist_classified` e
  move para o coletor. A4 mexe na trava de `event_key` que fica no mesmo método. Fazer A4 primeiro
  arrisca reintroduzir a checagem que A3 acabou de remover.
- **Bloco B → Fase 3 (A4 + Bloco C).** A regra de granularidade do `event_key` (evitar chave genérica
  tipo `BTC|REGULACAO|2026-08-02`) faz parte do prompt do Bloco B. `normalizar_event_key()` (A4) só
  faz sentido depois que o prompt já pede o formato certo.
- **Bloco C independente de A-B em termos de código**, mas logicamente só faz sentido depois do Bloco
  B existir — sem `GATILHOS_POR_CATEGORIA`, o Gemini já classifica mal a severidade, e o piso
  determinístico de C.3 vira a única linha de defesa (o que é o oposto do desenho: piso é rede de
  segurança, não critério primário).
- **E1 (`calcular_nivel`) independente das demais**, mas testar P14-P19 exige C.3 (`piso_de_severidade`)
  já aplicado em `_merge_classifications`, porque várias provas (P14, P15, P17, P18) dependem do piso
  promovendo a severidade antes do nível ser calculado.
- **D1/D2 dependem da tabela externa `genesis_radar_dispatch`** (ver seção acima) para prova real,
  mas o código de `_ja_foi_ao_telegram`/`_reservar_despacho` pode ser escrito e testado com mock de
  conexão antes disso.

---

## FASE 1 — 🔒 Bloqueantes imediatos (A1, A2, A3)

Prioridade máxima do documento — sem isso, o resto não deveria nem ser testado, porque a causa
provável da perda silenciosa de notícias está aqui. Nenhuma outra fase começa antes desta fechar.

- [x] **A1 (bloqueante)** — Chamada ao Gemini pela API interna Genesis, nunca a API pública do Google
      — `monitor/ai_classifier.py:20-33,192-260,392-442` (implementado em 05/08/2026)
  - Status: **código aplicado, prova REAL pendente.** `GEMINI_URL`/`params={'key': self.api_key}`
    removidos. Novo `_call_gemini(prompt, max_output_tokens=MAX_OUTPUT_TOKENS)`: `GENESIS_AI_URL`/
    `GENESIS_AI_TOKEN` do ambiente, `GEMINI_MODEL` default `gemini-3.6-flash`, `GEMINI_TIMEOUT = 45`,
    `MAX_OUTPUT_TOKENS = 8192`, `BATCH_SIZE` módulo-level 5→3, retry de 3 tentativas (5s/10s, backoff
    `5 * 2**attempt`) só em 429/500/502/503/504, `logger.critical` + retorno `None` se `GENESIS_AI_URL`
    vazia. `classify()` ganhou o mesmo gate no topo (fail-fast antes de tentar qualquer batch).
    Consequência necessária não coberta explicitamente pelo documento: `worker_radar_news.py`
    exigia `GEMINI_API_KEY` em `_validate_env()` — trocado por `GENESIS_AI_URL` (senão o worker nunca
    subiria mesmo configurado corretamente). `AIClassifier.__init__` manteve o parâmetro `api_key`
    por compatibilidade de assinatura (testes existentes chamam `AIClassifier(api_key='fake')`), mas
    não é mais lido em lugar nenhum.
  - **Payload ainda não confirmado contra o endpoint real:** implementei literalmente o corpo mostrado
    no documento (`model`, `prompt`, `temperature: 0`, `response_mime_type`, `max_output_tokens`,
    `thinking_budget: 0`; resposta lida como `{"text": "..."}`) — o próprio documento marca esse
    formato como espaço reservado para confirmação. Não vai funcionar contra a API interna de verdade
    até alguém confirmar o contrato real.
  - **Superado em 13/08/2026 (decisão sua, reverte o Aviso 2):** produção nunca teve gateway interno —
    `GENESIS_AI_URL` já apontava pra `generativelanguage.googleapis.com` com esse payload de espaço
    reservado, dando HTTP 401 em produção (log real: `Expected OAuth 2 access token...`).
    `_call_gemini` reescrito pro contrato real do Google v1beta (`POST
    {GENESIS_AI_URL}/v1beta/models/{model}:generateContent`, header `x-goog-api-key`, corpo
    `contents`/`generationConfig`, resposta `candidates[0].content.parts[0].text`).
    `GENESIS_AI_URL`/`GENESIS_AI_TOKEN` continuam os nomes de variável (host + API key do Google,
    respectivamente) — só o formato da chamada mudou. `.env.example` e `monitor/.env` local
    atualizados. `pytest` — 97/97 verdes depois da mudança (nenhum teste existente cobria o shape
    HTTP literal, então nada quebrou). **Chamada real contra a API do Google ainda não testada nesta
    sessão** — token de produção colado no log (`AQ.Ab8...`) não tem o formato usual de API key do
    Google (`AIza...`); pode precisar de uma key nova.
  - Depende de: nada.
  - Verificação feita: `python -c "import ai_classifier"` limpo; `python -m pytest
    tests/test_radar_news_v1.py` — 28/28 verdes. P01 rodado: `grep -rn "generativelanguage" monitor/`
    → zero. P02 rodado manualmente (`GENESIS_AI_URL` vazia → `CRITICAL` logado, `classify()` devolve
    `[]`, nenhuma chamada de rede feita).
  - Prova exigida (pendente): P03 (3 notícias classificadas via API interna real, log com
    `gemini-3.6-flash`) — exige `GENESIS_AI_URL`/`GENESIS_AI_TOKEN` reais, que não tenho.

- [x] **A2 (bloqueante)** — Lote perdido nunca mais pode sumir em silêncio —
      `monitor/ai_classifier.py::classify()` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado com mock.** Ao falhar o lote inteiro (`raw_response` ou
    parse `None`), reprocessa entrada por entrada (`max_output_tokens=3072`); o que ainda falhar
    individualmente vira `logger.error('[AI] PERDIDA sem classificacao: ...')` e incrementa
    `self._telemetria['perdidas_classificacao']` (dict novo em `__init__`, em memória — persistência
    em `genesis_radar_telemetria` é Bloco G, fora de escopo desta fase).
  - Depende de: A1 (usa a mesma `_call_gemini` corrigida). Feito.
  - Verificação feita: P04 rodado manualmente com `_call_gemini` mockado (lote de 3 falha, 2
    reprocessadas com sucesso individualmente, a 3ª falha de novo e é logada como PERDIDA) — 4
    chamadas ao mock no total (1 lote + 3 individuais), `perdidas_classificacao == 1`, resultado final
    com as 2 que sobreviveram. Comportamento bate exatamente com o esperado pela prova.

- [x] **A3 (bloqueante)** — Dedup por título + fonte sai do coletor; hash global + similaridade sobre
      título original entram — `monitor/rss_collector.py::deduplicate()`,
      `monitor/ai_classifier.py::persist_classified()` (implementado em 05/08/2026)
  - Status: **código aplicado, prova unitária verde, prova de ponta a ponta pendente de coluna.**
    `AND source = %s` removido do coletor. Novo `deduplicate()`: hash global 24h (sem `source`) +
    similaridade 72h com `rapidfuzz`, comparando contra `title_original` das últimas 72h.
    `SIMILARITY_THRESHOLD` mantido em **85** (não subi para 88 — RT-08 continua pendente de
    ratificação do Fabrício; documentei no comentário do código). Em `ai_classifier.py::
    persist_classified`, removida a trava de similaridade sobre `titulo_pt` e a checagem de
    `title_hash` — fica só a trava de `event_key` (sem alterar a janela em Python, isso é A4/Fase 3).
    `SIMILARITY_WINDOW_HOURS`/`SIMILARITY_THRESHOLD` saíram de `ai_classifier.py` (F03) e entraram em
    `rss_collector.py`; `from rapidfuzz import fuzz` também saiu do topo de `ai_classifier.py`
    (ficou sem uso) e virou import local dentro de `deduplicate()`, como no código do documento.
  - **Nota de dependência externa confirmada:** a query `SELECT title_original FROM
    genesis_radar_news ...` assume a coluna `title_original`, que não existe ainda no banco. Código
    já preparado; prova real de ponta a ponta (contra banco de verdade) fica pendente dessa migration.
  - Depende de: nada dentro de `monitor/`. RT-08 pendente para o valor final do threshold (85→88).
  - Verificação feita: `python -m pytest tests/test_radar_news_v1.py` — 28/28 verdes, incluindo 4
    testes novos (`test_a3_*`) cobrindo P06 (hash global bloqueia mesmo com fonte diferente) e P07
    (similaridade 72h bloqueia manchete parafraseada) com conexão mockada. `test_c2_new_fact_is_
    inserted` e `test_c2_event_key_duplicate_blocked` ajustados para o novo `persist_classified` (só
    1 `fetchone` em vez de 2). P05 rodado: `grep -n "source = %s" monitor/rss_collector.py` → zero.
  - Prova exigida (pendente): P06/P07 reais contra banco com `title_original` populado.

**Pacote de evidências desta fase:** código de A1/A2/A3 aplicado; `python -m pytest
tests/test_radar_news_v1.py` → **28 passed**; greps P01 e P05 rodados e limpos; P02 e P04 verificados
manualmente com mock. **Não rodei nada contra API/banco reais** — não tenho `GENESIS_AI_URL`/
`GENESIS_AI_TOKEN` nem a coluna `title_original` existe ainda. Reviso com você antes de seguir pra
Fase 2.

---

## FASE 2 — 🔒 Bloco B: o filtro de conteúdo que nunca foi implantado

A correção central do documento. Sem gatilho nenhum no prompt hoje — só os nomes das 10 categorias
em uma linha.

- [x] **Bloco B** — Inserir `GATILHOS_POR_CATEGORIA` (as 10 categorias, cada uma com lista DISPARA/
      NUNCA) no `CLASSIFICATION_PROMPT`, logo depois da lista de categorias —
      `monitor/ai_classifier.py:60-202` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado, prova comportamental REAL pendente.** Texto das 10
    categorias copiado literalmente da seção 3 do documento, como constante própria
    `GATILHOS_POR_CATEGORIA`, concatenada ao `CLASSIFICATION_PROMPT` logo após a lista curta de
    categorias (mantive a lista curta também — o modelo ainda precisa do número/nome de cada categoria
    pra preencher `"categoria"`, os gatilhos só qualificam o critério). Regra de granularidade do
    `event_key` adicionada logo em seguida ("o TIPO_EVENTO descreve o FATO ESPECÍFICO, nunca a
    categoria", com os 2 exemplos corretos e os 2 errados do documento, literais).
  - Depende de: nada.
  - Verificação feita: `ai_classifier.CLASSIFICATION_PROMPT.format(carteira_text=..., entries_text=...)`
    renderiza sem placeholder sobrando e contém `DISPARA`/`NUNCA`/`REGRA DO event_key` no texto final
    (prompt final: 8059 caracteres). `python -m pytest tests/test_radar_news_v1.py` — 28/28 verdes
    (nada nesta fase toca em código testado por unit test; a mudança é só o texto enviado ao modelo).
    Grep presente: `GATILHOS_POR_CATEGORIA` em `ai_classifier.py` (2 ocorrências: definição + uso).
  - Prova exigida (pendente): P13 (rodar o classificador com as mesmas 20 manchetes fixas antes e
    depois da mudança, tabela comparativa de `categoria`/`severity`/`acionavel`) — exige chamada real
    à API interna Genesis (mesma dependência de A1/P03: preciso de `GENESIS_AI_URL`/
    `GENESIS_AI_TOKEN` reais). Não dá pra simular essa prova com mock sem fabricar o julgamento do
    modelo, que é exatamente o que P13 precisa observar de verdade.

**Pacote de evidências desta fase:** prompt atualizado e verificado estruturalmente; suíte de testes
verde; P13 (a prova que realmente importa aqui — o efeito comportamental do gatilho no modelo) fica
pendente até haver acesso real à API interna. Reviso com você antes de seguir pra Fase 3.

---

## FASE 3 — 🔒 A4 (event_key normalizado) + Bloco C (piso determinístico)

⚠️ **C.1/C.2/C.3 têm números e listas de entidade marcados RATIFICAR PO (RT-01/RT-02/RT-03). Não
escrevo os valores finais em `eventos_graves.py` sem essa confirmação** — a estrutura do arquivo e as
funções podem ser escritas com os valores do documento como placeholder, mas não temos autorização
para considerá-los definitivos.

- [x] **A4 (alta)** — `event_key` normalizado, coerente com índice único global —
      `monitor/ai_classifier.py` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado.** Nova função `normalizar_event_key()`:
    `ENTIDADE|TIPO_EVENTO|AAAA-MM-DD`, maiúsculo, sem acento, sem espaço; devolve `None` (com
    `logger.warning`) se malformada ou sem data ISO válida. Aplicada em `_merge_classifications` no
    lugar do `.strip() or None` cru anterior. Trava em `persist_classified` **sem janela em Python**
    (`SELECT id FROM genesis_radar_news WHERE event_key = %s LIMIT 1`) — `EXACT_HASH_WINDOW_HOURS`
    removida do arquivo inteiro (F04; ficou sem nenhum outro uso depois de A3, então saiu junto com
    `datetime`/`timedelta`, que também ficaram sem uso). Log de colisão do índice único subiu de
    `DEBUG` para `ERROR`, com título e `event_key`.
  - Depende de: A3. Feito.
  - Verificação feita: `python -m pytest tests/test_radar_news_v1.py` — **40/40 verdes**, incluindo 5
    testes novos de A4 (normalização com acento, malformado, data não-ISO, ausência de janela na
    query via `inspect.getsource`, e log em `ERROR` — nunca `DEBUG` — na colisão de `IntegrityError`
    via `caplog`).
  - Prova exigida (pendente): P08/P09/P10 reais contra banco (a lógica está coberta por unit test;
    falta rodar contra MySQL de verdade, o que não fiz nesta sessão).

- [x] **Bloco C — arquivo novo `monitor/eventos_graves.py`** — piso determinístico de severidade, só
      promove, nunca rebaixa (implementado em 05/08/2026)
  - Status: **código aplicado, verificado, com um bug do próprio documento encontrado e corrigido.**
    `EXCHANGES_SISTEMICAS`, `TESOURARIAS_BTC`, `EMISSORES_SISTEMICOS` e as 5 regex, copiadas
    literalmente do documento e marcadas no topo do arquivo como **pendentes de ratificação
    (RT-01/RT-02/RT-03)** — não são definitivas. `piso_de_severidade()` cobre G01/G02/G03/G05/G06/G07.
    Aplicado em `ai_classifier.py::_merge_classifications` logo depois de validar `severity`, com
    `ORDEM_SEV` (módulo novo em `ai_classifier.py`) promovendo a severidade, marcando
    `cls['acionavel'] = True` e gravando `e['piso_aplicado']` (fica em memória — ver dependência
    externa da coluna).
  - **Bug encontrado e corrigido durante a verificação (não estava no meu escopo de "reproduzir
    literal", mas quebrava a prova P18 do próprio documento):** em `_maior_valor_usd()`, a alternância
    regex original listava `mil` antes de `million`/`milhao`/`milhoes`. Como `mil` é prefixo dessas
    três palavras, `"$340 million"` casava só os 3 primeiros caracteres de "million" como se fosse
    "mil" (× 10³), devolvendo 340 mil em vez de 340 milhões — o exploit de P18 nunca alcançaria o
    limiar de US$ 25 milhões e ficaria HIGH/MEDIUM em vez de CRITICAL. Corrigido reordenando a
    alternância do token mais longo/específico pro mais curto (`million|milhoes|milhao|billion|
    bilhoes|bilhao|mil|k|m|b`), respeitando as relações de prefixo. Comentário no código documenta o
    porquê. Reporto isso porque muda o comportamento do código do documento, não é uma escolha minha.
  - Depende de: nada tecnicamente (Bloco B reduz a dependência do piso ser a única defesa, mas não é
    pré-requisito de código).
  - Verificação feita: `python -m pytest tests/test_radar_news_v1.py` — **40/40 verdes**, incluindo
    P14, P15, P16, P17, P18 e P19 (piso nunca rebaixa) como testes permanentes via
    `_merge_classifications`, mais um teste de regressão dedicado pro bug do regex
    (`test_bloco_c_maior_valor_usd_million_not_confused_with_mil`, cobrindo million/bilhao/k).
    Greps presentes: `piso_de_severidade` em `ai_classifier.py` e `eventos_graves.py`,
    `normalizar_event_key` em `ai_classifier.py`.
  - Prova exigida (pendente): nenhuma real-only — P14-P19 já rodam de ponta a ponta em Python puro
    (o piso não depende de API externa nem de banco). O que falta é só a ratificação do Fabrício
    sobre RT-01/RT-02/RT-03 antes de considerar os valores definitivos para produção.

**Pacote de evidências desta fase:** `eventos_graves.py` com valores do documento como placeholder
claramente marcado "pendente ratificação PO" (mais o bug de regex corrigido e documentado); P08-P10
cobertos por unit test (prova real contra banco pendente, mesma dependência de sempre); **P14-P19
verificados de ponta a ponta, sem pendência** — são os únicos deste plano que não dependem de API
externa nem de migration. `python -m pytest tests/test_radar_news_v1.py` → **40 passed**. Reviso com
você — e preciso da ratificação do Fabrício sobre RT-01/02/03 — antes de considerar esta fase fechada
de verdade (o código está pronto e testado, só os números/listas não são definitivos).

**Nota de correção sobre a Fase 1:** ao reabrir o arquivo para esta fase, encontrei que o `_call_gemini()`
real nunca tinha sido substituído — só o `classify()`/`__init__`/config do topo foram editados; o corpo
do método continuava com `GEMINI_URL`/`self.api_key` (ambos já removidos), o que quebraria em runtime
com `NameError`/`AttributeError`. Os testes de P02/P04 da Fase 1 não pegaram isso porque P02 nunca
chega a chamar `_call_gemini` (aborta antes) e P04 mockava o método inteiro (`patch.object`), então o
corpo real nunca rodava. Corrigido nesta sessão, antes de prosseguir: `_call_gemini` agora é o código
literal de A1, e revalidei com `patch('ai_classifier.requests.post', ...)` (mockando só a chamada de
rede, não o método) para garantir que o payload/headers/retry reais estão corretos — não só o
comportamento em torno dele.

---

## FASE 4 — 🔒 A5/A6/A7: coleta RSS robusta, fontes novas, configuração

- [x] **A5 (alta)** — Coleta RSS cega vira coleta com User-Agent, timeout e cabeçalho condicional —
      `monitor/rss_collector.py` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado.** `socket.setdefaulttimeout(20)`, `FEED_USER_AGENT`
    identificando o Radar News. `_fetch_single_feed()` usa `feedparser.parse(url, agent=...,
    etag=..., modified=...)`, cache de ETag/Last-Modified por feed (`self._cache`), trata HTTP 304
    como zero-entradas silencioso. `_registrar_saude()` nova: conta ciclos consecutivos sem entrada
    por feed (`self._vazios`); em 20 ciclos (1h) sem nenhuma entrada OU 20 falhas seguidas (exceção
    no fetch, ex. 403), `logger.error('[RSS] FONTE MUDA: ...')`. Chamada em `fetch_all_feeds()` tanto
    no caminho de sucesso quanto no `except` (403 conta como "zero entradas" pra saúde do feed).
  - Depende de: nada.
  - Verificação feita: `python -m pytest tests/test_radar_news_v1.py` — **43/43 verdes**, incluindo
    3 testes novos (`test_a5_*`) cobrindo P12 (19 ciclos sem entrada não alerta, o 20º sim, com nome
    do feed na mensagem) e o reset do contador quando o feed volta a responder.

- [~] **A6 (alta)** — 5 fontes RSS primárias novas para Regulação/Macro/Geopolítica —
      `monitor/rss_collector.py::RSS_FEEDS` (URLs validadas em 05/08/2026, **não wireadas ainda**)
  - Status: **validação feita, código NÃO alterado — aguardando decisão.** Rodei
    `curl -A "Mozilla/5.0 (compatible; GenesisRadarNews/1.1; +https://cripto.ico)" -IL` nas 5 URLs do
    documento:
    - SEC Press Releases → `200 OK` direto.
    - CFTC Press Releases → `200 OK` direto.
    - Federal Reserve → `200 OK` direto.
    - CoinDesk → `308` (redirect interno pro mesmo domínio) → `200 OK`. Funciona (feedparser segue
      redirect sozinho), só não é 200 na primeira resposta.
    - **Reuters Business → `301` para `https://reutersagency.com/feed/?best-topics=business-finance`
      → `404 Not Found`. Link morto de verdade**, não é só redirect — a URL do documento não existe
      mais no domínio da Reuters.
  - **Decisão que não é minha:** o próprio documento manda a fonte que não responder 200 voltar pro
    Fabrício em vez de entrar quebrada — é exatamente o caso da Reuters Business. Além disso, RT-05
    cobre o pacote inteiro das 5 fontes como proposta não ratificada, e adicionar fonte RSS é uma
    mudança operacional recorrente (o worker passa a bater nesses domínios a cada 3 minutos, para
    sempre) — não tratei isso como os placeholders do Bloco C (que são só lógica interna, sem efeito
    externo). Não editei `RSS_FEEDS` nesta fase.
  - Depende de: ratificação RT-05 + decisão sobre o substituto da Reuters Business (ou aceitar só 4
    das 5 fontes).
  - Prova exigida: ✅ resultado do `curl -IL` das 5 URLs (acima). Falta a ratificação para aplicar.

- [x] **A7 (média)** — Configuração e empacotamento (implementado em 05/08/2026)
  - Status: **código aplicado e verificado.**
    - `.env.example`: `TELEGRAM_TOKEN` → `TELEGRAM_BOT_TOKEN` (inclusive nas instruções); seção Gemini
      trocada para `GENESIS_AI_URL`/`GENESIS_AI_TOKEN`/`GEMINI_ANALYSIS_MODEL=gemini-3.6-flash`;
      removida a linha que dizia "Chama a API pública do Google direto" (contradizia o Aviso 2).
    - `.env` real (não versionado, protegido pelo `.gitignore` raiz) conferido **só pelos nomes de
      variável** (sem ler valores): já usa `TELEGRAM_BOT_TOKEN` corretamente; ainda não tem
      `GENESIS_AI_URL`/`GENESIS_AI_TOKEN` — mesma pendência já registrada (A1/P02/P03), não é uma
      regressão nova. Não editei o `.env` real.
    - **Decisão supervisor vs. pm2, tomada sem precisar te perguntar:** não achei nenhuma referência
      real a pm2 em lugar nenhum do repositório (só um comentário solto no docstring do worker,
      corrigido) — `genesis-monitor.conf` já usa Supervisor e é o único processo real do projeto.
      Criei `monitor/genesis-radar-news.conf` no mesmo padrão, supervisionando
      `worker_radar_news.py` com logs próprios (`genesis-radar-news.{out,err}.log`).
    - `monitor/.hypothesis/`, `__pycache__/` (raiz e `tests/`) confirmados **versionados no git**
      (41 arquivos) — `git rm -r --cached` rodado (arquivos continuam no disco, só saíram do índice)
      e `.gitignore` da raiz ganhou `__pycache__/`, `*.pyc`, `.pytest_cache/`, `.hypothesis/`.
      **Não commitei** — fica no working tree pra você revisar antes.
  - Depende de: nada.
  - Verificação feita: `git ls-files monitor | grep -E "pycache|pytest_cache|hypothesis"` → zero.
    `grep -c "TELEGRAM_TOKEN=" monitor/.env.example` → zero (só `TELEGRAM_BOT_TOKEN=` presente).
    `pytest` → 43/43 verdes (nada nesta fase toca código coberto por teste automatizado, além do que
    já estava verde).

**Pacote de evidências desta fase:** A5 e A7 fechados de verdade, sem pendência de ratificação. A6
**parcialmente bloqueada por um problema real** (Reuters Business morta) — não é só burocracia de
ratificação, é um link que não existe mais e precisa de decisão sua/do Fabrício antes de eu tocar em
`RSS_FEEDS`. Reviso com você antes de seguir pra Fase 5 (que já está avisada como bloqueada por
dependência externa — migrations do `genesis-api`).

---

## FASE 5 — 🔒 Bloco D: garantia de não reenvio (worker)

⚠️ **Bloqueada pela dependência externa** para prova real de ponta a ponta (`genesis_radar_dispatch`,
`genesis_radar_resumo`, coluna `supressao` não existem). Código Python implementado e coberto por
unit test com conexão mockada nesta sessão (05/08/2026) — 54/54 testes verdes.

- [x] **D1 (nova)** — Trava de despacho antes de qualquer envio —
      `monitor/worker_radar_news.py` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado.** `_ja_foi_ao_telegram(row, conn)`: checa `event_key` já
    enviado nas últimas 72h (id diferente) e similaridade de título
    (`DISPATCH_SIMILARITY_THRESHOLD = 88`) contra os títulos já enviados no mesmo período.
    **Fail-closed** confirmado por teste: erro na verificação → não envia (oposto do
    `_pode_disparar`). Integrado em `_drain_telegram_queue`, chamado logo depois de buscar a linha e
    antes da checagem de orçamento — identidade primeiro, orçamento depois.
  - Depende de: coluna `supressao` pra prova real (dependência externa); a lógica em si não depende
    de nada.
  - Verificação feita: `pytest` — 4 testes novos (event_key duplicado, título similar, fato novo
    passa, fail-closed em exceção). Grep presente: `_ja_foi_ao_telegram` em `worker_radar_news.py`.
  - Prova exigida (pendente): P20 real contra banco com a coluna `supressao`.

- [x] **D2 (nova)** — Idempotência de envio —
      `monitor/worker_radar_news.py`, `monitor/telegram_dispatcher.py` (implementado em 05/08/2026)
  - Status: **código aplicado, com uma tensão real do documento sinalizada, não resolvida por mim.**
    `_reservar_despacho(row, conn)`: `INSERT` em `genesis_radar_dispatch` com `dispatch_key` (SHA-256
    de `event_key`/`title_hash`/id + `'nivel1'`) **antes** do POST — código literal do documento.
    `telegram_dispatcher.send_news_alert()` mudou de `bool` pra `dict` (`{'status', 'message_id'}`)
    — **mudança necessária que o documento não deu código literal para**: sem isso não dava pra
    distinguir SENT/FAILED/UNCERTAIN. Implementei `_send_message_detailed()` nova: 200+`ok:true` →
    `SENT`; 400/403 → `FAILED`; timeout/erro de rede/qualquer outro status → `UNCERTAIN` (tratamento
    conservador pro que o documento não especificou explicitamente, ex. 429/5xx). `_drain_telegram_queue`
    atualiza `genesis_radar_dispatch` e `genesis_radar_news` conforme o desfecho.
  - **Tensão real encontrada no documento, não resolvida — precisa de decisão:** a prosa diz que
    `FAILED` deveria permitir reenvio "até 2 tentativas", mas o código literal dado pra
    `_reservar_despacho` (INSERT + bloqueio por `IntegrityError`) bloqueia QUALQUER nova tentativa pra
    sempre, porque a `dispatch_key` já existe na tabela — o INSERT nunca mais terá sucesso pra essa
    chave. Implementei o código literal (simples), documentei a tensão no docstring do método, e não
    inventei uma solução (ex.: fazer `_reservar_despacho` checar o status existente e fazer `UPDATE`
    de volta pra `PENDING` se `FAILED` com `attempts < 2`) porque isso seria eu decidindo um mecanismo
    que o documento não especificou, sobre uma tabela que nem existe ainda pra eu poder testar contra
    o Telegram de verdade. Fica pra quando a tabela existir e puder ser decidido com base em
    comportamento real observado.
  - Depende de: tabela `genesis_radar_dispatch` (dependência externa, bloqueante total pra prova
    real).
  - Verificação feita: `pytest` — 2 testes novos (reserva com sucesso grava `_dispatch_key`; reserva
    já existente bloqueia via `IntegrityError`). Grep presente: `_reservar_despacho` em
    `worker_radar_news.py`.
  - Prova exigida (pendente): P21 real (matar processo entre `INSERT` e POST, reiniciar).

- [x] **D3 (nova)** — Resumo diário sem fato repetido —
      `monitor/worker_radar_news.py::_run_resumo_diario()` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado, sem pendência de dependência externa** — usa só colunas
    que já existem (`event_key`, `title_hash`, `impact_score`, `nivel`, `created_at`).
    `ROW_NUMBER() OVER (PARTITION BY COALESCE(event_key, title_hash) ORDER BY impact_score DESC,
    created_at DESC)`, `WHERE rn = 1`, ordenado por `impact_score DESC`.
  - **Gap do documento corrigido:** a query do documento referencia `t.severity_ord` como se fosse
    uma coluna existente — não é, `severity` é `ENUM` de texto. Adicionei
    `CASE n.severity WHEN 'CRITICAL' THEN 3 ... END AS severity_ord` na subquery pra a ordenação
    funcionar (sem isso o SQL literal daria "unknown column").
  - `_limites_dia_brt()` novo (`@staticmethod`): início/fim do dia em horário de Brasília, convertidos
    pra UTC (nunca `CURDATE()`, que compararia contra o relógio do servidor MySQL).
  - Depende de: nada. Fechado de verdade.
  - Verificação feita: `pytest` — teste confirma `ROW_NUMBER()`/`PARTITION BY`/`severity_ord` no
    código-fonte e ausência de `CURDATE()`; teste separado confirma que meia-noite BRT vira 03:00 UTC
    e a janela tem exatamente 24h.

- [x] **D4 (nova)** — Resumo diário idempotente —
      `monitor/worker_radar_news.py` (implementado em 05/08/2026)
  - Status: **código aplicado, com uma limitação de desenho do documento sinalizada.**
    `self._last_resumo_date` deixou de ser a garantia — virou só otimização local (evita bater no
    banco a cada `QUEUE_DRAIN_TICK_SECONDS` pelo resto da noite). A garantia de verdade é
    `_reservar_resumo_do_dia()`: `INSERT` em `genesis_radar_resumo` **antes** de montar/enviar;
    `IntegrityError` → já saiu hoje, não reenvia (F09). `_run_resumo_diario()` agora devolve `bool`
    pra `_maybe_send_resumo_diario` saber se pode atualizar o cache local.
  - **Limitação encontrada, não resolvida — é do desenho do documento, não peguei nada errado no meu
    código:** diferente do D2 (que tem coluna `status` em `genesis_radar_dispatch`), a tabela
    `genesis_radar_resumo` do documento só tem `data_ref`/`enviado_em`/`itens` — sem status. Isso
    significa que se a reserva do dia for feita com sucesso mas o envio ao Telegram falhar logo
    depois, **não existe segunda tentativa**: a linha do dia já existe, qualquer nova tentativa esbarra
    no mesmo `IntegrityError`. É uma troca deliberada (favorece nunca duplicar o resumo em vez de
    garantir que ele sempre saia), mas é uma troca do documento, não uma escolha meu.
  - Depende de: tabela `genesis_radar_resumo` (dependência externa, bloqueante total pra prova real).
  - Verificação feita: `pytest` — reserva com sucesso e reserva bloqueada por `IntegrityError`; teste
    confirma que `_run_resumo_diario` chama `_reservar_resumo_do_dia` (F09 não fica só na memória).
  - Prova exigida (pendente): P23 real (reiniciar às 20h30 depois do resumo já enviado).

**Pacote de evidências desta fase:** `python -m pytest tests/test_radar_news_v1.py` → **54 passed**
(11 novos: 4 de D1, 2 de D2, 2 de D3, 3 de D4). **D3 fechado de verdade, sem pendência.** D1/D2/D4 têm
código pronto e testado por mock, prova real pendente das migrations do `genesis-api`. **Duas tensões
reais do próprio documento ficaram registradas e não resolvidas por mim** (D2: retry de FAILED
inviável com o código literal dado; D4: sem segunda tentativa se o envio falhar após a reserva) —
precisam de decisão sua/do Fabrício, não são bugs meus para simplesmente corrigir. Reviso com você
antes de seguir pra Fase 6.

---

## FASE 6 — 🔒 Bloco E: roteamento e orçamento

- [x] **E1 (RT-06 pendente ratificação)** — Categorias 3, 4 e 10 precisam alcançar o Telegram —
      `monitor/ai_classifier.py::calcular_nivel()` (implementado em 05/08/2026)
  - Status: **código aplicado e verificado, sem pendência de dependência externa.** Removido
    `mercado_inteiro = e.get('categoria') in CATEGORIAS_MERCADO_INTEIRO or 'BTC' in
    e.get('affected_assets', [])`. Novo: `ATIVOS_SISTEMICOS =
    {'BTC','ETH','USDT','USDC','DAI','USDE','PYUSD','FDUSD'}`, `CATEGORIAS_SISTEMICAS =
    (2,3,4,5,6,10)` (marcadas RT-06 pendente ratificação, no comentário do código); `sistemico` passa
    a valer por categoria OU por ativo sistêmico afetado, não só BTC/categoria 5-6. `CATEGORIAS_
    MERCADO_INTEIRO` mantida no arquivo só como referência histórica (não usada mais em nenhum lugar).
  - Depende de: ratificação RT-06 antes de considerar os valores definitivos; a mecânica em si não
    depende de nada e já roda de ponta a ponta (não usa nenhuma coluna nova).
  - Verificação feita: `pytest` — 4 testes novos: stablecoin categoria 10 sem tocar carteira agora
    dispara Nível 1; regulação categoria 3 idem; categoria 1 (não-sistêmica) sem tocar carteira
    continua caindo pra Nível 2 (funil não afrouxou); ETH sistêmico dispara mesmo em categoria não
    listada como sistêmica. Testes antigos de C4 (macro categoria 5) continuam verdes sem alteração.

- [x] **E2 (RT-07 pendente ratificação)** — Rebaixamento deixa de ser sentença, fila por relevância —
      `monitor/worker_radar_news.py::_drain_telegram_queue()`, `_pode_disparar()`
      (implementado em 05/08/2026)
  - Status: **código aplicado e verificado por mock; prova real de ponta a ponta pendente da coluna.**
    Fila passa a ordenar por `(severity='CRITICAL') DESC, impact_score DESC, created_at DESC` (não
    mais só `created_at ASC`), com janela `created_at >= NOW() - INTERVAL 6 HOUR`
    (`JANELA_UTIL_HORAS`, RT-07 pendente) e filtro `adiado_ate IS NULL OR adiado_ate <= NOW()`.
    Rebaixamento a Nível 2 (`supressao='ORCAMENTO_EXPIRADO'`) só depois de 6h de idade; antes disso,
    `adiado_ate = NOW() + INTERVAL 45 MINUTE` (`ADIAMENTO_MINUTOS`, RT-07 pendente) em vez de
    `UPDATE nivel = 2` direto. `_pode_disparar()`: as duas queries de orçamento (hora/dia) agora
    contam por `telegram_sent_at`, não `created_at` — sem isso, uma notícia que ficou na fila/adiada
    e só foi enviada horas depois de criada nunca contaria pro teto da hora em que de fato foi
    disparada. `except` que devolve `True` ganhou log explícito ("liberando por segurança") — fail-open
    documentado, deliberadamente o oposto do fail-closed de `_ja_foi_ao_telegram` (D1).
  - Depende de: coluna `adiado_ate` (dependência externa, bloqueia a query de fila e o `UPDATE` de
    adiamento pra rodar contra banco real) + ratificação RT-07 (valores de 6h/45min).
  - Verificação feita: `pytest` — 2 testes de inspeção de código (fila usa `impact_score DESC` e
    `JANELA_UTIL_HORAS`/`adiado_ate`, sem mais `created_at ASC LIMIT 1`; `_pode_disparar` usa
    `telegram_sent_at` e loga "liberando por segurança") + 2 testes de integração com conexão mockada
    isolando `_ja_foi_ao_telegram`/`_pode_disparar`: notícia recente (10min) que esbarra no orçamento
    recebe `adiado_ate`, não é rebaixada; notícia velha (7h, fora da janela) é rebaixada com
    `ORCAMENTO_EXPIRADO`, sem `adiado_ate`. `python -m pytest tests/test_radar_news_v1.py` →
    **62/62 verdes**. Grep presente: `adiado_ate` em `worker_radar_news.py`.
  - Prova exigida (pendente): P22 real contra banco com a coluna `adiado_ate` existindo.

**Pacote de evidências desta fase:** E1 fechado de verdade, sem pendência de banco (só falta a
ratificação RT-06 pra ser definitivo). E2 tem a mecânica toda coberta por teste (incluindo os dois
ramos de idade, que é o coração da correção), mas a prova real de ponta a ponta (P22) só roda quando
`adiado_ate` existir no banco. `python -m pytest tests/test_radar_news_v1.py` → **62 passed**. Reviso
com você antes de seguir pra Fase 7.

---

## FASE 7 — 🔒 Bloco F: deleções obrigatórias (limpeza, um commit por item)

Aplicado como consequência natural das fases anteriores — listado à parte porque o documento exige
verificação explícita de cada remoção, não só "deixou de ser usado".

Implementado em 05/08/2026. **65 → 68 testes verdes ao longo da fase.**

- [x] **F01-F05** — já cobertos por A1 (GEMINI_URL), A3 (dedup por source, similaridade sobre
      titulo_pt, checagem de title_hash em persist), A4 (janela em Python na checagem de event_key).
      Confirmado nos greps de fechamento (seção abaixo) — sem tarefa adicional.
- [x] **F06** — `e['impact_summary'] = impacto_pt` removido de `_merge_classifications`; fica só
      `impacto_pt` no dict em memória. `persist_classified` simplificado pra `entry.get('impacto_pt')`
      sem fallback. `telegram_dispatcher.py`: removido o `entry.get('impacto_pt') or` morto (nunca
      executava — `send_news_alert` sempre recebe uma linha CRUA do banco, que nunca tem a chave
      `impacto_pt`, só `impact_summary`).
  - **Tensão real encontrada, não resolvida por mim:** a Seção 11 do documento exige
    `grep -rn "impact_summary" monitor/` → **zero**, mas a coluna do banco se chama literalmente
    `impact_summary` (migration original, fora do escopo desta pasta) e o SQL/leituras precisam
    referenciá-la pelo nome real pra funcionar. Satisfazer esse grep exigiria uma migration
    renomeando a coluna — que este documento não dá (a seção de migrations, 9.2, não toca nisso) e
    que está fora do escopo de `monitor/`. Fiz a parte que cabe aqui (zero *duplicação* do dado —
    `impacto_pt` é a única fonte em memória) e documentei a tensão no código. O grep de
    `impact_summary` continua não-zero nos 3 arquivos por essa razão — não é uma pendência que
    deixei passar.
  - Verificação feita: `pytest` — teste confirma que o dict de `_merge_classifications` não tem mais
    a chave `impact_summary`.
- [x] **F07** — Coluna `category` (texto) parou de ser gravada em `persist_classified` (saiu da
      lista de colunas do `INSERT` e dos `params`, contagem de `%s` reconferida). O rótulo sai só de
      `CATEGORIAS_NOMES[categoria]` na hora de formatar mensagem/resumo.
  - **Gap real encontrado e corrigido:** `worker_radar_news.py::_formatar_resumo_diario` e
    `_gerar_conclusao_do_dia` liam **só** `item.get('category')` (o texto legado), nunca derivavam de
    `categoria` (número) — diferente de `telegram_dispatcher.py`, que já fazia isso certo. Sem essa
    correção, toda linha nova (sem `category` persistido) apareceria como "Radar News" genérico no
    resumo diário e na conclusão do dia. Criei `RadarNewsWorker._categoria_nome()` (mesmo padrão do
    `telegram_dispatcher.py`: `CATEGORIAS_NOMES.get(categoria) or category or 'Radar News'`) e troquei
    as duas leituras por ela.
  - Verificação feita: `pytest` — teste confirma ausência de `category,`/`category_label` no INSERT;
    teste confirma que `_categoria_nome` deriva certo tanto pra linha nova (`categoria` preenchida)
    quanto pra linha legada (só `category` preenchido, de antes desta correção).
- [x] **F08** — já coberto por A7 (`.env.example`).
- [x] **F09** — já coberto por D4.
- [x] **F10** — já coberto por A7 (`.gitignore` + `git rm --cached`).
- [x] **F11 (verificação, não deleção)** — `grep -n "monitor_worker" worker_radar_news.py
      ai_classifier.py rss_collector.py telegram_dispatcher.py eventos_graves.py` → zero. Radar News
      não importa nem chama nada do worker de derivativos.

**Pacote de evidências desta fase:** greps da seção 11 rodados por completo — todos os "devem
devolver ZERO" limpos (`generativelanguage`, `translate.googleapis.com`, `source = %s`, `hours=3`,
`discovery_score`/`send_discovery_alert`, `threading.Timer`, `monitor_worker`); todos os "devem
devolver PRESENTE" confirmados (`GENESIS_AI_URL`, `gemini-3.6-flash`, `normalizar_event_key`,
`piso_de_severidade`, `_ja_foi_ao_telegram`, `_reservar_despacho`, `GATILHOS_POR_CATEGORIA`,
`adiado_ate`). Única exceção documentada: `impact_summary` não zera, pela razão explicada em F06.
`pytest` → 68 passed.

---

## FASE 8 — 🔒 Bloco G: telemetria

Implementado em 05/08/2026 como contador em memória + log estruturado por ciclo, com tentativa de
`INSERT` best-effort em `genesis_radar_telemetria` — decisão tomada sem bloquear em você: útil ter
visibilidade via log mesmo antes da migration existir, e o código já fica pronto pra gravar de
verdade assim que ela existir, sem precisar de outra sessão de trabalho.

- [x] **Bloco G** — `monitor/rss_collector.py`: `self.telemetria` (dict, resetado a cada
      `fetch_all_feeds()`) com `coletadas`, `cortadas_frescor`, `cortadas_sem_data` (contados por
      entrada, distinguindo "sem data" de "velha demais" dentro de `_fetch_single_feed`), e
      `cortadas_hash`/`cortadas_similaridade` (contados em `deduplicate`). `monitor/ai_classifier.py`:
      `self._telemetria` (já existia da Fase 1, estendido) resetado a cada `classify()`, com
      `enviadas_ao_modelo`, `lotes_falhos`, `perdidas_classificacao`, `acionaveis`, `piso_aplicado`,
      `cortadas_event_key` (persist_classified, na colisão de event_key), `nivel_1/2/3` (em
      `_merge_classifications`). `monitor/worker_radar_news.py`: `self._telemetria_dispatch`
      (`disparadas`, `suprimidas_orcamento`, `suprimidas_duplicidade`, incrementados em
      `_drain_telegram_queue`) + `feeds_mudos` (nomes com `_vazios >= CICLOS_SEM_ENTRADA_PARA_ALERTA`).
  - Novo `RadarNewsWorker._registrar_telemetria_do_ciclo()`: junta os três dicts num só registro,
    **sempre loga um resumo estruturado** (`[Telemetria] {...}`) e tenta o `INSERT` em
    `genesis_radar_telemetria`; falha do `INSERT` (tabela ainda não existe) vira `DEBUG`, não quebra
    o ciclo. Chamado num `finally` em `_run_rss_cycle()` — roda mesmo quando o ciclo não coleta nada
    novo ou dá erro, que é exatamente o cenário ("por que o Radar não trouxe nada hoje") que o
    documento cita como motivação do bloco.
  - Depende de: tabela `genesis_radar_telemetria` pra persistir de verdade (dependência externa) —
    mas a visibilidade via log já funciona sem ela.
  - Verificação feita: `pytest` — confirma que a ausência da tabela não derruba o ciclo (log emitido,
    janela de despacho reseta pro próximo ciclo mesmo assim); confirma que `_run_rss_cycle` chama a
    telemetria mesmo com 0 entradas (via `finally`); confirma contagem de `nivel_1`/`nivel_3`/
    `acionaveis` num lote misto CRITICAL+LOW.
  - Prova exigida (pendente): consulta real em `genesis_radar_telemetria` — só possível quando a
    tabela existir.

---

## Provas de aceite — mapeamento por fase (referência rápida)

| Prova | Fase | Bloqueada por dependência externa? |
|---|---|---|
| P01-P04 | 1 | Não |
| P05-P07 | 1 | Parcial (coluna `title_original` para prova real completa de P07) |
| P08-P10 | 3 | Não |
| P11 | já coberta (C1, comportamento existente, sem mudança) | — |
| P12 | 4 | Não |
| P13 | 2 | Não |
| P14-P19 | 3 (piso) + 6 (nível) | Não |
| P20 | 5 | Sim (coluna `supressao`) |
| P21 | 5 | Sim (`genesis_radar_dispatch`) |
| P22 | 6 | Sim (coluna `adiado_ate`) |
| P23 | 5 | Sim (`genesis_radar_resumo`) |
| P24 | 5 | Não |

## Greps obrigatórios (seção 11 do documento) — todos rodáveis dentro de `monitor/`

```bash
# Devem devolver ZERO
grep -rn "generativelanguage.googleapis.com" monitor/
grep -rn "translate.googleapis.com"          monitor/
grep -rn "source = %s"                       monitor/rss_collector.py
grep -rn "impact_summary"                    monitor/
grep -rn "threading.Timer"                   monitor/

# Devem devolver PRESENTE
grep -rn "GENESIS_AI_URL"         monitor/ai_classifier.py
grep -rn "gemini-3.6-flash"       monitor/.env.example
grep -rn "normalizar_event_key"   monitor/ai_classifier.py
grep -rn "piso_de_severidade"     monitor/ai_classifier.py monitor/eventos_graves.py
grep -rn "_ja_foi_ao_telegram"    monitor/worker_radar_news.py
grep -rn "_reservar_despacho"     monitor/worker_radar_news.py
grep -rn "GATILHOS_POR_CATEGORIA" monitor/ai_classifier.py
grep -rn "adiado_ate"             monitor/worker_radar_news.py
```

(`hours=3`, `discovery_score\|send_discovery_alert` já retornam zero hoje — confirmar de novo no
fechamento, sem tarefa de código associada.)
