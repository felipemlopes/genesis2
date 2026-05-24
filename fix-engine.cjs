const fs = require('fs');
let s = fs.readFileSync('services/indicatorEngine.ts', 'utf8');

const mapping = {
  calcularBollinger: '_calcularBollinger',
  calcularVWAP: '_calcularVWAP',
  calcularPDH_PDL: '_calcularPDH_PDL',
  calcularPWH_PWL: '_calcularPWH_PWL',
  identificarEqualHighs: '_identificarEqualHighs',
  identificarEqualLows: '_identificarEqualLows',
  detectarDivergenciaRSI: '_detectarDivergenciaRSI',
  detectarCompressaoVolatilidade: '_detectarCompressaoVolatilidade',
  calcularCVDSlope: '_calcularCVDSlope'
};

s = s.replace(/return \(\_[a-zA-Z_]+ as any\)\(\.\.\.args\);/g, (match, offset, full) => {
    let fnName = Object.keys(mapping).find(k => full.substring(offset-150, offset).includes(k));
    if (fnName) return `return (${mapping[fnName]} as any)(...args);`;
    return match;
});

s = s.replace(/return \_[a-zA-Z_]+\(\.\.\.args\);/g, (match, offset, full) => {
    let fnName = Object.keys(mapping).find(k => full.substring(offset-150, offset).includes(k));
    if (fnName) return `return (${mapping[fnName]} as any)(...args);`;
    return match;
});

fs.writeFileSync('services/indicatorEngine.ts', s);
