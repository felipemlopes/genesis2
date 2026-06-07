# Implementation Plan: OCR Visual, TechnicalAnalysis e Wyckoff Completo

## Overview

Implementação em PHP/Laravel das três áreas: remoção do OCR legado, novos métodos do TechnicalAnalysisService (Volume Profile, Candle Patterns, CVD Divergence), Wyckoff completo com 9 fases/7 eventos, e integração no GeminiAnalysisService. Cada tarefa segue a ordem de dependência natural — primeiro remoções, depois adições independentes, depois integrações.

## Tasks

- [x] 1. Remover código OCR legado do GeminiAnalysisService
  - [x] 1.1 Remover o método `extrairIndicadoresOCR()` inteiro de `GeminiAnalysisService.php`
    - Deletar o método privado `extrairIndicadoresOCR(string $imageBase64): array` completo
    - _Requirements: 1.2_
  - [x] 1.2 Remover bloco de chamada a `extrairIndicadoresOCR()` no método `analisar()`
    - Remover o bloco try/catch que invoca `$this->extrairIndicadoresOCR($imageBase64)` (linhas 57-67 atuais)
    - Remover a variável `$ocrData` e qualquer referência a ela no fluxo
    - _Requirements: 1.1, 1.3_
  - [x] 1.3 Atualizar chamada a `TechnicalAnalysisService->calcular()` para não passar `$ocrData`
    - Mudar `$this->techAnalysis->calcular($candles, $ocrData)` para `$this->techAnalysis->calcular($candles)`
    - No TechnicalAnalysisService, manter `$ocrData = []` como valor default do parâmetro para retrocompatibilidade
    - _Requirements: 1.4_

- [x] 2. Implementar `calcularVolumeProfile()` no TechnicalAnalysisService
  - [x] 2.1 Adicionar método `calcularVolumeProfile(array $candles, int $bins = 50): array`
    - Implementar distribuição de volume em bins de preço
    - Calcular POC (bin com maior volume), HVN (>1.5x média), LVN (<0.5x média)
    - Retornar `['poc' => float, 'hvn' => float[], 'lvn' => float[]]`
    - Guard clause: se `count($candles) < 10` ou range ≤ 0, retornar valores padrão
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 2.2 Write property test: Volume Profile POC dentro do range
    - **Property 1: Volume Profile — POC dentro do range de preço**
    - **Validates: Requirements 4.1, 4.2**
  - [ ]* 2.3 Write property test: classificação correta de HVN e LVN
    - **Property 2: Volume Profile — classificação correta de HVN e LVN**
    - **Validates: Requirements 4.3, 4.4**

- [x] 3. Implementar `detectarPadraoCandle()` no TechnicalAnalysisService
  - [x] 3.1 Adicionar método `detectarPadraoCandle(array $candles): string`
    - Implementar detecção de: DOJI, ENGOLFO_ALTISTA, ENGOLFO_BAIXISTA, MARTELO, ESTRELA_CADENTE, PIN_BAR
    - Retornar "NENHUM" quando nenhum padrão é identificado ou dados insuficientes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  - [ ]* 3.2 Write property test: retorno válido para padrões de candle
    - **Property 3: Detecção de padrões de candle — retorno válido**
    - **Validates: Requirements 5.1, 5.2, 5.5, 5.6**
  - [ ]* 3.3 Write property test: detecção de engolfo
    - **Property 4: Detecção de padrões de candle — engolfo**
    - **Validates: Requirements 5.3, 5.4**

- [x] 4. Implementar `calcularDivergenciaCVD()` no TechnicalAnalysisService
  - [x] 4.1 Adicionar método `calcularDivergenciaCVD(array $candles, array $cvdData): string`
    - Comparar últimos 14 candles/CVD vs 14 anteriores
    - Retornar "BULLISH" se preço faz nova mínima + CVD mínima mais alta
    - Retornar "BEARISH" se preço faz nova máxima + CVD máxima mais baixa
    - Retornar "NENHUMA" caso contrário ou dados insuficientes (<28)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [ ]* 4.2 Write property test: divergência CVD bullish e bearish
    - **Property 5: Divergência CVD — detecção correta de divergência bullish e bearish**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 5. Checkpoint - Validar métodos independentes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar Wyckoff completo no TechnicalAnalysisService
  - [x] 6.1 Adicionar método privado `identificarRange(array $candles): array`
    - Sliding window de 60, 40, 20 candles
    - Range válido: amplitude < 8%
    - Retornar `['teto' => float, 'suporte' => float, 'inicio' => int, 'valido' => bool]`
    - _Requirements: 8.5, 9.1_
  - [x] 6.2 Adicionar método privado `buscarUltimoEvento(array $eventos, string $tipo): ?array`
    - Filtrar eventos por tipo e retornar o último, ou null
    - _Requirements: 9.5_
  - [x] 6.3 Adicionar método privado `detectarEventos(array $candles, array $range): array`
    - Detectar 7 eventos: SC, AR, ST, SPRING, UAT, SOS, SOB
    - Usar volume médio dos últimos 20 candles como referência
    - SC: volume > 2x média + close < suporte*1.01 + queda
    - AR: após SC, subida com volume decrescente
    - ST: retorno ao nível do SC com volume menor
    - SPRING: low < suporte, close > suporte, volume baixo
    - UAT: high > teto, close < teto, volume baixo
    - SOS: close > teto com volume > 1.5x média
    - SOB: close < suporte com volume > 1.5x média
    - _Requirements: 8.3, 8.6, 8.7, 8.8, 8.9, 8.10, 9.2_
  - [x] 6.4 Adicionar método privado `classificarFase(array $eventos, array $range, float $precoAtual): string`
    - Classificar em 9 fases baseado nos eventos detectados e posição do preço
    - _Requirements: 8.2, 9.3_
  - [x] 6.5 Adicionar método privado `gerarNarrativaWyckoff(string $fase, ?string $evento, array $range): string`
    - Mapa de narrativas em português para cada fase
    - Incluir range (teto/suporte) quando disponível
    - _Requirements: 9.4_
  - [x] 6.6 Adicionar método público `ultimoEvento(array $eventos): ?string`
    - Retornar tipo do último evento ou null para array vazio
    - _Requirements: 9.5_
  - [x] 6.7 Substituir método público `detectarWyckoff()` pela nova assinatura
    - Nova assinatura: `public function detectarWyckoff(array $candles): array`
    - Orquestrar: identificarRange → detectarEventos → classificarFase → gerarNarrativa
    - Retornar `['fase', 'evento', 'narrativa', 'gatilho', 'range']`
    - Guard clause: se `count($candles) < 20`, retornar INDETERMINADO
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [ ]* 6.8 Write property test: estrutura de saída Wyckoff válida
    - **Property 7: Wyckoff — estrutura de saída válida**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**
  - [ ]* 6.9 Write property test: detecção de Spring e UAT
    - **Property 8: Wyckoff — detecção de Spring e UAT**
    - **Validates: Requirements 8.9, 8.10**
  - [ ]* 6.10 Write property test: narrativa presente para fase válida
    - **Property 9: Wyckoff — narrativa sempre presente para fase válida**
    - **Validates: Requisito 9.4**
  - [ ]* 6.11 Write property test: ultimoEvento retorna último
    - **Property 10: Wyckoff — ultimoEvento retorna último evento**
    - **Validates: Requisito 9.5**
  - [ ]* 6.12 Write property test: Selling Climax em alta volatilidade
    - **Property 12: Wyckoff — Selling Climax detectado em alta volatilidade**
    - **Validates: Requisito 8.6**

- [x] 7. Checkpoint - Validar Wyckoff completo
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Atualizar `extrairElementosVisuais()` no GeminiAnalysisService
  - [x] 8.1 Migrar modelo de `gemini-2.0-flash` para `gemini-3.5-flash`
    - Alterar variável `$model` no método `extrairElementosVisuais()`
    - _Requirements: 2.4_
  - [x] 8.2 Expandir prompt para incluir `padroes_graficos` e `indicadores_visiveis`
    - Adicionar campos no prompt JSON: `padroes_graficos` (array de strings) e `indicadores_visiveis` (array de strings)
    - Incluir regras de linguagem: sem hífens, sem "resistencia superior", sem "suporte inferior"
    - _Requirements: 2.2, 2.3, 2.5, 3.1, 3.2, 3.3_
  - [x] 8.3 Garantir parsing dos novos campos no retorno
    - Adicionar extração de `padroes_graficos` e `indicadores_visiveis` do JSON parseado
    - Manter defaults `[]` para ambos se ausentes
    - _Requirements: 2.1, 2.5_

- [x] 9. Corrigir `calcularMultiTimeframe()` com sistema de scoring
  - [x] 9.1 Alterar visibilidade de `ema()` e `rsi()` no TechnicalAnalysisService de `private` para `public`
    - Necessário para que GeminiAnalysisService possa invocar diretamente
    - _Requirements: 7.1_
  - [x] 9.2 Reescrever `calcularMultiTimeframe()` com scoring RSI + EMA21 + EMA50
    - Buscar 50 candles por timeframe (mínimo para EMA50)
    - Calcular RSI(14), EMA(21), EMA(50) via TechnicalAnalysisService
    - Score: RSI>50 (+1), close>EMA21 (+1), close>EMA50 (+1); inversos (-1)
    - Bias: score ≥ 2 → BULLISH, score ≤ -2 → BEARISH, else NEUTRO
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 9.3 Write property test: scoring multi-timeframe correto
    - **Property 6: Multi-timeframe — scoring correto**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 10. Integrar novos componentes no método `analisar()` do GeminiAnalysisService
  - [x] 10.1 Adicionar chamadas a Volume Profile, Padrão Candle, e Divergência CVD
    - Após candles carregados, chamar `$this->techAnalysis->calcularVolumeProfile($candles)`
    - Chamar `$this->techAnalysis->detectarPadraoCandle($candles)`
    - Chamar `$this->techAnalysis->calcularDivergenciaCVD($candles, $cvdData)` (se CVD disponível)
    - Envolver cada chamada em try/catch independente
    - _Requirements: 4.6_
  - [x] 10.2 Substituir chamada ao Wyckoff primitivo pela nova assinatura
    - Substituir `$this->techAnalysis->detectarWyckoff($closes, $volumes, $preco, $ema50, $ema200)`
    - Por `$this->techAnalysis->detectarWyckoff($candles)`
    - Envolver em try/catch com fallback `['fase' => 'INDETERMINADO', ...]`
    - _Requirements: 10.1, 10.4_
  - [x] 10.3 Incluir contexto Wyckoff no prompt de `gerarNarrativa()`
    - Adicionar fase, evento e narrativa Wyckoff aos dados fornecidos no prompt
    - _Requirements: 10.2_
  - [x] 10.4 Incluir campo `wyckoff` no array de resultado final da análise
    - Adicionar ao retorno: `'wyckoff' => $wyckoffResult`
    - _Requirements: 10.3_
  - [x] 10.5 Migrar modelo de `gerarNarrativa()` para `gemini-3.5-flash`
    - Alterar `$model` em `gerarNarrativa()` de `gemini-2.0-flash` para `gemini-3.5-flash`
    - _Requirements: 3.4_
  - [x] 10.6 Passar POC, HVN, LVN ao MotorExecucaoService
    - Incluir dados do Volume Profile na chamada a `$this->motorExecucao->gerarSetup()`
    - _Requirements: 4.6_

- [x] 11. Checkpoint - Validar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 12. Property tests complementares
  - [ ]* 12.1 Write property test: TechnicalAnalysisService calcula sem OCR
    - **Property 11: TechnicalAnalysisService calcula indicadores sem OCR**
    - **Validates: Requisito 1.4**
  - [ ]* 12.2 Write unit tests para edge cases gerais
    - Testar candles vazio, candles com 1 elemento, preços todos iguais
    - Testar remoção efetiva de `extrairIndicadoresOCR` (método não existe)
    - Testar que modelo `gemini-3.5-flash` é usado nos prompts
    - Testar sequência Wyckoff manual: SC → AR → ST → Spring
    - _Requirements: 1.1, 1.2, 2.4, 3.4, 8.1_

- [x] 13. Final checkpoint - Validar todos os testes
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using PHPUnit Data Providers (100+ iterations)
- The design document contains complete algorithm implementations for all methods — use them directly
- Files to modify: `GeminiAnalysisService.php` and `TechnicalAnalysisService.php`
