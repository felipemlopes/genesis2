# GÊNESIS V6.10 · ORIENTAÇÕES DE IMPLEMENTAÇÃO — O que incluir, o que retirar

> Transcrição de `GENESIS_V6_10_ORIENTACOES_FELIPE.pdf` (8 páginas). Orientação de escopo para a
> rodada V6.10 — o detalhamento técnico, com arquivo, linha e código, está em
> `GENESIS_V6_10_IMPLEMENTACAO_FELIPE.md`, mesmo diretório.

| Campo | Valor |
|---|---|
| Para | Felipe |
| De | Fabrício, PO |
| Data | 03/09/2026 |
| Backend | `genesis-api-genesis2` |
| Frontend | `genesis2-master` |
| Fases | 10, em ordem obrigatória |

**A regra que vale acima de todas.** Este documento manda remover código. Nenhuma remoção pode ser
feita sem testar antes. Levantar consumidor, rodar a suíte, remover, rodar de novo, comparar. Teste
que passava e parou de passar significa reverter e perguntar.

---

## Página 2 — Nunca apague nada sem testar antes

Esta rodada remove um ajuste inteiro do prompt, três penalidades do código, um formatador, um
modificador e uma regra de arquitetura. É a rodada com mais remoção da história do Gênesis. Um
símbolo que some sem que a tela saiba disso quebra a tela em produção, e a tela é o produto.

1. **Levante os consumidores.** `grep -rn` pelo símbolo no backend inteiro, no frontend inteiro e
   nos testes. Liste cada um.
2. **Rode a suíte antes de tocar em nada** e guarde a saída em arquivo. Ela é a linha de base de
   toda a rodada.
3. **Remova.**
4. **Rode a suíte de novo** e compare com a saída guardada.
5. **Teste que passava e parou de passar significa reverter** e me perguntar. Não improvise
   substituto, não comente o código por segurança, não deixe o campo devolvendo `null` sem avisar
   ninguém.

**Se aparecer consumidor que o documento não previu:** pare e pergunte. Três das cinco remoções
desta rodada têm consumidor em teste que vai quebrar de propósito, e o documento técnico diz qual
asserção muda em cada caso. Se aparecer um quarto que não está lá, é sinal de que o PO não enxergou
algo, e é melhor descobrir isso antes do deploy do que depois.

**Desvio se comunica antes.** Se algum item não puder ser aplicado como está escrito, avisar antes
de implementar diferente. Comentário no código não é canal de aprovação. Vale para escolha de
fixture, troca de escopo e qualquer decisão que mude o que está especificado.

---

## Página 3 — Mudança central: o cérebro

**O PHP põe na mesa. A IA decide. Ninguém corrige depois.**

Hoje o prompt manda a IA começar de uma base fixa e somar cinco ajustes, e depois o código corrige
o resultado dela três vezes. É por isso que um indicador que vale 3 na tabela de pesos consegue
custar 25 pontos. Não é falta de motor, é excesso de motor.

**Sai:**
- O ajuste A6 do prompt, com a base fixa e os cinco somatórios
- A penalidade de 10 pontos por contradição
- A penalidade de frescor sobre a nota
- O modificador de derivativos de −15 a +15
- A regra que corta derivativos da mesa da decisão
- O campo de score numérico livre no schema

**Entra:**
- A IA classifica quatro famílias em cinco níveis fixos
- A tabela de pesos converte a classificação em número
- Derivativos entram na mesa como família comum
- Família sem dado sai da conta inteira, sem custar ponto
- Piso de cobertura: abaixo dele, análise sem número
- O detalhamento da nota vai para o payload, auditável

**A classe que continua viva.** O detector de contradições não é apagado. Ele continua produzindo a
lista que alimenta o box "Pontos que pesam contra esta leitura", que é útil e fica na tela. Ele só
para de mexer no número, porque a IA já pesou aquele indicador ao classificar a família. Descontar
de novo é contar duas vezes o mesmo fato.

**Por que isso resolve a queda violenta por um indicador só.** A tabela de pesos vira o teto. O DMI
é um dos quatro indicadores de uma família que vale 14. A família inteira, indo do extremo
favorável ao extremo contrário, move 12,6 pontos. Hoje o DMI sozinho move 10, e 25 quando o ADX o
acompanha. Fica matematicamente impossível um indicador derrubar a nota sozinho.

---

## Página 4 — A escala do score

A IA não escreve o número. Ela escolhe quatro palavras de uma lista de cinco, uma por família, e o
número sai da tabela. Mesma classificação, mesmo score, sempre.

| Nível | Fator do peso | Degrau |
|---|---|---|
| FORTE_A_FAVOR | 100% | +25 |
| A_FAVOR | 75% | +25 |
| NEUTRO | 50% | referência |
| CONTRA | 25% | −25 |
| FORTE_CONTRA | 0% | −25 |
| INDISPONÍVEL | sai do numerador e do denominador | — |

| Família | Peso | Forte a favor | A favor | Neutro | Contra | Forte contra |
|---|---|---|---|---|---|---|
| Estrutura | 30 | 27,0 | 20,3 | 13,5 | 6,8 | 0 |
| Order Flow | 28 | 25,2 | 18,9 | 12,6 | 6,3 | 0 |
| Derivativos | 28 | 25,2 | 18,9 | 12,6 | 6,3 | 0 |
| Momentum | 14 | 12,6 | 9,5 | 6,3 | 3,2 | 0 |

```
score     = 90 × (Σ peso × fator) / (Σ peso das famílias avaliadas)
cobertura = Σ peso avaliado / 100
```

Arredonda para múltiplo de 5. Teto natural em 90, sem trava artificial.

**A regra de ausência, que precisa ficar explícita.** Família sem dado sai dos **dois** lados da
fração. Sem Derivativos, o divisor vira 72 e as outras três crescem proporcionalmente. Um setup com
tudo fortemente a favor dá 90 com quatro famílias e dá 90 com três. Perder uma família não custa um
único ponto: encolhe a cobertura e só. Neutro e indisponível são coisas diferentes e não podem ser
confundidos: neutro é uma leitura, indisponível é ausência de dado.

---

## Página 5 — Risco e retorno: a entrada boa já está calculada e ninguém a usa

O Plano A é sempre a entrada a mercado, inclusive quando o preço está esticado ou no meio de um
range. O Plano B, que espera o nível, vem calculado e desmarcado ao lado. Um trader não entra a
mercado no meio do range.

| Mesmo stop, outra entrada | Plano A, a mercado | Plano B, no nível |
|---|---|---|
| APT, primeiro alvo | 1:0,22 | **1:0,57** |
| BTC, primeiro alvo | 1:0,24 | **1:0,43** |
| SUI, primeiro alvo | 1:0,35 | **1:1,39** |
| SUI, segundo alvo | 1:1,14 | **1:2,79** |

**O que muda.** A IA passa a declarar qual plano é o primário, e o primário é o que vem
pré-selecionado e o que alimenta o cabeçalho. Preço num nível, primário é a mercado. Preço esticado
ou no meio do range, primário é o nível. O Plano A continua existindo e continua clicável.

**E o número do cabeçalho.** Uma operação com três alvos não tem um risco/retorno, tem um
combinado. O cabeçalho passa a mostrar o do plano, com as parciais declaradas e visíveis, e cada
alvo continua mostrando o seu. O primeiro alvo tem risco/retorno baixo porque está perto, não porque
o mercado disse que não sobe: ele é o alvo mais fácil dos três e paga pouco. Não existe alvo perto
com risco/retorno alto, isso é geometria.

**O rótulo também muda.** Um plano em que o segundo alvo paga 1:0,63 e o stop está bem colocado não
é um "plano não recomendado", é um plano de risco/retorno modesto. O rótulo passa a descrever o que
o plano é. O botão continua ativo em todos os casos: risco e retorno abaixo do mínimo avisa, nunca
bloqueia.

---

## Página 6 — Escopo: os vinte defeitos

Todos verificados no código do pacote de 02/09 e visíveis nas três telas auditadas. Arquivo, linha
e código no documento técnico.

**Bloqueadores**

| ID | O que o membro vê hoje |
|---|---|
| A1 | No BTC, "Stop a 10.2% da entrada" logo acima de "Distância até o stop 4.66%". O aviso é do Plano B e aparece na tela do Plano A |
| A2 | Nos três, frescor travado em 88% e a frase de preço defasado. A validade de trinta segundos é cronometrada depois de todo o pipeline e nunca fecha |
| A3 | Cabeçalho escreve um formato, a análise técnica escreve outro, na mesma tela. E a VWAP do SUI sai com oito casas num contrato de quatro |
| A4 | No SUI, título "Plano atende o TP3" com corpo dizendo que a convicção é baixa |
| A5 | Os dois aceites visuais em skip, asserções pendentes e nenhum teste sobre o payload que a tela recebe |

**Segunda ordem**

| ID | O que o membro vê hoje |
|---|---|
| B1 | Código bruto de Wyckoff no APT e no SUI. O dicionário da tela tem oito fases, o sistema tem onze |
| B2 | Nome de serviço e estado de orçamento impressos para o membro |
| B3 | Selo "Indisponível" no card de Macro que está mostrando VIX, DXY e S&P reais logo abaixo |
| B4 | Texto do score com ponto no meio da frase e ponto duplo no fim |
| B5 | Variação de Open Interest de 2224% sem dizer que a janela é de trinta dias, e sem teto de plausibilidade |
| B6 | Os três níveis de invalidação existem no sistema e nenhum aparece na tela. E o único mostrado tem o nome errado |
| B7 | No BTC o arredondamento do lote comeu 28% do risco planejado e a tela não diz nada |

**Varredura profunda**

| ID | O que está acontecendo |
|---|---|
| C1 a C3 | O seletor automático de stop, preservado como rota de escape, nunca foi recalibrado: curva de proximidade frouxa, recência liga-desliga e um tipo de nível entrando sozinho com o maior peso. Disparou no SUI |
| C4 e C5 | Dois itens marcados como concluídos com a metade de frontend admitidamente não feita, e um grounding nunca testado contra a API real |
| C6 a C8 | Dois formatadores de dinheiro convivendo, ícone do ativo não carregando, e dois eixos de decisão em que o cérebro que roda depende só do arquivo de ambiente |

---

## Página 7 — Execução: as dez fases, ordem obrigatória

A ordem tem dependência real entre as fases. Uma desliga penalidade que a outra também menciona,
outra mexe no mesmo arquivo. Fazer fora de ordem cria conflito.

| Fase | O quê | Por que nesta posição |
|---|---|---|
| 1 | A suíte de verdade: destravar os aceites e criar o teste sobre o payload publicado | Sem ela nada abaixo tem prova |
| 2 | Os três bloqueadores de uma linha: A1, A3 e A4 | Precisa da linha de base da Fase 1 |
| 3 | O novo modelo de score | Remoção grande, exige suíte confiável |
| 4 | A régua do frescor | A Fase 3 já tirou metade deste item |
| 5 | O plano primário declarado pela IA | Mesmo arquivo de tela da Fase 2 |
| 6 | Os sete achados de segunda ordem | Mesmo arquivo |
| 7 | Recalibração do fallback do stop | Muda escolha de nível, precisa de teste |
| 8 | As metades pendentes e a configuração do decisor | Independente das demais |
| 9 | A geometria do alvo e o risco/retorno do plano | Depende do plano primário da Fase 5 |
| 10 | O protocolo de aceite | É a entrega |

**Dois avisos de interação.** A Fase 3 torna sem efeito a parte da Fase 4 que fala em parar de tirar
ponto, e desativa a penalidade que hoje produz os descontos do APT e do SUI. E ela muda a escala:
análises anteriores deixam de ser comparáveis com as novas. Marque a data de corte na base para a
estatística de assertividade não misturar os dois modelos.

---

## Página 8 — Fechamento: definição de pronto

Não basta rodar a suíte. Antes de entregar, rode o Gênesis em seis ativos diferentes e confira, tela
por tela, se tudo aparece como está aqui. Entrega sem isso volta.

**Os seis perfis obrigatórios**

| Perfil | O que ele valida |
|---|---|
| Tendência de alta clara | O teto da escala e a classificação estrutural favorável |
| Tendência de baixa clara | O mesmo, no sentido oposto |
| Range | O meio da escala e a classificação neutra |
| Derivativos ausentes | A regra de ausência e o cálculo da cobertura |
| Baixa liquidez | Tick, passo do lote e casas decimais |
| Um dos três da mesa | Comparação direta com as telas de 02/09 |

**Confirmar em cada um dos seis**

- [ ] As quatro famílias aparecem classificadas e o score bate com a tabela aplicada a elas
- [ ] Nenhuma penalidade posterior alterou o número que a IA determinou
- [ ] Família ausente sai da conta, encolhe a cobertura e não derruba o score
- [ ] Cobertura abaixo do piso publica sem número, nunca zero
- [ ] Alternar entre os planos troca também as linhas da barra de avisos
- [ ] Nenhuma tela mostra duas distâncias de stop diferentes ao mesmo tempo
- [ ] O plano primário vem pré-selecionado conforme a IA declarou
- [ ] Manchete e corpo do box do plano nunca falam de coisas diferentes
- [ ] Um único formato de dinheiro na tela, com as casas vindas do tick do contrato
- [ ] Nenhum código em caixa alta nem nome de serviço em texto do membro
- [ ] Os três níveis de invalidação com os nomes corretos, cada um omitido quando ausente
- [ ] **Sentimento da moeda** com conteúdo próprio, fonte e horário, ou ausente
- [ ] **Macro e geopolítico** com conteúdo próprio, fonte e horário, ou ausente
- [ ] Os dois cards acima presentes em três execuções seguidas do mesmo ativo
- [ ] Card marcado como indisponível não exibe dado ao mesmo tempo
- [ ] Risco planejado e risco real lado a lado quando o arredondamento afastar os dois

**Entregar junto:** os dois repositórios exatamente como rodaram a suíte, a saída dos nove comandos
de verificação, os seis JSONs públicos, captura de tela dos seis, o checklist acima preenchido seis
vezes, a lista de consumidores levantada antes de cada remoção e a lista de qualquer desvio,
comunicado antes e nunca depois.
