# GÊNESIS V6.9 — DOCUMENTO DE CORREÇÃO COMPLETA

**Produto:** Gênesis — plataforma de análise de derivativos cripto
**PO:** Fabrício · **Dev:** Felipe
**Base auditada:** V6.8 em produção (backend `genesis-api-genesis2`, frontend `genesis2-master`)
**Data:** 18 de agosto de 2026
**Origem:** auditoria interna + auditoria externa independente + verificação ponto a ponto do setup real BTCUSDT 1d

> Cópia de referência salva no spec a partir do documento colado na conversa em 19/08/2026.
> O PDF complementar `GENESIS_V6_9_ORIENTACOES_PARA_O_DEV.pdf` (33 páginas, mesma numeração,
> sem código) não foi salvo como binário aqui — só o texto extraído dele foi usado para
> montar `tasks.md`. Pedir ao Fabrício o PDF/MD originais em texto puro antes de iniciar a
> Fase 0 de verificação, para não depender de transcrição.

---

## 1. COMO USAR ESTE DOCUMENTO

Cada item tem identificador fixo (`A1`, `B2`, `C7`...). Todo commit deve citar o identificador na mensagem.

Cada item traz quatro campos:

- **Arquivo** — caminho exato
- **Hoje** — o que o código faz agora, com a prova
- **Fazer** — a ação (ALTERAR, INCLUIR, DELETAR ou LIGAR)
- **Código** — pronto para copiar e colar

### Legenda de ação

| Ação | Significado |
|---|---|
| **ALTERAR** | o código existe e está errado |
| **INCLUIR** | não existe e precisa ser criado |
| **DELETAR** | existe e precisa sair |
| **LIGAR** | existe, está correto e nunca é chamado |

---

## 2. ORDEM DE EXECUÇÃO

A ordem não é negociável. Cada fase destrava a seguinte.

| Fase | Itens | Por quê |
|---|---|---|
| **1** | A1, F1 | O candle em formação corrige todos os indicadores de uma vez. |
| **2** | A2, A7, G3 | O score de sentimento devolve os quatro cards e mata o selo "Sem dado". |
| **3** | B1, B2, B3, B4, A10, A11 | Fontes de dados quebradas. Sem isso os alvos não têm de onde sair. |
| **4** | C1 a C8, A3 | Os três alvos. Depende da fase 3. |
| **5** | D1 a D10 | Risco e execução. |
| **6** | E1 a E10, A5, A9 | Coerência da decisão. Precisa dos dados certos das fases anteriores. |
| **7** | A4, A6, A8, G1 a G13 | Texto, formatação e interface. |
| **8** | H1 a H7 | Limpeza. Sempre por último. |

### Não mexer

- `server.ts` e `routes/api.js` — determinação do PO: nada muda ali.
- `OkxService`, `BybitService`, `BitgetService` — ficam para implantação futura.
- Bloco de derivativos da tela — permanece igual.
- Bloco de sentimento do ativo (texto) — permanece; só ganha o score.

---

## 3. O QUE FOI CONFERIDO E ESTÁ CORRETO

Não mexer nestes pontos. Foram verificados por recálculo e conferem:

- Fórmula da EMA, do RSI (Wilder), do ADX/DMI (Wilder), do MACD e do ATR
- Cálculo de risco-retorno bruto e líquido, incluindo o custo implícito de ~15,6 bps
- Ancoragem do stop no ATR (`0,5 × ATR` sobre a âncora estrutural)
- Tamanho em nocional e risco em dólar
- Função central `verificarSegurancaLiquidacao()`
- Rebaixamento de `levels.poc/hvn/lvn` para papel de contexto

**Prova das EMAs** — os valores do Gênesis são exatamente a EMA do candle anterior:

| | TradingView (com candle vivo) | Gênesis V6.8 | EMA recalculada sem o candle vivo |
|---|---:|---:|---:|
| BTC EMA21 | 63.755,90 | 63.778,80 | **63.778,90** |
| BTC EMA50 | 64.293,80 | 64.325,15 | **64.325,10** |
| BTC EMA200 | 71.588,00 | 71.668,98 | **71.668,90** |
| AXS EMA21 | 0,8784 | 0,8807 | **0,880780** |

A fórmula está certa. A série é que está atrasada em um candle. É o item A1.

---

*(Conteúdo completo do documento original — Blocos A a H, checklist de aceite, inventário de
arquivos e registro da auditoria — reproduzido na íntegra na mensagem colada em 19/08/2026.
Este arquivo mantém o cabeçalho e as seções de referência rápida; o detalhamento item a item
foi convertido em tarefas rastreáveis em `tasks.md`, no mesmo diretório, para evitar duplicar
~1500 linhas de prosa+código em dois lugares. Consultar a mensagem original ou pedir ao
Fabrício o arquivo-fonte quando precisar do trecho de código pronto de um item específico —
`tasks.md` referencia o identificador exato de cada um.)*
