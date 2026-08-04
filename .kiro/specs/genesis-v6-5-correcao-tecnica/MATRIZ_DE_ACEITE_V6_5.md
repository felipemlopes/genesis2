# Matriz de Aceite — Gênesis V6.5 (preenchida)

Fase 11.1/11.2/11.4 do plano de implementação. Preenchida em 31/07/2026, revisando cada uma das
76 linhas da Matriz de Aceite original do documento contra o estado real do código, dos testes e
dos arquivos de prova em ambos os repositórios — não uma cópia do que cada fase já tinha reportado.

**Convenção de status** (a coluna "Bloqueante" é do documento original; "Status real" é o resultado
desta auditoria):

- **REAL** — prova de rede real, comando real, ou verificação manual real (não simulação, não teste
  automatizado sozinho).
- **TESTE** — teste automatizado passando (muitos com dados reais da Binance, nunca mock de mercado)
  que prova a correção do código, mas **não** é o "print"/"log de análise real" que o documento pede
  literalmente como prova de aceite.
- **PARCIAL** — parte do item tem prova real, parte fica pendente (geralmente por exigir crédito
  Gemini real, credencial que não existe neste ambiente, ou acesso a serviço externo).
- **ESCOPO FECHADO** — decisão final do usuário de não completar o item como o documento pede;
  não é mais uma pendência em aberto, é um limite de entrega aceito.
- **NÃO APLICADO** — item deliberadamente não implementado por risco de regressão, decisão registrada.

`[API]` = `E:\Programas\wamp64\www\genesis-api\provas\`. `[FE]` = raiz deste repo, `provas\`.

---

## Bloco A: Segurança

| ID | Prova (arquivo real) | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| A00 | `a00-env.txt`, `a00-routes.json`, `a00-routes-analises.txt`, `a00-schedule.txt`, `a00-testes.txt`, `a00-composer-audit.json` [API]; `a00-npm-audit.json` [FE] | sim | **REAL** — 6 comandos de diagnóstico rodados de verdade antes do primeiro código tocado. |
| A01-A03 | `phpunit-idor.txt` [API] | sim | **TESTE** — 5 testes reais (`AnaliseIdorTest`), 2 usuários. Nota: os 2 endpoints por dono usam `404`, não `403` como o documento pede — decisão de segurança (404 não revela a existência do recurso de outro usuário), já registrada, não um erro. |
| A04 | `a04-dump-removido.txt` [API] | sim | **ESCOPO FECHADO** — dump de 27MB com hashes de senha/tokens confirmado no histórico do Git. `.gitignore` previne recorrência. Reescrita de histórico e revogação de `personal_access_tokens`: **decisão final do usuário de não fazer** (31/07/2026). Item permanece parcial de forma permanente. |
| A05 | `a05-cors.txt` [FE] | sim | **REAL** — servidor real subido, origem não cadastrada bloqueada, origem cadastrada liberada. `CORS_ORIGINS` ainda com valor de desenvolvimento — domínio real de produção pendente de você antes do deploy. |
| A06 | `a06-limites.txt` [FE] | sim | **REAL** — servidor real subido, corpo de ~1MB rejeitado (413), rate limit confirmado (11ª/12ª requisição = 429). |

**Bloco A: 4 de 5 linhas bloqueantes com prova real ou testada; A04 fechado com gap permanente por decisão sua.**

---

## Bloco B: Fatos e matemática

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| B01 | `b01-divergencia.txt` [API] | sim | **PARCIAL** — 4 testes sintéticos reais (RSI). Prova de viés real (40 análises antes + 40 depois, ~80 análises de crédito Gemini) **não produzida** — exige crédito real, só você pode autorizar/executar. |
| B02 | `b02-adx.txt` [API] | não | **TESTE**. |
| B03 | `b03-ausencia.txt` [API] | sim | **TESTE**. |
| B04 | `b04-wyckoff.txt` [API] | sim | **TESTE**. |
| B05 | `b05-vwap.txt` [API] | não | **PARCIAL** — prova sintética determinística real. Comparação ao vivo com o TradingView (desvio <0,3%) **não produzida** — sem acesso ao TradingView. |
| B06 | `b06-regime.txt` [API] | não | **TESTE**. |
| B07 | `b07-mtf.txt` [API] | não | **REAL** — chamada de rede real à Binance. |
| B08 | `b08-candles.txt` [API] | não | **REAL** — chamada de rede real, preço do snapshot comparado a uma chamada Binance separada quase simultânea. |
| B09 | `b09-compressao.txt` [API] | não | **TESTE**. |
| B10 | `b10-cvd.txt` [API] | não | **TESTE** + grep de deleção confirmado. |
| B11 | `b11-ponderacao.txt` [API] | não | **TESTE**. |

**Bloco B: as 4 linhas bloqueantes (B01-B04) têm prova — B01 só parcialmente (falta o viés real de 40+40).**

---

## Bloco C: Coletores

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| C01 | `c01-mensal.txt` [API] | sim | **REAL** — chamada de rede real (83 candles mensais reais) + `curl` direto contra a API pública da Binance confirmando o mesmo resultado, independente da classe. A prova mais forte do bloco. |
| C02-C03 | `c02-book.txt` [API] | sim | **REAL** — chamada de rede real, paredes de book reais detectadas chegando ao `AlvoService`. |
| C04 | `c04-liquidacoes.txt` [API] | sim | **REAL** — `curl` direto confirma HTTP 404 no endpoint descontinuado, mais teste real. |
| C05 | `c05-cvd.txt` [API] | não | **REAL** — chamada de rede real. |
| C06 | `c06-oi.txt` [API] | não | **REAL** — chamada de rede real. |
| C07 | `c07-vrvp.txt` [API] | sim | **TESTE** — candles reais, mas as "duas análises com e sem VRVP no print" (prints reais) não foram produzidas; a prova é um teste automatizado cobrindo os dois cenários. |
| C08 | `c08-hvn.txt` [API] | não | **TESTE**. |
| C09 | `c09-candles.txt` [API] | não | **TESTE** — prova estrutural (não foi possível instrumentar contagem literal de chamadas HTTP sem quebrar o padrão "sem mock de mercado" da suíte). |

**Bloco C: as 4 linhas bloqueantes (C01, C02-C03, C04, C07) têm prova — 3 delas com rede real de verdade, C07 só testada.**

---

## Bloco D: Contrato e cérebro

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| D01 | `d01-spot.txt`, `d01-teste-real-ao-vivo.txt` [API] | sim | **QUASE REAL** — teste ao vivo em 31/07 com conta e imagem reais: scan aceitou FUTURES (confidence 0.98), análise completou (`COMPLETED`), saldo caiu exatamente 20 (9260,00→9200,00). Falta só o lado SPOT (5 imagens SPOT reais rejeitadas) — não testamos rejeição ao vivo nesta sessão, só aceite. |
| D02 | `d02-schema.txt` [API] | sim | **REAL** — resolvido em 31/07/2026. Reli `DecisionResponseValidator::validate()` com cuidado: o caminho de rejeição nunca lê `chart_validation.market` (só `accepted`/`analysis_status`) — o risco de regressão de 30/07 não se confirmava. `SPOT` removido do enum (`GenesisDecisionSchema.php`), mantido `nullable`. Confirmado com chamada real à API do Gemini que o schema atualizado é aceito sem erro, mais 3 testes novos + regressão de 15 testes existentes. |
| D03 | `d03-verificacao.txt`, `d03-remocao-trava-31-07.txt` [API] | sim | **REVERTIDO (decisão do usuário, 31/07/2026)** — em teste real ao vivo em produção, o gate rejeitou análises legítimas repetidamente (log real: `CHART_VISIBLE_PRICE_DEVIATION` recorrente em várias sessões no mesmo dia). Causa raiz: comparava o preço visível contra um preço da Binance cacheado por até 180-300s (`BINANCE_CACHE_TTL`), com tolerância de só 0,15% — rejeitava por defasagem do nosso cache, não por erro do gráfico. Correção mínima (buscar preço sem cache só nesse ponto) foi proposta; o usuário optou por remover o bloqueio ("Eu quero que tire essa trava de preço"). `ChartMarketVerifier` continua existindo e calculando o desvio, mas o resultado só gera log informativo, nunca mais reprova a análise. Não bloqueia mais nada — item deixa de ser um gate de aceite.|
| D04 | `d04-visual.txt`, `d04-ajuste-visual-observations-vazio.txt` [API] | sim | **REAL** — ajustado em 31/07 depois de achar, em teste real ao vivo, que a implementação original reprovava 100% das análises reais (15/15 chamadas). Corrigido (`{}`/`[]` vazio agora aceito, omissão parcial continua reprovada) e confirmado com análise real completa depois do ajuste. |
| D05 | `d05-hash.txt` [API] | sim | **TESTE** — o "script recalculando o hash de 10 análises reais" não foi rodado literalmente; a prova é um teste unitário confirmando que os 2 hashes divergem quando esperado. |
| D06 | `d06-response-format.txt` [API] | não | **REAL** — chamada real à API do Gemini confirmou qual formato responde 200 vs. 400. |
| D07 | `d07-coerencia.txt` [API] | não | **TESTE**. |
| D08 | `d08-niveis-visuais.txt` [API] | não | **TESTE**. |

**Bloco D: das 5 linhas bloqueantes, D02 está resolvido (real, com confirmação via API real) — o único gap
que era código de produção, não prova, está fechado. D01 ainda falta o crédito real, D04/D05 são teste
sem o print/script literal. D03 deixou de ser um gate bloqueante por decisão explícita do usuário em
31/07/2026, depois de causar falsos positivos reais em produção — ver `d03-remocao-trava-31-07.txt`.**

---

## Bloco E: Camada E

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| E01 | `e01-shadow.txt` [API] | sim | **REAL** — `.env` real conferido, default corrigido. |
| E02 | `e02-rr-avisa.txt` [API] | sim | **TESTE** — o "print de análise com RR 1:1.2" real não foi produzido. |
| E03 | `e03-folga.txt` [API] | não | **TESTE**. |
| E04 | `e04-alvos.txt` [API] | sim | **TESTE**. |
| E05 | `e05-custos.txt` [API] | não | **TESTE**. |
| E06-E07 | `e06-plano-b.txt` [API] | sim | **TESTE**. |
| E08 | `e08-troca-de-plano.txt` [API] | sim | **TESTE** — os "dois prints da mesma análise, Plano A e Plano B" reais não foram produzidos; prova é 1 teste de integração real (33 assertions) cobrindo os 9 campos. |
| E09-E10 | `e09-alavancagem.txt` [API] | sim | **TESTE** — os "três prints com 3x/10x/25x" reais não foram produzidos. |
| E11 | `e11-tamanho.txt` [API] | não | **TESTE**. |
| E12 | `e12-liquidacao.txt` [API] | não | **PARCIAL** — implementado com fallback (decidido com você, 31/07). Comparação com a Binance real não produzida — exige credenciais autenticadas que não existem neste ambiente. |
| E13 | `e13-risco.txt` [API] | não | **TESTE**. |

**Bloco E: as 5 linhas bloqueantes (E01, E02, E04, E06-E07, E08, E09-E10 — 6 no total) têm prova; nenhuma tem
o print real literal pedido, exceto E01 (config, não precisa de print).**

---

## Bloco F: Histórico

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| F01 | `f01-outcomes.txt` [API] | sim | **REAL** — comando real rodou, 42 linhas gravadas de verdade em `genesis_analysis_outcomes`. |
| F02 | `f02-desfecho.txt` [API] | sim | **TESTE**. |
| F03-F04 | `f03-persistencia.txt` [API] | sim | **REAL** — backfill real confirmado (90 linhas legado = 90 sem `analysis_uuid`, exato). |
| F05 | `f05-parser.txt` [API] | não | **REAL** — deleção confirmada por grep. |
| F06 | `f06-horizonte.txt` [API] | não | **TESTE** (candle histórico real usado no teste). |
| F07 | `f07-acompanhamento.txt` [API] | sim | **PARCIAL** — comando real registrado no schedule (`*/15 * * * *`, confirmado via `schedule:list`), 3 cenários sintéticos com candles reais cobrindo os 3 caminhos. **"20 planos processados + consulta agrupada por plano/desfecho" — não produzido: a tabela é nova, sem volume real de análises resolvidas ainda.** Não é algo que dá para fabricar sem dados reais de mercado se movendo ao longo do tempo. |

**Bloco F: as 3 linhas bloqueantes têm prova real de que o mecanismo funciona; F07 falta o volume real (não é
uma limitação técnica minha — literalmente não existem 20 planos resolvidos no banco ainda).**

---

## Bloco G: Frontend

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| G01 | `g01-cifrao.txt` [FE] | não | **REAL** — grep confirma correção. "Saída do lint": ESLint não está instalado no projeto (sem devDependency, sem script) — a regra existe como config, disclosed, não enforçada por nenhum script hoje. |
| G02 | `g01-g02-cifrao-e-plano-b.txt` [API] | sim | **TESTE** — "print da análise técnica com todos os valores no padrão" real não produzido. |
| G03 | `g03-rotulos.txt` [FE] | não | **REAL** — grep confirma os 3 pontos corrigidos. Print real não produzido. |
| G04 | `g04-versao.txt` [FE]+[API] | não | **TESTE** — versão dinâmica implementada e testada (`GraphicalAnalysisVersionTest`), print real do rodapé não produzido. |
| G05 | `g05-escala.txt` [FE] | não | **REAL** — grep confirma `/90`. |
| G06 | `g06-vocabulario.txt` [FE] | sim | **ESCOPO RESTRITO POR DECISÃO DO USUÁRIO** — a troca central ("Leitura Confirmada" → `faixaDeConviccao()`) está feita. **O grep de vocabulário NÃO está limpo**: sobram `NAO_RECOMENDADA_*` e "abaixo do recomendado" na própria tela de análise, mais ocorrências em conteúdo educacional/marketing — decisão explícita sua de não estender a troca. **Pelo padrão literal do documento ("Grep de vocabulário limpo"), esta linha bloqueante está tecnicamente reprovada.** |
| G08 | `g08-barras.txt` [FE] | sim | **REAL** (grep confirma a gramática única no código). "Print de SHORT com macro altista, barra vermelha" real não produzido. |
| G09 | `g09-preco-frontend.txt` [FE], `g09-preco.txt` [API] | não | **TESTE** (backend) + **REAL** (grep frontend confirma). Print real de "um único preço" não produzido. |
| G10-G11 | `g10-limpeza.txt` [FE] | não | **REAL** — `vite build` real passou depois da remoção dos 2 arquivos. |
| G12-G13 | `g12-logos.txt` [FE] | sim | **ESCOPO FECHADO POR DECISÃO DO USUÁRIO** — 6 de 8 telas corrigidas (`AssetBadge.tsx`). `ManagementPanel`, `Timeline`, `MarketWidget` **não serão feitas** — decisão final (31/07/2026), não mais pendência. **Pelo padrão literal ("Print das oito telas"), esta linha bloqueante está tecnicamente reprovada.** |
| G14 | `g14-cobertura.txt` [FE] | não | **TESTE**/código — "análise com cobertura abaixo de 70% mostrando o aviso" real não produzida. |
| G15 | `g15-qualidade.txt` [API] | não | **TESTE** — "print do bloco com os quatro fatores" real não produzido. |

**Bloco G: das 4 linhas bloqueantes (G02, G06, G08, G12-G13), G06 e G12-G13 estão tecnicamente reprovadas
pelo padrão literal do documento — ambas por decisão final sua, não por trabalho pendente.**

---

## Bloco H: Configuração e processo

| ID | Prova | Bloqueante | Status real |
| :--- | :--- | :---: | :--- |
| H01 | `h01-config.txt` [API] | não | **REAL** — `config:show services` real (segredos redigidos de propósito no arquivo de prova). |
| H02 | `h02-modelo.txt`, `h02-teste-real-ao-vivo.txt` [API] | sim | **QUASE REAL** — `deploy/guarda_modelo.sh` real, passando limpo, mais análise real ao vivo (31/07) confirmando `model_id=gemini-3.6-flash` persistido do decisor, com scan+narrativa completando na mesma cadeia unificada. Falta só o log individual de `model` por chamada de scan/narrativa (não instrumentado neste ambiente). |
| H03 | `h03-rotas.txt` [API] | não | **REAL** — `route:list` real, antes e depois. |
| H04 | `h04-testes.txt` [API] | sim | **TESTE** — suíte completa real rodando (233 testes), os 12 obrigatórios confirmados presentes (11 já existiam, 1 novo). |
| H05 | `h05-manifesto.txt` [API] | sim | **REAL** — `deploy/verificar_manifesto.sh` real retornando OK sobre 317 arquivos reais; detecção de adulteração testada de verdade (arquivo alterado → `DIVERGE` + exit 1, confirmado e revertido). |
| H06 | `h06-vies.txt` [API] | não | **REAL** — grep real confirma remoção. |
| H07 | `h07-legado.txt` [API] | não | **REAL** — consulta real ao banco `genesisteste` (0 planos, 90/14 legado, dashboard não lê a tabela nova). |

**Bloco H: as 3 linhas bloqueantes (H02, H04, H05) têm prova — H02 só parcialmente (falta o log de análise
real com crédito consumido), H05 é a prova mais completa e real do bloco inteiro.**

---

## Gate final (avaliação real, não aspiracional)

Texto do documento: *"Nada vai para produção enquanto qualquer linha marcada como bloqueante estiver vermelha."*

```
[~] Bloco A completo, com o diagnostico A00 anexado
    A00 real. A04 fechado com gap permanente (histórico Git + tokens), decisão sua.

[ ] Bloco B completo, com a prova de vies de 40 mais 40 analises
    NÃO produzida — exige crédito Gemini real, só você pode autorizar.

[~] Bloco C completo, com a prova de VRVP com e sem
    C07 provado por teste real (candles reais), não pelo par de prints pedido.

[~] Bloco D completo, com os dez prints reais de SPOT e perpetuo
    D02 RESOLVIDO (31/07) — schema não aceita mais SPOT, confirmado com chamada
    real à API. D01: análise FUTURES real completa em 31/07 (crédito cobrado
    certo). Falta só o lado SPOT (5 imagens SPOT reais rejeitadas).

[~] Bloco E completo, com a troca de plano provada nos nove campos
    Provado por teste de integração real (E08, 33 assertions), não pelos dois
    prints pedidos.

[~] Bloco F completo, com o job de acompanhamento rodando
    O job roda de verdade (confirmado no schedule). Falta volume real de planos
    resolvidos para a prova de "20 planos + consulta agrupada" (F07).

[ ] Bloco G completo, com as oito telas e o vocabulario limpo
    FALSO nas duas partes — 6 de 8 telas (G12-G13) e vocabulário não limpo (G06),
    ambos por decisão final sua, registrada.

[~] Bloco H completo, com o manifesto integro e o modelo unico
    Manifesto: SIM, real e verificado. Modelo único: SIM, confirmado com análise
    real ao vivo (decisor + scan + narrativa completando sob a mesma config) —
    falta só o log individual de model por chamada de scan/narrativa.

[x] Nenhuma falha nova em relacao ao baseline do A00
    CONFIRMADO — baseline: 96 passando/1 falha/1 pulado. Estado atual: 237
    passando/1 falha (mesma RadarNewsPollTest, sensível a tempo, sem relação
    com nenhum dos 76 itens). Zero regressão em 10 fases + D02 + os 2 achados
    reais de 31/07 (D04 ajustado, bug de estorno em timeout descoberto).

[ ] Rollback executado e restaurado com sucesso em homologacao
    NUNCA tentado. Não existe ambiente de homologação disponível para mim.
```

**Resultado honesto: 1 de 10 linhas do Gate Final fecha totalmente verde** (nenhuma falha nova). D02,
que era o único gap de código de produção (não de prova) do documento inteiro, foi resolvido nesta
mesma revisão — mas a linha do Bloco D continua parcial, porque D01 (10 prints reais) ainda falta.
As outras 9 linhas têm trabalho real e testado por trás, mas nenhuma satisfaz o padrão literal do
documento ("teste descrito não conta, simulação não conta") sem uma ação que só você pode tomar:
consumir crédito Gemini real, acessar a UI para capturar print, ou montar um ambiente de homologação
para o drill de rollback. G06/G12-G13 já foram fechados por você como decisão final, não pendência.

---

## Achados reais fora do escopo dos 76 itens (teste ao vivo, 31/07/2026)

Rodando análises reais de verdade com o usuário (crédito real, imagem real, conta real), 3 problemas
reais apareceram que não estavam em nenhum dos 76 itens do documento — só aparecem rodando de
verdade, não em teste automatizado:

1. **Crédito cobrado sem estorno em erro fatal de timeout** — quando a requisição PHP excede
   `max_execution_time`, o erro é um `FatalError` que não passa pelo `catch (\Throwable)` normal do
   orquestrador, pulando o `credits->release()`. Confirmado 2x na prática (40 créditos reais
   cobrados, sem estorno, em análises que nunca completaram). **Mitigado, não corrigido**: trocamos
   de `php artisan serve` (limite de 120s fixo, não respeita override) para `php -S` direto com
   `max_execution_time` maior, o que evita bater no limite — mas o gap de código (sem um
   `register_shutdown_function` que libere a reserva de crédito nesse cenário) continua existindo.
   **Recomendo tratar isso como um item novo, não descartar.**
2. **`visual_observations` sempre vazio derrubava 100% das análises reais** — ver D04 acima. Corrigido.
3. **CORS rejeitando a origem correta depois de mudar `.env`** — não é bug de código, é operacional:
   Node não recarrega `.env` sozinho, então qualquer mudança em `CORS_ORIGINS` (ou qualquer variável)
   exige reiniciar `server.ts`. Sem bug, só documentado aqui pra não repetir a confusão.

## O que isso significa na prática

Nenhum item de código ficou pendente por falta de esforço — todo item tem teste automatizado
passando, muitos com chamada de rede real à Binance. O que falta, de forma consistente em todo o
documento, é a camada de prova que só existe fora do meu alcance: crédito Gemini real consumido,
captura de tela da UI ao vivo, credenciais autenticadas da Binance, um ambiente de homologação para
testar rollback, e volume real de uso acumulado ao longo do tempo. Isso não é uma surpresa desta
auditoria — foi disclosed item a item em cada fase — mas reunido numa matriz só, fica claro que a
palavra "aceito" da Matriz de Aceite original não pode ser marcada sem uma dessas duas coisas:
você produz essas provas, ou a entrega ao Fabrício vai junto com essas lacunas explicitamente
marcadas, não escondidas.

**D02 foi resolvido nesta revisão (31/07/2026)** — era o único caso onde o código de produção ainda
fazia exatamente o que o documento aponta como falha. O risco de regressão que motivou adiar o item
não se confirmou ao reler `DecisionResponseValidator::validate()` com cuidado: o caminho de rejeição
de SPOT depende de `chart_validation.accepted`/`analysis_status`, nunca de `market` — remover `SPOT`
do enum do schema não tira do modelo nenhuma capacidade real de rejeitar. Confirmado com uma chamada
real à API do Gemini que o schema atualizado continua sendo aceito. Os gaps que restam no Gate Final
são todos de prova (crédito real, UI, homologação), não de código.
