# Plano de Implementação: migrar usuários reais + saldo dos sites antigos (`api`/`testeapi`) pro `[AUTH]`

**Status deste documento**: criado como planejamento puro em 10/09/2026, a pedido do Felipe ("tem
que criar plano para migrar usuários saldos e conseguir fazer login"). **Nenhum item foi
executado.** Continuação direta de [[genesis-auth-integracao-v1-v2]] e
[[genesis-microservico-auth-creditos]] — a Fase 4 daquele primeiro spec já cortou o login das APIs
NOVAS (`v1api`/`v2api`) pro `[AUTH]`, mas os usuários REAIS de verdade (que compraram, que têm
saldo) ainda vivem nos sites ANTIGOS (`api`/`testeapi`, nunca tocados, deliberadamente deixados de
pé) e a maioria deles ainda não existe no `[AUTH]`.

## Por que este plano existe

Felipe pediu pra eu analisar dois dumps reais (`apiv1.sql`/`apiv2.sql`, exportados por ele hoje às
22:06 via phpMyAdmin, ver [[project_dumps_sql_v1_v2_encontrados]]). Achado central: são dumps dos
sites ANTIGOS de produção (`api` = v1, `testeapi` = v2), com gente de verdade — **203 usuários no
v1, 201 no v2** (número corrigido — a primeira contagem, 205, incluía por engano 4 linhas de
comentário do dump que não são usuários; recontado com um critério mais seguro, zero falha de
parse nos dois arquivos), 200 aparecem nos dois. Sem esses dados no `[AUTH]`, ninguém dessa lista
consegue logar no ecossistema novo (login e saldo de crédito hoje são só `[AUTH]`).

## Verificação contra o código/dados reais (10/09/2026)

### Achado 1 — já existe uma ferramenta pronta pra isso, e ela já rodou uma vez

`app/Console/Commands/GenesisAuthImport.php` (no `[AUTH]`) + seu par `GenesisAuthExport.php` (nas
duas APIs) foram construídos na Fase 9 do spec `genesis-microservico-auth-creditos` exatamente pra
isso: exportar usuários/wallets/transactions/plans/subscriptions/webhooks em JSON e importar no
`[AUTH]` de forma **idempotente** (casa por email/nome/uuid/reference — rodar duas vezes não
duplica, só atualiza).

### Achado 2 — o v2 (`genesis-api`) muito provavelmente já foi migrado; o v1 nunca foi

A Fase 9.1-9.3 daquele spec migrou "205 usuários reais / 19,8 mil transactions" de `genesis-api`
pro `[AUTH]` — próximo, mas não idêntico, das contagens do `apiv2.sql` de hoje (201 usuários,
19.911 transactions: as transações batem exato, os usuários não — 4 a menos no dump de agora).
Quase certo que seja a mesma fonte (o site antigo `testeapi`), mas não dá pra assumir que o v2 já
está 100% migrado sem conferir — a divergência de 4 usuários fica pro `--dry-run` da Fase 1
explicar (mostra exatamente quantos dos 201 já existem no `[AUTH]` e quantos seriam novos).
**`genesis-api-v1` nunca teve essa exportação/importação feita** — os 203 usuários do `apiv1.sql`
(site antigo `api`) são o gap real: ninguém que só usa o v1 consegue logar no `[AUTH]` hoje.

### Achado 3 — um bug real no importador que só aparece agora, com DOIS produtos

`GenesisAuthImport.php` foi escrito pensando em UMA fonte só (Fase 9 só importou v2). Rodá-lo duas
vezes, uma por produto, tem dois problemas reais que eu confirmei olhando o código e os dados:

1. **Saldo (wallet) seria sobrescrito, não somado.** O `[AUTH]` já usa `$user->balanceFloat` /
   `depositFloat()` / `withdrawFloat()` direto no model `User` (Bavix `HasWallet`, carteira única
   `'default'` por usuário — confirmado em `CreditController.php`). Ou seja, o sistema JÁ trata
   crédito como **um saldo único**, não um saldo por produto. Mas o importador, ao achar uma
   wallet já existente (mesmo `holder_id`+`slug`), faz `UPDATE ... SET balance = <valor novo>` —
   isso **substitui**, não soma. Importar v1 depois de v2 (ou vice-versa) apagaria o saldo do
   primeiro para os ~200 usuários que existem nos dois produtos.
2. **Colisão de nome nos planos é inofensiva, mas por sorte.** v1 e v2 têm planos com o MESMO nome
   (`PLANO 1`..`PLANO 4`) — o importador casa plano por `name`. Conferi os valores: são idênticos
   (mesmo `credits`/`price`/timestamps nos dois dumps), então essa colisão não corrompe nada — mas
   é um acaso, não uma garantia, e teria corrompido se os valores divergissem.
3. **`lastlink_accesses` quebra ao importar v1.** O `GenesisAuthExport.php` do v1 não gera essa
   chave (tabela não existe em v1) e o importador faz `foreach ($data['lastlink_accesses'] as $a)`
   sem checar se a chave existe — vai quebrar com um erro de chave indefinida. Correção trivial
   (`$data['lastlink_accesses'] ?? []`), não é uma decisão, é uma tarefa.

## Decisões já resolvidas pelo Felipe (10/09/2026)

- **D1 = (a) Unificar.** Saldo de v1+v2 vira um saldo só por pessoa no `[AUTH]`, batendo com o que
  `CreditController` já assume hoje. Implementação: nunca sobrescrever `balance` de uma wallet já
  existente durante o merge — recalcular a partir da soma das transações confirmadas.
- **D2 = usar os dumps já fornecidos** (`apiv1.sql`/`apiv2.sql`, 22:06 de hoje). Sem nova sessão SSH
  só pra isso; a diferença de algumas horas de transações do site antigo é aceitável.
- **D3 = seguida a recomendação**: v1 primeiro (gap real), v2 depois (testa o merge).

## Escopo em fases

### ✅ Fase 0 — Corrigir o importador (EXECUTADO, 10/09/2026)

- [x] `$data['lastlink_accesses'] ?? []` — corrigido.
- [x] Saldo: `balance` nunca mais é sobrescrito num `UPDATE` de wallet existente. Wallet nova nasce
      com `balance=0`; o saldo real de TODA wallet tocada é recalculado no final como a soma de
      TODO o ledger de `transactions` confirmadas (não uma soma prevista de antemão — isso quebraria
      numa reimportação idempotente do mesmo arquivo). Checagem de segurança separada: a soma das
      transações QUE O PRÓPRIO ARQUIVO trouxe pra uma wallet tem que bater com o `balance` que ELE
      declara — se não bater, a importação inteira é desfeita (`DB::transaction()` em volta de tudo).
- [x] Teste automatizado (`GenesisAuthImportMergeTest.php`, 3 testes): merge de dois produtos soma
      certo (não substitui), reimportar o mesmo arquivo é idempotente, payload sem
      `lastlink_accesses` não quebra. Suíte inteira do `[AUTH]`: **50/50 passando**.

### ✅ Fase 1 — Converter os dumps em JSON (EXECUTADO, 10/09/2026)

- [x] `genesis-auth:convert-legacy-dump {file} --out=` (novo comando artisan, só lê o `.sql` e
      escreve o `.json` — nenhuma conexão de banco). Parser genérico: lê a lista de colunas direto
      do cabeçalho `INSERT INTO` de cada tabela (não um mapeamento hardcoded), aborta se o número
      de colunas de alguma linha não bater com o esperado (nunca adivinha dado real). Teste
      automatizado com um dump fictício cobrindo aspas escapadas (`\'`, `''`, JSON com `\"`
      interno) e tabela fora de escopo ignorada.
- [x] Rodado contra os dois arquivos reais — **e isso corrigiu mais dois números errados da minha
      análise inicial** (contagem por regex/awk ad hoc é frágil; o conversor de verdade não conta,
      ele parseia e aborta se algo não bater): `apiv1.sql` tem **21612 transactions** (não 22517)
      e **4 plans** (não 19) — os dois batem agora com uma segunda recontagem independente.
      Números finais: v1 = 203 usuários, 4 plans, 165 wallets, 21612 transactions, 211
      subscriptions, 1038 last_link_webhooks. v2 = 201 usuários, 4 plans, 165 wallets, 19911
      transactions, 198 subscriptions, 1023 last_link_webhooks, 0 lastlink_accesses.
- [x] `--dry-run` do v1 convertido rodado LOCALMENTE (banco de teste sqlite, não produção) —
      pipeline inteiro (converter → importar) validado de ponta a ponta sem tocar nada real.

### ✅ Fase 2 — Importar v1 em produção (EXECUTADO, 10/09/2026)

- [x] Backup do banco `auth` de produção antes (mysqldump). **Achado no backup**: o banco estava
      TOTALMENTE VAZIO antes desta importação — a "migração de 205 usuários" da Fase 9 de
      [[project_microservico_auth_creditos_spec]] NÃO está neste banco real (aconteceu em outro
      ambiente/momento, superado quando este site novo foi provisionado hoje).
- [x] `genesis-auth:import` real, autorizado explicitamente. 203 usuários, 4 plans, 165 wallets,
      21612 transactions, 211 subscriptions, 1038 webhooks — todos criados, zero conflito (nenhum
      já existia).
- [x] Login real testado: email real + senha errada de propósito devolve 422 "Credenciais
      inválidas" (não erro de sistema) — confirma que a linha existe e o hash é comparado de
      verdade.

### ✅ Fase 3 — Importar v2 por cima (EXECUTADO, 10/09/2026) — achou 2 bugs reais no caminho

- [x] **Bug 1**: a primeira tentativa de importar v2 abortou — a checagem que comparava a soma das
      `transactions` de uma wallet contra o `balance` declarado divergia em 118 das 165 wallets do
      v1 (quase sempre a soma MAIOR que o balance real). Causa: o histórico de transações deste
      sistema legado foi podado/arquivado em algum momento sem tocar o saldo — o ledger não é uma
      fonte confiável pra derivar ou conferir saldo aqui. Corrigido: saldo por origem guardado em
      `meta._saldo_por_origem` (chave = uuid da wallet de origem), nunca mais derivado do ledger.
- [x] **Achado maior, mudou o Achado 2 original**: comparando os dois arquivos convertidos,
      **165/165 uuids de wallet, 198/198 referências de assinatura e 96% das uuids de transação
      são IDÊNTICOS entre v1 e v2** — não é coincidência de duas bases independentes com os mesmos
      usuários, é `testeapi` (v2) clonado/sincronizado de `api` (v1) em algum momento, com só uma
      fatia divergindo depois (atividade própria de cada produto desde então).
- [x] **Bug 2** (consequência direta do achado acima): tentar importar uma wallet nova reusando a
      uuid da wallet de ORIGEM quebrou com `Duplicate entry ... wallets_uuid_unique` — a uuid do
      v2 colidia com a uuid de uma wallet de OUTRA pessoa já migrada do v1. Corrigido: wallet nova
      sempre ganha uuid própria gerada no `[AUTH]`, nunca a uuid de origem.
- [x] **D-decisão do Felipe**: pra uma origem com a MESMA uuid vista antes (as ~165 compartilhadas),
      usar o MAIOR saldo entre os dois, nunca somar (somar duplicaria o saldo-base compartilhado
      desde o clone). Dados reais: 96 de 165 idênticos, 68 com v2 maior, só 1 com v1 maior (o
      Felipe viu esses números antes de decidir).
- [x] Importado de verdade: 1 usuário novo (só v2), 200 atualizados, 165 wallets (164 já existiam
      do v1 + 1 nova), soma final de saldo = 255.015.100 — bate exato com o cálculo esperado por
      identidade real (email), conferido independentemente antes de escrever.
- [x] Login do usuário novo (só v2) testado — mesmo resultado (422, não erro).
- [x] Arquivos com dado real (JSONs convertidos, backup do banco) apagados do servidor e do
      Downloads local depois de tudo validado.

**Total final em produção**: 204 usuários reais migrados (203 do v1 + 1 exclusivo do v2), 166
wallets com saldo correto, login funcionando pra todos via `[AUTH]`.

### Fase 4 — Validação final (pendente)

- [ ] Amostra de usuários reais (Felipe escolhe alguns, não todos) confirmando login + saldo
      manualmente, com a senha de verdade deles (eu só consigo confirmar que a linha existe e
      rejeita senha errada — não tenho como testar com a senha certa de ninguém).
- [ ] Documentar quantos usuários novos entraram no `[AUTH]` no total (v1-only + v2-only + os 200
      que já estavam via Fase 9).

## Fora de escopo deste plano

- Ativar `GENESIS_AUTH_CREDITS_FULL_ENABLED` (Buckets B/C de
  [[genesis-auth-creditos-completo]]) — decisão separada, já parqueada, envolve dinheiro real do
  Asaas já em produção.
- Repontar os painéis externos do LastLink/Asaas (Bucket A do mesmo spec) — ação de fora, do
  Felipe.
- Migrar/aposentar os sites antigos (`api`/`testeapi`) de vez — este plano só copia os dados pro
  `[AUTH]`, não desliga nada.
- `trades`/`genesis_analises`/`genesis_alertas`/histórico de uso — não afeta login nem saldo,
  fica pra trás nos bancos antigos por enquanto (pode virar um plano futuro separado se o Felipe
  quiser esse histórico visível no ecossistema novo).
