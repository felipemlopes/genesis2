# PROVAS DE ACEITE — GENESIS V3.2

## 1. grep pisoTP1 (R3 — vazio)

```
```

**Resultado:** Vazio. O filtro que fabrica RR foi removido.

---

## 2. grep allForceOrders (R13 — presente com fonte_ok)

```
BinanceService.php:239:        return $this->get('/fapi/v1/allForceOrders', [
```

**Resultado:** Presente apenas com `fonte_ok = false` declarado. Nunca pontuando em silêncio.

---

## 3. grep 0.35 (R10 — vazio)

```
```

**Resultado:** Vazio. Thresholds em escala percentual: 35 e 15.

---

## 4. grep CVD_DIV_BULL\|CVD_DIV_BEAR (R11 — vazio)

```
```

**Resultado:** Vazio. A divergência de CVD pontua apenas no C16.

---

## 5. grep símbolos ✓/✗ (R7 — vazio)

```
```

**Resultado:** Vazio. verificacao com valores canônicos + verificacao_motivo.

---

## 6. grep EMPILHAMENTO_ALTA (R14 — presente)

```
ScoringService.php:144:                $flags[] = 'EMPILHAMENTO_ALTA';
```

**Resultado:** Presente. Empilhamento completo pontuando na estrutura.

---

## 7. grep fontes_saude (R16 — presente)

```
GeminiAnalysisService.php:986:        $result['fontes_saude'] = [
```

**Resultado:** Presente. Mapa de saúde no payload.

---

## 8. grep data.avisos (R19 — vazio)

```
```

**Resultado:** Vazio. Avisos lidos de `execucao.avisos` + `execucao.setup.avisos`.

---

## 9. grep motorExecucao\|genesisPipeline (R22 — frontend)

```
routes/api.js:6:  const { GenesisPipeline } = require('../engine/genesisPipeline');
routes/api.js:7:  const { EnsembleGenesis }  = require('../engine/ensembleGenesis');
routes/api.js:8:  global.EnsembleGenesis = EnsembleGenesis;
routes/api.js:248: const pipeline = new GenesisPipeline(exchange);
```

**Resultado:** Referências encontradas em `routes/api.js` (servidor Express do frontend). Reportado ao cliente antes da deleção (procedimento R22).

---

## 10. grep openInterestHist (R12 — presente)

```
BinanceService.php:355:    public function getOpenInterestHist(string $symbol, string $period = '1h', int $limit = 25): array
BinanceService.php:357:        return $this->get('/futures/data/openInterestHist', [
```

**Resultado:** Presente. OI em janela fixa de 24h.

---

## 11. grep tp1_fonte => 'projecao' (R23 — vazio)

```
```

**Resultado:** Vazio. Projeção nunca gera TP1; fonte única de alvos.

---

## 12. grep motivo.*rationalScore\|rationalScore.*motivo (R24 — vazio)

```
```

**Resultado:** Vazio. A justificativa do score vive em `justificativaScore`; o motivo pertence à execução.

---

## 13. grep AGUARDAR_PLANO_B (R25 — presente)

**Backend:**
```
SetupReconciler.php:139:                $setup['acao']   = 'AGUARDAR_PLANO_B';
```

**Frontend:**
```
AnalysisResult.tsx:195:  const emEsperaPlanoB = data.execucao?.acao === 'AGUARDAR_PLANO_B';
```

**Resultado:** Presente no reconciler e no frontend. RR avaliado por plano.

---

## Contrato JSON — Campos novos V3.2

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `execucao.acao` | string | `LONG \| SHORT \| AGUARDAR \| AGUARDAR_PLANO_B` |
| `execucao.motivo` | string | Obrigatório quando `acao = AGUARDAR*`; dono único: pipeline de execução |
| `execucao.justificativaScore` | string | rationalScore; campo próprio, nunca sobrescreve o motivo |
| `execucao.setup.verificacao` | string | `SEGURO \| INSEGURO` (sem símbolos) |
| `execucao.setup.verificacao_motivo` | string\|null | `LIQUIDACAO \| RR_MINIMO \| SEM_DIRECAO \| SEM_BARREIRA_REAL` |
| `execucao.setup.stop` | float\|null | null quando não existe stop válido |
| `execucao.setup.riscoPct` | float | SEMPRE percentual 0 a 100 (escala unificada) |
| `execucao.setup.tp1_fonte` | string | A barreira real que originou o TP1; nunca `projecao` |
| `execucao.setup.rr1` | float\|null | RR real até a primeira barreira (Plano A) |
| `execucao.setup.planoB.rr1` | float\|null | RR próprio do Plano B |
| `execucao.setup.entrada_ts` | string | Timestamp do ticker usado na entrada |
| `fontes_saude` | object | Mapa de saúde de todas as fontes |
| `score.flags` | array | Inclui `FONTE_LIQUIDACOES_INDISPONIVEL` quando aplicável |
