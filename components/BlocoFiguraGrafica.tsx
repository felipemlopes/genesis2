import React from 'react';
import type { VisualPattern } from '../types/graphicalAnalysis';

/**
 * V6.6 (A04): visual_observations.patterns chegava na resposta HTTP e era descartado no adaptador
 * (services/geminiService.ts) — nenhum componente da tela renderizava figura, mesmo numa análise em
 * que o Gemini identificasse um padrão com 0,90 de confiança (ver A01-A03, correção do canal que
 * carrega a figura até aqui). Catálogo de nomes completo (as 50 figuras de
 * App\Support\GenesisVisualCatalogV6::PATTERNS), conforme DF-04.
 */
const NOME_FIGURA: Record<string, string> = {
  DOUBLE_TOP: 'Topo Duplo',
  DOUBLE_BOTTOM: 'Fundo Duplo',
  TRIPLE_TOP: 'Topo Triplo',
  TRIPLE_BOTTOM: 'Fundo Triplo',
  HEAD_AND_SHOULDERS: 'Ombro-Cabeça-Ombro',
  INVERSE_HEAD_AND_SHOULDERS: 'Ombro-Cabeça-Ombro Invertido',
  ASCENDING_TRIANGLE: 'Triângulo Ascendente',
  DESCENDING_TRIANGLE: 'Triângulo Descendente',
  SYMMETRICAL_TRIANGLE: 'Triângulo Simétrico',
  RISING_WEDGE: 'Cunha Ascendente',
  FALLING_WEDGE: 'Cunha Descendente',
  BULL_FLAG: 'Bandeira de Alta',
  BEAR_FLAG: 'Bandeira de Baixa',
  BULL_PENNANT: 'Flâmula de Alta',
  BEAR_PENNANT: 'Flâmula de Baixa',
  ASCENDING_CHANNEL: 'Canal Ascendente',
  DESCENDING_CHANNEL: 'Canal Descendente',
  HORIZONTAL_CHANNEL: 'Canal Horizontal',
  BULLISH_RECTANGLE: 'Retângulo de Alta',
  BEARISH_RECTANGLE: 'Retângulo de Baixa',
  CUP_AND_HANDLE: 'Xícara com Alça',
  INVERTED_CUP_AND_HANDLE: 'Xícara com Alça Invertida',
  ROUNDING_BOTTOM: 'Fundo Arredondado',
  ROUNDING_TOP: 'Topo Arredondado',
  DIAMOND_TOP: 'Diamante de Topo',
  DIAMOND_BOTTOM: 'Diamante de Fundo',
  BROADENING_TOP: 'Topo em Alargamento',
  BROADENING_BOTTOM: 'Fundo em Alargamento',
  MEGAPHONE: 'Megafone',
  BUMP_AND_RUN_BULLISH: 'Bump and Run de Alta',
  BUMP_AND_RUN_BEARISH: 'Bump and Run de Baixa',
  GARTLEY_BULLISH: 'Gartley de Alta',
  GARTLEY_BEARISH: 'Gartley de Baixa',
  BAT_BULLISH: 'Bat de Alta',
  BAT_BEARISH: 'Bat de Baixa',
  BUTTERFLY_BULLISH: 'Borboleta de Alta',
  BUTTERFLY_BEARISH: 'Borboleta de Baixa',
  CRAB_BULLISH: 'Crab de Alta',
  CRAB_BEARISH: 'Crab de Baixa',
  CYPHER_BULLISH: 'Cypher de Alta',
  CYPHER_BEARISH: 'Cypher de Baixa',
  SHARK_BULLISH: 'Shark de Alta',
  SHARK_BEARISH: 'Shark de Baixa',
  ABCD_BULLISH: 'ABCD de Alta',
  ABCD_BEARISH: 'ABCD de Baixa',
  WOLFE_WAVE_BULLISH: 'Onda de Wolfe de Alta',
  WOLFE_WAVE_BEARISH: 'Onda de Wolfe de Baixa',
  QUASIMODO_BULLISH: 'Quasimodo de Alta',
  QUASIMODO_BEARISH: 'Quasimodo de Baixa',
  INVERSE_QUASIMODO: 'Quasimodo Invertido',
};

const ESTADO: Record<string, string> = {
  FORMING: 'Em formação',
  TESTING: 'Em teste',
  BREAKING: 'Em rompimento',
  RETESTING: 'Em reteste',
  CONFIRMED: 'Confirmada',
};

interface Props {
  figuras: VisualPattern[];
}

const BlocoFiguraGrafica: React.FC<Props> = ({ figuras }) => {
  // DP-07: sem figura clara no gráfico, o campo vem vazio — ausência não é erro nem lacuna visual.
  if (!figuras || figuras.length === 0) {
    return null;
  }

  return (
    <section className="mt-6">
      <h3 className="text-xs tracking-widest text-zinc-500 uppercase mb-2">
        Figura Identificada
      </h3>
      {figuras.map((f, i) => (
        <div key={i} className="flex items-baseline gap-3 py-1">
          <span className="text-sm text-white font-semibold">
            {NOME_FIGURA[f.id] ?? f.id}
          </span>
          <span className="text-xs text-zinc-400">{ESTADO[f.state] ?? f.state}</span>
        </div>
      ))}
    </section>
  );
};

export default BlocoFiguraGrafica;
