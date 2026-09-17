import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Genesis Brain V2 (Fase 4.2/4.3, item 13.4/14.2, Requisito 12.9/13.3, Fonte §36.7/§38): "mover o
 * stop não deve chamar o Trader AI, não deve mudar direction/score, não deve re-executar a análise
 * técnica — só a configuração do plano operacional muda". Task 13 (Fase 4.2) exigia ZERO rede;
 * task 14 (Fase 4.3) adiciona de propósito um debounce curto chamando `POST /reprice` — matemática
 * pura, mesma ausência de IA, então isto NÃO é uma regressão da garantia original, é a evolução
 * planejada dela (Fonte §38, "no onChangeEnd ou debounce curto, chamar endpoint de repricing").
 * Este teste evoluiu junto: continua provando ausência de qualquer chamada à IA/decisão/
 * `services/geminiService`, e agora prova especificamente que a ÚNICA chamada de rede permitida é
 * `reprecificar()` (services/api.ts), debounced (nunca uma chamada por pixel arrastado).
 */
describe('StopSlider só chama /reprice, nunca a IA, e sempre debounced', () => {
  const codigo = readFileSync(join(__dirname, '../components/StopSlider.tsx'), 'utf-8');

  it('nunca importa geminiService nem qualquer coisa relacionada a decisão/IA', () => {
    expect(codigo).not.toMatch(/from ['"]\.\.\/services\/geminiService['"]/);
    expect(codigo).not.toMatch(/DecisionProvider|analyzeChart|GraphicalAnalysisAttempt/);
  });

  it('não referencia fetch/axios/XMLHttpRequest cru — só a função reprecificar() importada', () => {
    expect(codigo).not.toMatch(/\bfetch\s*\(/);
    expect(codigo).not.toMatch(/\baxios\b/);
    expect(codigo).not.toMatch(/XMLHttpRequest/);
    expect(codigo).toMatch(/import \{ reprecificar, type RepriceResponse \} from ['"]\.\.\/services\/api['"]/);
  });

  it('a chamada de rede só acontece dentro de um debounce (setTimeout), nunca direto no onChange do slider', () => {
    // O handler do <input type="range"> (handleChange) nunca pode conter a chamada de rede —
    // só setStopEffective/onStopEffectiveChange, puramente locais.
    const handleChangeMatch = codigo.match(/const handleChange[\s\S]*?\n  \};/);
    expect(handleChangeMatch).not.toBeNull();
    expect(handleChangeMatch![0]).not.toMatch(/reprecificar/);

    // reprecificar() só pode ser chamada de dentro do corpo de um setTimeout (o debounce).
    const chamadaDentroDoDebounce = /setTimeout\([\s\S]*?reprecificar\([\s\S]*?\}, DEBOUNCE_MS\)/;
    expect(codigo).toMatch(chamadaDentroDoDebounce);
  });

  it('cancela o timer anterior a cada novo valor — nunca acumula chamadas em paralelo', () => {
    expect(codigo).toMatch(/clearTimeout\(debounceRef\.current\)/);
  });

  it('stop_effective nasce de useState local — o preview inicial nunca depende de uma resposta de rede', () => {
    expect(codigo).toMatch(/useState<number>\(stopRecommended\)/);
  });

  it('sem analysisUuid/plan/leverage/equity válidos, o efeito de debounce sai cedo sem chamar rede', () => {
    expect(codigo).toMatch(/if \(!analysisUuid \|\| !plan \|\| !hasValidNumber\(leverage\) \|\| !hasValidNumber\(equity\)\) {\s*\n\s*return;/);
  });
});
