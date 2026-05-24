const fs = require('fs');
const file = 'services/geminiService.ts';
let code = fs.readFileSync(file, 'utf8');

const startMarker = 'const prompt = `\nVocê é o Gênesis 2.0, um analista técnico quantitativo e institucional de Elite.';
const endMarker = '    [OUTPUT JSON]';

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  const newPromptPreamble = `const prompt = \`Você é Genesis, analista quantitativo de derivativos cripto profissional.

Você recebeu um setup matemático já calculado pelo sistema. Sua função é APENAS gerar uma narrativa clara e profissional em português.

DADOS FORNECIDOS (não invente nada além destes):
- Ativo: \${cleanSymbol}
- Preço atual: \${realPrice}
- Regime: \${regimeResult.comments.join(', ')}
- Score: \${finalScoreRounded}/100
- Confiança: \${probScore.finalScore}%
- Direção: \${finalOperationalContext.direction}
- Setup: \${JSON.stringify(entryPlan)}
- Indicadores: \${JSON.stringify(metadata.detectedIndicators)}
- Contexto visual do trader: \${JSON.stringify(metadata.visualMarkings)}

REGRAS:
1. Máximo 200 palavras
2. Explique POR QUE o setup foi gerado, citando confluências entre dados técnicos e elementos visuais
3. Se a ação for AGUARDAR, explique o que falta para uma entrada
4. NUNCA invente números — use apenas os fornecidos acima
5. NUNCA sugira alterar o setup — ele já foi validado matematicamente
6. Tom profissional, direto, sem floreios

Se direcao for NEUTRO, o tom deve ser: "Mercado sem setup claro. Capital preservado."

`;
  
  code = code.substring(0, startIndex) + newPromptPreamble + code.substring(endIndex);
  fs.writeFileSync(file, code, 'utf8');
  console.log("Success");
} else {
  console.log("Failed to find markers", startIndex, endIndex);
}
