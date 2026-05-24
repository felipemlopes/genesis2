const fs = require('fs');

let content = fs.readFileSync('services/indicatorEngine.ts', 'utf8');

// We will find "export const FUNCTION_NAME = (args...) => {" and replace it with:
// "export const FUNCTION_NAME = (args...) : return type => { try { ..."

// Actually, an easier way is to literally rename the exports:
// "export const calcularEMA =" -> "const _calcularEMA ="
// Then at the bottom add:
// export const calcularEMA = (...args) => { try { return _calcularEMA(...args); } catch(e) { console.error(`[calcularEMA] Erro:`, args); return null; } }

const funcNames = [
    'calcularEMA', 'calcularRSI', 'calcularATR', 'calcularADX', 'calcularMACD', 'calcularBollinger',
    'calcularVWAP', 'calcularPDH_PDL', 'calcularPWH_PWL', 'identificarEqualHighs', 'identificarEqualLows',
    'detectarDivergenciaRSI', 'detectarCompressaoVolatilidade', 'calcularCVDSlope'
];

for(let fn of funcNames) {
    content = content.replace(`export const ${fn} =`, `const _${fn} =`);
}

let exportsCode = `\n// --- WRAPPERS DE SEGURANÇA ---\n`;
for(let fn of funcNames) {
    exportsCode += `
export const ${fn} = (...args: any[]): any => {
    try {
        return _${fn}(...args);
    } catch(e) {
        console.error(\`[\${"${fn}"}] Falha inesperada. Parâmetros recebidos:\`, args, e);
        return null;
    }
};
`;
}

content += exportsCode;

fs.writeFileSync('services/indicatorEngine.ts', content);
console.log('Done!');
