# GÊNESIS V6.9 · PROTOCOLO DE ENTREGA

## Orientações de teste e comprovação

Documento obrigatório para a entrega das 41 correções.

> Transcrição de `GENESIS_V6_9_ORIENTACOES_TESTE_FELIPE.pdf` (3 páginas), salva no spec em
> 01/09/2026. Companheiro de `GENESIS_V6_9_IMPLEMENTACAO_FELIPE.md`, no mesmo diretório — este
> arquivo é o "porquê testar", o outro é o "o que muda por item".

**Para:** Felipe · **De:** Fabrício · **Data:** 24/08/2026 · **Documento técnico:**
`GENESIS_V6_9_IMPLEMENTACAO_FELIPE.md`

---

## REGRA ÚNICA DESTA ENTREGA

**Nenhuma correção pode ser entregue sem um teste que a comprove.** A entrega não é aceita com base
em conferência manual, captura de tela ou declaração de que está pronto. A prova é a suíte rodando e
passando.

## Por que este documento existe

Hoje o teste de aceite do Gênesis é este:

```php
public function test_aceite_visual_btcusdt(): void {
    $this->rodarAceite('BTCUSDT','1d',
        'C:\Users\felip\Downloads\BTCUSDT.P_2026-08-16_21-13-21 (1).png',
        'aceite-btcusdt.json');
    self::assertTrue(true);
}
```

Ele tem dois problemas. A asserção é `assertTrue(true)`, que significa "considere verdadeiro", então
o teste passa mesmo que a análise devolva lixo. E o caminho aponta para uma pasta que existe apenas
na sua máquina, com imagens que não estão no repositório, então ele nunca roda em outro lugar.

Sem uma suíte real, as correções críticas deixam de ter evidência automática de não regressão e o
aceite volta a depender excessivamente de conferência manual. É por isso que o teste é o item 41 e
vem primeiro na ordem de execução.

## As cinco regras da entrega

| # | Regra |
|---|---|
| 1 | **Teste antes de código.** O item 41 é o primeiro. Sem asserção real e sem as imagens versionadas no repositório, nenhuma outra correção é avaliada. |
| 2 | **Uma correção, uma prova.** Cada uma das 41 tem uma seção "Como testar" no documento técnico. Cada seção precisa virar pelo menos uma asserção. |
| 3 | **Rodar antes de entregar.** A suíte precisa rodar do início ao fim, na máquina de destino, e passar. Não em ambiente local com caminho absoluto. |
| 4 | **Entregar da mesma árvore que testou.** O código entregue precisa ser exatamente o que rodou na suíte. |
| 5 | **Desvio exige aprovação, não comentário.** Se algum item não puder ser aplicado, isso é comunicado antes. Não é escrito num comentário dentro do código. |

### Sobre a regra 5

Nesta versão foram encontrados dois desvios declarados apenas em comentário no código, sem
comunicação. Um deles alegava que a zona de liquidação entraria "quando a Fase 10 entregar o mapa
real", e a Fase 10 foi entregue no mesmo pacote. A justificativa venceu dentro da própria entrega e
ninguém soube.

## O que precisa ter teste unitário

O aceite visual não substitui os testes matemáticos. Ele comprova o formato da tela. As regras
numéricas precisam de teste próprio, porque são elas que produzem os defeitos que estamos
corrigindo.

| # | Comportamento | O que a asserção verifica |
|---|---|---|
| 1 | Piso de distância do alvo | Candidata a 0.10 ATR é descartada; a 0.30 ATR é aceita |
| 2 | Teto de distância do alvo | Candidata além do horizonte do timeframe é descartada |
| 3 | Espaçamento entre alvos | TP2 a menos de 0.50 ATR do TP1 é rejeitado |
| 4 | Origem exclusiva EMA | Nenhum candidato pode ter origem exclusiva EMA |
| 5 | Segunda validação do alvo | ID escolhido pela IA fora do piso é descartado |
| 6 | Teto do stop | 2.5 ATR normal, 3.8 ATR ampliado, 4.8 ATR rejeitado |
| 7 | Buffer integral | Nenhum caminho reduz o buffer para o stop caber |
| 8 | Ausência versus zero | Sem stop, risco e tamanho saem nulos, nunca 0 |
| 9 | Lote mínimo | Quantidade abaixo do stepSize nunca devolve zero |
| 10 | tickSize e casas decimais | Ativo de $0.0000200 preserva as sete casas |
| 11 | Retry e timeout | Três tentativas com 250ms e 500ms antes de marcar indisponível |
| 12 | Frescor por timeframe | Dado de 13h não é defasado num gráfico diário |
| 13 | Degradação de derivativos | Sem Open Interest, o funding continua sendo lido |
| 14 | Modificador indisponível | Derivativos ausentes devolvem `null`, nunca `0` |
| 15 | Catálogo das 50 figuras | ID fora do catálogo é descartado e registrado |
| 16 | Rollover de vela | Nos quatro instantes, indicadores usam a última vela fechada |
| 17 | Contradição factual | Afirmação que contradiz os dados não é publicada |

## Os dois aceites visuais

### BTCUSDT.P, o caso auditado

A imagem de 23/08/2026 precisa estar no repositório. A análise sobre ela precisa produzir:

```
Variação da vela       +0.85%
EMA 21                 $68,301.6
EMA 50                 $66,323.9
EMA 200                $71,704.7

Nenhum alvo a menos de $510.97 da entrada
Nenhum campo de tamanho, risco ou margem zerado
Nenhum código interno em texto público
Um único formato monetário na tela
```

Os valores das EMAs e da variação pertencem a esta fixture. Não são promessa para execuções futuras.

### ENAUSDT.P

Cobre o que o BTC não cobre:

- Nenhum Fibonacci citado quando não aparece na imagem
- Linhas somente com dois pontos observados
- Resistências e VRVP lidos corretamente
- Preços abaixo de 1 USDT com o tickSize real
- Funding e Open Interest modulando apenas intensidade

## Os cards que precisam voltar a funcionar

### ITEM 29, NÃO OPCIONAL

**Sentimento do Ativo** e **Macro e Geopolítico** precisam voltar a buscar em fontes próprias, cada
um com seu micro-resumo, e precisam continuar funcionando depois de todas as outras 40 correções.

Hoje os dois leem a mesma tabela do Radar News, separada por um filtro. Não há busca em fóruns,
redes sociais nem fontes macro próprias. **Isso é restauração de comportamento que já existiu, não
desenvolvimento novo.**

| Bloco | O que precisa acontecer |
|---|---|
| Sentimento do Ativo | Busca em fontes próprias sobre o ativo analisado, score, prós e contras, micro-resumo |
| Macro e Geopolítico | Busca em fontes próprias de contexto macro, score, micro-resumo |
| Barra superior | Permanece exatamente como está. Apenas visual. Não alimenta os dois de baixo |

Regras que continuam valendo: os dois não entram na direção, não entram no score técnico, não entram
nos alvos nem na execução. Falha de fonte gera indisponível com log detalhado, nunca dado inventado.
O frontend nunca busca um segundo contexto para sobrescrever o que o backend persistiu.

### EXIGÊNCIA VISUAL

Os textos restaurados respeitam a fonte, os tamanhos e a paleta já em uso. **Nenhum card pode ficar
desproporcional em relação aos demais**, como já ocorreu em entregas anteriores. O micro-resumo é
curto por definição: se o texto crescer além do espaço do card, ele é truncado, e não é o card que
se expande.

## Checklist antes de entregar

- [ ] O `assertTrue(true)` foi apagado
- [ ] As imagens de aceite estão versionadas no repositório
- [ ] Nenhum caminho absoluto de máquina local no código de teste
- [ ] Os 17 comportamentos da tabela têm teste unitário
- [ ] O aceite do BTCUSDT roda e passa
- [ ] O aceite do ENAUSDT roda e passa
- [ ] A suíte inteira roda do início ao fim sem falha
- [ ] Sentimento do Ativo traz conteúdo próprio
- [ ] Macro e Geopolítico traz conteúdo próprio
- [ ] Os cards mantêm proporção com o restante da tela
- [ ] Nenhum código interno aparece em texto público
- [ ] Um único formato monetário em toda a tela
- [ ] Nenhum campo numérico sai zerado por ausência de dado
- [ ] O código entregue é o mesmo que rodou na suíte
- [ ] Nenhum item foi desviado sem aprovação prévia

## O QUE MUDA PARA VOCÊ

Com a suíte funcionando, a entrega deixa de ser uma discussão. Você roda o comando, mostra a saída, e
o trabalho está comprovado. Sem ela, cada entrega volta para conferência manual campo por campo, e é
isso que vem consumindo tempo dos dois lados.

---

*Gênesis V6.9 · Protocolo de entrega · 24/08/2026. As 41 correções, com arquivo, linha e critério de
verificação, estão em `GENESIS_V6_9_IMPLEMENTACAO_FELIPE.md`.*
