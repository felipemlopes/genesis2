# GENESIS-V4.3-R3.2-PROVA

Pacote de prova da implementação do Documento Mestre V4.3-R3.2, gerado em 2026-07-13.

**Leia primeiro:** [`matriz-aceite.md`](./matriz-aceite.md) — os 50 itens do aceite binário
(Seção 20 do Documento Mestre), cada um com veredito APROVADO/REPROVADO e a evidência exata.
**33 de 50 itens aprovados.** Os 17 reprovados estão listados com a causa raiz, agrupados por
categoria, no fim daquele arquivo.

## Estrutura

```
commit-backend.txt          — estado do git no backend (genesis-api); nada commitado
commit-frontend.txt         — estado do git no frontend; nada commitado
documento-versao.txt        — versão normativa e constantes de versão no código
env-mascarado.txt           — configuração do backend, sem nenhum segredo exposto
boot.log                    — linha de boot mais recente (confirma risco configurado)
phpunit.txt                 — suíte de testes do backend (59/60 — 1 falha não relacionada)
frontend-lint.txt           — tsc --noEmit (limpo)
frontend-test.txt           — vitest (279/306 — 27 falhas pré-existentes não relacionadas)
frontend-build.txt          — build de produção (sucesso)
greps-backend.txt           — greps de remoção da Seção 19.2 (backend) — NÃO 100% vazio
greps-frontend.txt          — greps de remoção (frontend) — 100% vazio
matriz-aceite.md            — os 50 itens do aceite binário
analises/                   — reanálise real de ETH/POL/SUI — VAZIO, ver nota abaixo
casos-contrato/             — evidência dos 5 cenários de contrato via teste automatizado
features-r3.2/              — comparação CONTROL/CANDIDATE e gaps da camada de enriquecimento
```

## O que este pacote NÃO contém, e por quê

**`analises/ETHUSDT`, `analises/POLUSDT`, `analises/SUIUSDT` estão vazias.** A Seção 19.3 do
Documento Mestre pede uma reanálise real desses três ativos, com OCR, folha, trader,
auditoria, execução, resposta pública, print de tela e log — isso exige subir a aplicação,
enviar imagens reais de gráfico, e consumir orçamento real de chamadas à API do Gemini (até 5
por análise, 3 análises = até 15 chamadas cobradas). Não fiz isso sem autorização explícita,
porque é uma ação com custo real de dinheiro e efeito em um serviço externo às credenciais do
usuário — o tipo de ação que exige confirmação prévia, não decisão unilateral. Este é o item
30 do aceite binário, marcado REPROVADO por esse motivo.

## Como interpretar as evidências deste pacote

A maior parte da prova aqui é **teste automatizado** (PHPUnit/Vitest) e **revisão de
código**, não observação de uma análise real rodando em produção. Isso é declarado
explicitamente em cada seção — nenhum item foi marcado como aprovado por suposição. Onde a
única forma de provar um item exigia uma chamada real e essa chamada não foi feita, o item
foi marcado REPROVADO na matriz, mesmo quando a implementação parece correta por leitura de
código.

## Rastreabilidade completa

Todo o trabalho desta implementação está documentado tarefa a tarefa, com notas de desvio e
gaps, em `.kiro/specs/genesis-r3-2-implementacao/` (no repositório frontend):
- `requirements.md` — 20 requisitos formais
- `design.md` — arquitetura, decisões, propriedades de corretude
- `tasks.md` — progresso real, com data e justificativa de cada desvio do texto literal do
  Documento Mestre
