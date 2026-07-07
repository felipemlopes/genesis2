# PROVAS DE ACEITE — GENESIS V3.0

## PROVA 3: GREP — Caminhos antigos

### 3.1 grep padroes_graficos (GeminiAnalysisService.php)

```
435:             "padroes_graficos" => $figuraResult !== null ? [[
1537:                 'padroes_graficos' => $parsed['padroes_graficos'] ?? [],
1544:             $parsed['padroes_graficos'] = array_values(array_filter(
1545:                 $parsed['padroes_graficos'] ?? [],
```

### 3.2 grep calcularTPs/calcularStop (MotorExecucaoService.php)

```
229:     private static function calcularStopLong(
284:     private static function calcularStopShort(
369:     private static function calcularTPs(
498:         $stopResult = self::calcularStopLong($preco, $lvn, $elementosVisuais, $pdl, $poc, $atr, $atrMult);
503:         $tps = self::calcularTPs($preco, 'LONG', $hvn, $liqClusters, $poc, $pdh, $pdl, $stop, $elementosVisuais, $atr);
564:         $stopResult = self::calcularStopShort($preco, $hvn, $elementosVisuais, $pdh, $poc, $atr, $atrMult);
569:         $tps = self::calcularTPs($preco, 'SHORT', $hvn, $liqClusters, $poc, $pdh, $pdl, $stop, $elementosVisuais, $atr);
```

### 3.3 grep INSEGURO (AnalysisResult.tsx)

```
197:     'INSEGURO': 'Setup não operável: risco-retorno abaixo do mínimo de 1:1.5',
```

### 3.4 grep preco_subindo (TechnicalAnalysisService.php)

```
155:             "preco_subindo" => count($closes) >= 4
156:                 ? ($closes[count($closes) - 1] > $closes[count($closes) - 4])
157:                 : (count($closes) >= 2 ? $closes[count($closes) - 1] > $closes[0] : false),
```

---

## PROVA 4: Testes unitários — FiguraService

```
TESTE A PASSOU: CUNHA_DESCENDENTE identificada | vies=baixa | status=FORMANDO
TESTE B PASSOU: linhas divergentes retornam null (sem figura)
TESTE C PASSOU: array vazio retorna null
TESTE D PASSOU: <20 candles retorna null

=== RESULTADO: 4 passaram, 0 falharam ===
```

---

## PROVA 5: Teste integrado — direcaoProvavel, direcaoFonte, execucao.acao, setup.verificacao

```
PROVA 5.1 PASSOU: direcaoProvavel = motor (linha 600)
PROVA 5.2 PASSOU: direcaoFonte = MOTOR_ESTRUTURA (linha 601)
PROVA 5.3 PASSOU: execucao.acao = AGUARDAR em 3 pontos (C4 gate RR, C7 fluxo, C8 MISTA)
PROVA 5.4 PASSOU: verificacao = INSEGURO no SetupReconciler (C4)
PROVA 5.5 PASSOU: frontend le execucao.acao (C2: emEspera)
PROVA 5.6 OK: direcaoFonte nao precisa estar no frontend (campo de auditoria)
PROVA 5.7 PASSOU: INSEGURO traduzido no frontend (rotuloVerificacao)

=== RESULTADO: 7 passaram, 0 falharam ===

--- Estrutura do JSON de resposta (campos obrigatorios) ---
  direcaoProvavel: string (LONG|SHORT|AGUARDAR)
  direcaoFonte:    string (MOTOR_ESTRUTURA)
  execucao.acao:   string (LONG|SHORT|AGUARDAR)
  execucao.setup.verificacao: string (SEGURO|INSEGURO)
  execucao.setup.stop: float
  execucao.setup.tp1: float
  execucao.setup.tp2: float
  execucao.setup.tp3: float
  execucao.setup.rr1: float
  execucao.setup.riscoMargemPct: float (C17)
```
