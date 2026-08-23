# Gênesis V6.9, pacote final de implementação para Felipe

Data de congelamento: 20 de agosto de 2026

Baseline obrigatório: `genesis-api-genesis2 (40).zip` e `genesis2-master (27)(1).zip`.

SHA-256 do backend 40: `df630d92b78bb1a5c25ccb7cb7ced10b8aacb53d4f1759a1a58cf9e2a2d1ed49`.

O ZIP 40 e o ZIP 39 são idênticos, inclusive nos 602 arquivos PHP. Portanto, este pacote não depende de escolher entre eles. A referência oficial deste trabalho é o ZIP 40.

## 1. O que este arquivo entrega

Este documento é o pacote de alteração sobre o baseline acima. Ele reúne, em um único lugar:

1. regras de produto que não podem ser reinterpretadas;
2. fontes e rotas de API permitidas;
3. arquivos novos completos;
4. substituições completas de classes defeituosas;
5. patches exatos nos arquivos existentes;
6. arquivos e caminhos que devem ser apagados;
7. testes unitários, de integração, de contrato e de interface;
8. ordem de implantação e rollback;
9. matriz de cobertura dos 50 itens da auditoria e dos 9 defeitos adicionais.

Os arquivos do baseline que já estão corretos não são copiados integralmente. Tudo que precisa ser criado, alterado, removido ou comprovado está neste arquivo.

### Legenda operacional

- `NOVO`: criar o arquivo exatamente no caminho indicado.
- `SUBSTITUIR`: trocar o conteúdo integral do arquivo.
- `PATCH`: aplicar somente o trecho informado ao arquivo atual.
- `APAGAR`: remover o arquivo e seus testes exclusivos depois de concluir a migração indicada.
- `MANTER`: código correto do baseline, coberto por teste de não regressão.
- `PROVA`: não é correção de código, exige baseline, captura, hash ou execução controlada.

> Nota do spec (21/08/2026): este arquivo é cópia literal do documento colado pelo Felipe na
> conversa que abriu este spec. O código completo de cada item (seções 5 a 19) está aqui, na
> íntegra, e é a referência oficial para copiar/colar — `tasks.md`, no mesmo diretório, só indexa
> os itens em fases rastreáveis por checkbox e não duplica o código. Ver também
> `MATRIZ_DE_ACEITE_V6_9.md` (transcrição do PDF complementar `GENESIS_V6_9_CHECKLIST_FELIPE.pdf`,
> que veio junto do documento).

**AVISO — este arquivo ainda NÃO contém o corpo completo (seções 2 a 22: regras imutáveis,
matriz de fontes, banco/contratos, fronteira Binance/gate anti-Spot, frescor, DMI/MACD,
derivativos, catálogo de zonas/seleção de alvo, visão/OCR, Plano A/B, score final, mapa de
liquidação, contrato público/frontend, ferramentas laterais, limpeza, testes, matriz de cobertura,
implantação/rollback e definição de pronto).** Documento é grande demais (código PHP/TS completo)
para copiar de uma vez sem estourar o limite de saída por resposta. Até essa cópia literal ser
concluída, a fonte de código válida para qualquer identificador é o documento original colado na
conversa de 21/08/2026 — não confiar neste arquivo como cópia completa enquanto este aviso
existir.
