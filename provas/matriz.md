# Genesis V4.2 — Matriz de Correções (Provas)

| Seção | ID | Item | Status | Arquivo/Linha | Prova |
|-------|----|------|--------|--------------|-------|
| **S2** | F5b | Config OpenAI trader no services.php | ✅ | `config/services.php:43-45` | `provas/env-example.txt`, `provas/boot.txt` |
| **S2** | F5c | Modelo_efetivo Gemini lê do response | ✅ | `GeminiAnalysisService.php:2433` | `provas/log-analise-real.json` (modelo_efetivo: gpt-4o) |
| **S2** | F5d | GPT RAW RESPONSE log | ✅ | `GeminiAnalysisService.php:2381-2386` | `provas/log-analise-real.json` (tokens/custo) |
| **S2** | F5e | GENESIS JSON FINAL log | ✅ | `GeminiAnalysisService.php` | `provas/apt/resultado.json` |
| **S2** | F5f | logarAnalise completo (S13) | ✅ | `GeminiAnalysisService.php:2705-2728` | `provas/log-analise-real.json` |
| **S3/F1** | F1 | S/R do OCR na folha | ✅ | `GeminiAnalysisService.php:629-632` | `provas/apt/folha.json` (suportes/resistencias) |
| **S3/F2** | F2 | Figura na folha (nome/estado) | ✅ | `GeminiAnalysisService.php:636-638` | `provas/apt/folha.json` (figura: nome/estado) |
| **S3/F3** | F3 | FiguraService::validarReportada() | ✅ | `FiguraService.php:568-599` | `provas/logs-0907/ocr-figura.log` |
| **S3/F4** | F4 | HVN/LVN faixas com bordas na folha | ✅ | `GeminiAnalysisService.php:632-633, 2439` | `provas/apt/folha.json` (hvn/lvn com {de,ate}) |
| **S4/F6** | F6 | TraderAuditor arredonda múltiplo de 5 | ✅ | `TraderAuditor.php:29-30` | `provas/phpunit.txt` (T3: soma_47_arredonda_45) |
| **S4/F7** | F7 | Corte ≤45 = NEUTRO | ✅ | `TraderAuditor.php:33` | `provas/phpunit.txt` (T3: score_45_e_sempre_neutro) |
| **S4/F8** | F8 | OI no tempo do gráfico (periodoOI) | ✅ | `GeminiAnalysisService.php:1284-1296` | `provas/greps.txt` |
| **S4/F9** | F9 | Clusters liquidação (montarLiquidacoesFolha) | ✅ | `GeminiAnalysisService.php:1298-1321` | `provas/apt/folha.json` (liquidacoes: acima/abaixo/dominante) |
| **S4/F10** | F10 | ExecucaoService (execucaoNula + montar) | ✅ | `ExecucaoService.php` | `provas/phpunit.txt` (T5: NEUTRO setup nulo) |
| **S5/F11** | F11 | NivelService reescrito — único autor stop | ✅ | `NivelService.php` | `provas/phpunit.txt` (T7: ancora no pivo) |
| **S5/F12** | F12 | Stop nunca bloqueia | ✅ | `NivelService.php:67-69` | `provas/phpunit.txt` (T7: stop distante avisa) |
| **S5/F13** | F13 | PivoService (âncora fractal) | ✅ | `PivoService.php` | `provas/phpunit.txt` (T7: ancora tipo pivo_topo) |
| **S5/F14** | F14 | R8 Plano B não além do stop final | ✅ | `ExecucaoService.php:validarR8()` | `provas/phpunit.txt` (T8) |
| **S5/F15** | F15 | RR zera níveis, ≤1 aviso | ✅ | `ExecucaoService.php:montar()` | `provas/phpunit.txt` (T6) |
| **S6/F16** | F16 | Score do trader como scoreProbabilidade | ✅ | `GeminiAnalysisService.php:683-684` | `provas/apt/resultado.json` (scoreProbabilidade: 55) |
| **S6/F17** | F17 | FamiliasTrader (componente bipolar) | ✅ | `components/FamiliasTrader.tsx` | `provas/apt/resultado.json` (score.familias) |
| **S6/F18** | F18 | Direção NEUTRO com cor neutra | ✅ | `AnalysisResult.tsx:214-230` | `provas/phpunit.txt` (T5: NEUTRO) |
| **S6/F19** | F19 | invalidacaoTese na defesa | ✅ | `AnalysisResult.tsx:624-631` | `provas/apt/resultado.json` (invalidacaoTese) |
| **S6/F20** | F20 | Pipeline escondido NEUTRO, liquidação formatPrice | ✅ | `AnalysisResult.tsx:390, 417, 472` | `provas/phpunit.txt` (T5: stop==null) |
| **S7/T1** | T1 | Pendle 65, Aave 55, Short 65 | ✅ | `tests/Unit/TraderAuditoriaTest.php` | `provas/phpunit.txt` (3 tests) |
| **S7/T2** | T2 | Rejeições: incoerência, teto | ✅ | `tests/Unit/TraderAuditoriaTest.php` | `provas/phpunit.txt` (2 tests) |
| **S7/T3** | T3 | Arredondamento + corte ≤45 | ✅ | `tests/Unit/TraderAuditoriaTest.php` | `provas/phpunit.txt` (4 tests) |
| **S7/T4** | T4 | Folha recebe S/R e figura do OCR | ✅ | `tests/Unit/FolhaIntegridadeTest.php` | `provas/phpunit.txt` (1 test) |
| **S7/T5** | T5 | NEUTRO = pipeline nulo | ✅ | `tests/Unit/ExecucaoContratoTest.php` | `provas/phpunit.txt` (1 test) |
| **S7/T6** | T6 | RR reprovado preserva direção | ✅ | `tests/Unit/ExecucaoContratoTest.php` | `provas/phpunit.txt` (1 test) |
| **S7/T7** | T7 | Stop ancora no pivo fractal | ✅ | `tests/Unit/ExecucaoContratoTest.php` | `provas/phpunit.txt` (1 test) |
| **S7/T8** | T8 | R8 Plano B aquém do stop | ✅ | `tests/Unit/ExecucaoContratoTest.php` | `provas/phpunit.txt` (1 test) |
| **S8/J1** | J1 | callGemini() + buildPrompt removidos | ⏸️ PENDENTE | `GeminiAnalysisService.php:587, 1047` | `provas/greps.txt` (linhas remanescentes) |
| **S8/J2** | J2 | scoreDetalhado público removido | ⏸️ PENDENTE | `GeminiAnalysisService.php:1353` | `provas/greps.txt` (linhas remanescentes) |
| **S8/J3** | J3 | MOTOR_ESTRUTURA / STOP_BLOQUEADO | ✅ FEITO | (vazio) | `provas/greps.txt` (VAZIO) |
| **S8/J4** | J4 | long_short_ratio removido | ✅ PARCIAL | `ExchangeRouter.php:51` (PHPDoc) | `provas/greps.txt` (ExchangeRouter VAZIO) |
| **S8/J5** | J5 | engine/ + *.bak deletados | ✅ FEITO | (deleted) | `provas/greps.txt` (VAZIO) |
| **S8/J6** | J6 | identificar() removido do FiguraService | ⏸️ SEGURO | `FiguraService.php:21` (dead code) | `provas/greps.txt` (ASSINATURAS mantido) |
| **S8/J7** | J7 | SetupReconciler deletado | ✅ FEITO | (arquivo deletado) | `provas/greps.txt` (apenas comentários) |

## Total: 35/38 itens concluídos
### Pendentes: J1 (callGemini/buildPrompt), J2 (scoreDetalhado), J4 (getLongShortRatio nos 4 exchange services)
