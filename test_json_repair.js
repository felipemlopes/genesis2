const jsonText = `{
  "pair": "EIGEN/USDT",
  "direction": "NEUTRAL",
  "confidence": 60,
  "structuralScore": 60,
  "flowScore": 0,
  "derivativesScore": 0,
  "riskScore": 0,
  "confidenceRationale": "Mercado em regime lateral ou de consolidação. Planos de entrada com validade fraca.",
  "entryPrice": "Plano A: $0\\nPlano B: $0",
  "leverage": 1,
  "stopLoss": "$0",
  "takeProfit1": "$0",
  "takeProfit2": "$0",
  "takeProfit3": "$0",
  "rationale": "Mercado sem setup claro.",
  "patternDetected": "Consolidação",
  "externalFactors": "N/A",
  "socialSentiment": {
    "score": 50,
    "description": "N/A",
    "pros": [],
    "cons":`;

let temp = jsonText.trim();
let inString = false;
let escape = false;
for (let i = 0; i < temp.length; i++) {
    if (escape) { escape = false; continue; }
    if (temp[i] === '\\') { escape = true; continue; }
    if (temp[i] === '"') { inString = !inString; continue; }
}
if (inString) temp += '"';

temp = temp.trim();
if (temp.endsWith(',')) temp = temp.slice(0, -1);
if (temp.endsWith(':')) temp += ' null';

let openBraces = 0, closeBraces = 0;
let openBrackets = 0, closeBrackets = 0;
inString = false;
escape = false;
for (let i = 0; i < temp.length; i++) {
    if (escape) { escape = false; continue; }
    if (temp[i] === '\\') { escape = true; continue; }
    if (temp[i] === '"') { inString = !inString; continue; }
    if (!inString) {
        if (temp[i] === '{') openBraces++;
        if (temp[i] === '}') closeBraces++;
        if (temp[i] === '[') openBrackets++;
        if (temp[i] === ']') closeBrackets++;
    }
}

while (closeBrackets < openBrackets) { temp += ']'; closeBrackets++; }
while (closeBraces < openBraces) { temp += '}'; closeBraces++; }

console.log("Repaired:\n", temp);
console.log("Valid JSON?", !!JSON.parse(temp));
