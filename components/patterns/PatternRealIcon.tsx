
import React from 'react';

interface PatternRealIconProps {
  id: string;
  className?: string;
}

const PatternRealIcon: React.FC<PatternRealIconProps> = ({ id, className }) => {
  
  // --- ASSET MANAGER: Real Chart Images ---
  // Gera uma imagem única e realista para cada padrão usando seeding pelo ID.
  // Garante unicidade e estética Dark Mode profissional.
  const getPatternImageUrl = (patternId: string) => {
      
      // --- MANUAL OVERRIDES (Assets Específicos) ---
      // Substituição manual conforme solicitado para figuras específicas
      const customAssets: Record<string, string> = {
          // Atualizado conforme solicitação: Double Top com Neckline Amarela e Seta de Queda
          'double-top': 'https://image.pollinations.ai/prompt/candlestick%20chart%20pattern%20Double%20Top%20formation%20M%20shape%20with%20bright%20yellow%20neckline%20support%20line%20and%20yellow%20arrow%20pointing%20down%20breakout%20dark%20theme%20trading%20view?width=800&height=400&nologo=true&seed=551'
      };

      if (customAssets[patternId]) {
          return customAssets[patternId];
      }

      // Prompt otimizado para gerar gráficos de candlestick técnicos e limpos (Default)
      const seed = patternId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return `https://image.pollinations.ai/prompt/trading%20chart%20candlestick%20pattern%20${patternId.replace(/-/g, '%20')}%20dark%20mode%20minimalist%20crypto?width=800&height=400&nologo=true&seed=${seed}`;
  };

  // --- OVERLAY ENGINE (MANTIDO E OTIMIZADO) ---
  // Desenha o guia neon sobre a imagem real
  const getOverlay = (pid: string) => {
      const sColor = "#39FF14"; // Suporte/Alta (Verde Neon)
      const rColor = "#8b5cf6"; // Resistência/Baixa (Roxo Neon)
      const lineStyle = { strokeWidth: 3, strokeLinecap: "round" as const, fill: "none", filter: "drop-(0 0 4px rgba(0,0,0,0.8))" };
      const guideStyle = { strokeWidth: 2, strokeDasharray: "6,4", opacity: 0.9, fill: "none", filter: "drop-(0 0 2px rgba(0,0,0,1))" };

      switch(pid) {
          // --- HEAD & SHOULDERS ---
          case 'head-shoulders': 
            return <path d="M5 80 L20 40 L30 70 L50 10 L70 70 L80 40 L95 95" stroke={sColor} {...lineStyle} />;
          case 'inverse-head-shoulders': 
            return <path d="M5 20 L20 60 L30 30 L50 90 L70 30 L80 60 L95 5" stroke={rColor} {...lineStyle} />;
          case 'complex-h-s': 
             return <path d="M5 80 L15 40 L25 70 L35 45 L50 10 L65 70 L80 40 L95 90" stroke={sColor} {...lineStyle} />;

          // --- DOUBLE/TRIPLE ---
          case 'double-top': 
            return (
                <>
                    <path d="M5 90 L25 20 L50 70 L75 20 L95 90" stroke={rColor} {...lineStyle} />
                    <line x1="15" y1="20" x2="85" y2="20" stroke={sColor} {...guideStyle} />
                </>
            );
          case 'double-bottom': 
            return (
                <>
                    <path d="M5 10 L25 80 L50 30 L75 80 L95 10" stroke={sColor} {...lineStyle} />
                    <line x1="15" y1="80" x2="85" y2="80" stroke={rColor} {...guideStyle} />
                </>
            );
          case 'triple-top': 
             return (
                 <>
                    <path d="M5 90 L20 20 L35 70 L50 20 L65 70 L80 20 L95 90" stroke={rColor} {...lineStyle} />
                    <line x1="10" y1="20" x2="90" y2="20" stroke={sColor} {...guideStyle} />
                 </>
             );
          case 'triple-bottom': 
             return (
                 <>
                    <path d="M5 10 L20 80 L35 30 L50 80 L65 30 L80 80 L95 10" stroke={sColor} {...lineStyle} />
                    <line x1="10" y1="80" x2="90" y2="80" stroke={rColor} {...guideStyle} />
                 </>
             );
          case 'adam-eve-double-bottom': 
             return <path d="M5 10 L25 80 L40 40 Q 60 100 80 70 L95 10" stroke={sColor} {...lineStyle} />;
          case 'adam-eve-double-top': 
             return <path d="M5 90 L25 20 L40 60 Q 60 0 80 30 L95 90" stroke={rColor} {...lineStyle} />;

          // --- TRIANGLES ---
          case 'asc-triangle': 
            return (
                <>
                    <line x1="30" y1="20" x2="95" y2="20" stroke={rColor} {...guideStyle} />
                    <line x1="5" y1="85" x2="80" y2="35" stroke={sColor} {...lineStyle} />
                </>
            );
          case 'desc-triangle': 
            return (
                <>
                    <line x1="5" y1="15" x2="80" y2="65" stroke={rColor} {...lineStyle} />
                    <line x1="30" y1="75" x2="95" y2="75" stroke={sColor} {...guideStyle} />
                </>
            );
          case 'sym-triangle': 
            return (
                <>
                    <line x1="5" y1="20" x2="85" y2="45" stroke={rColor} {...lineStyle} />
                    <line x1="5" y1="80" x2="85" y2="45" stroke={sColor} {...lineStyle} />
                </>
            );
          case 'expanding-triangle': 
            return (
                <>
                    <line x1="25" y1="40" x2="95" y2="10" stroke={rColor} {...lineStyle} />
                    <line x1="25" y1="60" x2="95" y2="90" stroke={sColor} {...lineStyle} />
                </>
            );

          // --- WEDGES ---
          case 'rising-wedge': 
          case 'rising-wedge-rev':
            return (
                <>
                    <line x1="25" y1="50" x2="95" y2="30" stroke={rColor} {...guideStyle} />
                    <line x1="5" y1="90" x2="95" y2="55" stroke={sColor} {...lineStyle} />
                </>
            );
          case 'falling-wedge': 
          case 'falling-wedge-rev':
            return (
                <>
                    <line x1="5" y1="10" x2="95" y2="45" stroke={rColor} {...lineStyle} />
                    <line x1="25" y1="50" x2="95" y2="70" stroke={sColor} {...guideStyle} />
                </>
            );

          // --- FLAGS / PENNANTS ---
          case 'bull-flag': 
            return (
                <>
                    <line x1="5" y1="95" x2="20" y2="20" stroke={sColor} strokeWidth="4" opacity="0.8" />
                    <line x1="20" y1="20" x2="70" y2="40" stroke={rColor} {...guideStyle} />
                    <line x1="20" y1="40" x2="70" y2="60" stroke={sColor} {...lineStyle} />
                </>
            );
          case 'bear-flag': 
            return (
                <>
                    <line x1="5" y1="5" x2="20" y2="80" stroke={rColor} strokeWidth="4" opacity="0.8" />
                    <line x1="20" y1="80" x2="70" y2="60" stroke={sColor} {...guideStyle} />
                    <line x1="20" y1="60" x2="70" y2="40" stroke={rColor} {...lineStyle} />
                </>
            );
          case 'bull-pennant': 
            return (
                <>
                    <line x1="5" y1="95" x2="20" y2="20" stroke={sColor} strokeWidth="4" opacity="0.8" />
                    <polygon points="20,20 80,35 20,55" stroke={rColor} {...guideStyle} />
                </>
            );
          case 'bear-pennant': 
            return (
                <>
                    <line x1="5" y1="5" x2="20" y2="80" stroke={rColor} strokeWidth="4" opacity="0.8" />
                    <polygon points="20,80 80,65 20,45" stroke={sColor} {...guideStyle} />
                </>
            );
          case 'high-tight-flag': 
             return (
                 <>
                    <line x1="5" y1="95" x2="25" y2="10" stroke={sColor} strokeWidth="4" opacity="0.8" />
                    <rect x="25" y="10" width="50" height="15" stroke={rColor} {...guideStyle} />
                 </>
             );

          // --- CHANNELS / RECTANGLES ---
          case 'ascending-channel': 
            return (
                <>
                    <line x1="25" y1="40" x2="95" y2="20" stroke={rColor} {...guideStyle} />
                    <line x1="5" y1="80" x2="85" y2="60" stroke={sColor} {...lineStyle} />
                </>
            );
          case 'descending-channel': 
            return (
                <>
                    <line x1="5" y1="20" x2="85" y2="40" stroke={rColor} {...lineStyle} />
                    <line x1="25" y1="60" x2="95" y2="80" stroke={sColor} {...guideStyle} />
                </>
            );
          case 'rectangle-bull': 
          case 'rectangle-bear': 
          case 'consolidation-box': 
            return (
                <>
                    <line x1="10" y1="30" x2="90" y2="30" stroke={rColor} {...guideStyle} />
                    <line x1="10" y1="70" x2="90" y2="70" stroke={sColor} {...guideStyle} />
                </>
            );

          // --- ROUNDED / OTHERS ---
          case 'cup-handle': 
             return <path d="M5 10 Q 40 90 75 20 L 85 35" stroke={sColor} {...lineStyle} />;
          case 'inv-cup-handle': 
             return <path d="M5 90 Q 40 10 75 80 L 85 65" stroke={rColor} {...lineStyle} />;
          case 'diamond-top': 
             return <polygon points="5,50 50,10 95,50 50,90" stroke={rColor} {...lineStyle} />;
          case 'bump-run': 
             return <path d="M5 80 Q 30 70 60 10 L 80 80" stroke={sColor} {...lineStyle} />;
          case 'parabolic-arc':
             return <path d="M5 95 Q 60 90 95 5" stroke={sColor} {...lineStyle} />;
          case 'v-top':
             return <polyline points="5,90 50,5 95,90" stroke={rColor} {...lineStyle} />;
          case 'v-bottom':
             return <polyline points="5,10 50,95 95,10" stroke={sColor} {...lineStyle} />;

          // DEFAULT
          default: 
             return <line x1="5" y1="50" x2="95" y2="50" stroke="white" strokeDasharray="4,4" opacity="0.5" />;
      }
  };

  const overlay = getOverlay(id);
  const imageUrl = getPatternImageUrl(id);

  return (
    <div className={`w-full h-48 bg-[#0a0a0a] rounded-lg border border-white/10 relative overflow-hidden flex items-center justify-center group ${className}`}>
        
        {/* ASSET REAL: IMAGEM DE FUNDO */}
        <div className="absolute inset-0 z-0">
            <img 
                src={imageUrl} 
                alt="Gráfico Real"
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity duration-500 scale-105 group-hover:scale-100"
                loading="lazy"
            />
            {/* Vinheta para focar no centro */}
            <div className="absolute inset-0     opacity-80"></div>
            <div className="absolute inset-0 bg-black/20"></div>
        </div>

        {/* OVERLAY NEON: DESENHO TÉCNICO SOBREPOSTO */}
        <svg viewBox="0 0 100 100" className="w-full h-full px-8 py-4 overflow-visible relative z-10 drop--2xl">
            {overlay}
        </svg>

        {/* ETIQUETA "REAL CHART" */}
        <div className="absolute top-2 right-2 bg-black/60  border border-white/10 px-2 py-1 rounded text-[8px] font-bold text-gray-400 uppercase tracking-widest z-20">
            Real Chart
        </div>
    </div>
  );
};

export default PatternRealIcon;
