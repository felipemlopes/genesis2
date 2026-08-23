# Gênesis V6.9 — Matriz de Aceite

Transcrição de `GENESIS_V6_9_CHECKLIST_FELIPE.pdf` (13 páginas), congelamento 20/08/2026.
Destinatário: Felipe · PO: Fabrício · Baseline: `genesis-api-genesis2 (40)` · `genesis2-master (27)`.

98 itens de código · 14 fases · 5 scans de bloqueio · 25 portões finais.

Um item só é marcado quando existe prova (teste verde, scan vazio ou captura de aceite) — card
renderizando na tela não é prova.

## Legenda

| Tag | Significado |
|---|---|
| `NOVO` | criar o arquivo exatamente no caminho indicado |
| `SUBSTITUIR` | trocar o conteúdo integral do arquivo |
| `PATCH` | aplicar somente o trecho informado |
| `APAGAR` | remover o arquivo e testes exclusivos após a migração |
| `REMOVER` | exclusão física em fase controlada, depois do canário |
| `MANTER` | código correto do baseline, coberto por não regressão |
| `DECISÃO` | não é código — registrar a decisão por escrito |
| `ISOLAR` | preservar fora do cérebro, sem autoridade decisória |

## Regras que não podem ser reinterpretadas

- Cérebro exclusivamente Perpetual — nenhum dado Spot entra no snapshot, manifesto, prompt
  decisório, score, alvos ou execução.
- Direção antes de derivativos — a etapa técnica decide LONG/SHORT sem ver funding/OI; a direção
  é congelada e os derivativos só medem intensidade.
- Alvo é zona real — a IA ordena `candidate_id`, nunca devolve preço; ATR agrupa e mede, nunca
  cria preço.
- Visão não projeta — figura, linha e Fibonacci só existem se realmente lidos na imagem.
- Alvo ausente permanece ausente — proibido completar layout por cálculo.
- Os quatro cards aparecem sempre — Técnico, Derivativos, Macro e Geopolítico, Sentimento;
  ausência aparece como Indisponível.

## Contagem por fase (ver `tasks.md` para o detalhe rastreável)

| Fase (doc) | Título | Itens |
|---|---|---|
| §5 | Banco, contratos e tipos canônicos | 3 |
| §6 | Fronteira Binance Futures e gate anti-Spot | 9 |
| §7 | Frescor por fonte e cobertura real | 4 |
| §8 | DMI e MACD como duas famílias | 3 |
| §9 | Derivativos como intensidade, nunca direção | 5 |
| §10-11 | Catálogo canônico de zonas + seleção de alvo por ID | 8 |
| §12 | Visão, figuras, linhas e Fibonacci sem projeção | 5 |
| §13 | Plano A a mercado, Plano B estrutural, risco por plano | 7 |
| §14 | Score final antes da execução | 6 |
| §15 | Mapa de liquidação estimado, sem volume fabricado | 3 |
| §16 | Contrato público e frontend, verdade única | 13 |
| §17 | Ferramentas laterais sem dado fabricado, Spot isolado | 12 |
| §18 | Limpeza, órfãos e achados do fechamento | 14 |
| §19 | Testes e provas obrigatórias | 6 |
| **Total** | | **98** |

Mais: 4 provas dependentes de material externo (A6, B2, A12, H8) · 5 scans estáticos de bloqueio ·
12 passos de ordem de deploy · aceite visual BTC/ENA · 25 portões finais de "definição de pronto".

## ⚠️ Conflito sinalizado (não resolvido nesta matriz)

Item da seção 18.9 (unificar `GENESIS_MODEL`/`gemini-3.6-flash`, apagar
`GENESIS_GEMINI_DECISION_MODEL`) reverte a decisão do Felipe de 19/08/2026 de manter
`gemini-3.7-flash` depois do incidente de crédito esgotado na OpenAI (spec
`genesis-decisor-volta-gemini-3-7`). Ver aviso equivalente no topo de `tasks.md`. Não marcar esse
sub-item como concluído sem confirmação explícita.

## Os 4 itens que código sozinho não fecha

1. **A6** — amplitude do score (10 imagens reais, benchmark, amplitude mínima 25 pontos).
2. **B2** — amostra Wyckoff (20 imagens reais, ≥1 evento verdadeiro).
3. **A12** — comparação visual dos cards de derivativos (depende de baseline histórico/captura).
4. **H8** — diff do servidor Node (depende de commit/hash anterior).

Sem baseline, A12/H8 são marcados formalmente como indisponíveis — nunca preenchidos por memória.
