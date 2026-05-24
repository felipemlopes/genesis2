
import React from 'react';

interface PatternIconProps {
  id: string;
  className?: string;
}

const PatternIcon: React.FC<PatternIconProps> = ({ id, className }) => {
  // Styles
  const strokePrice = "#8b5cf6"; // Neon Purple
  const strokeGuide = "#39FF14"; // Neon Green
  const glowFilter = "drop-(0 0 2px rgba(139, 92, 246, 0.5))";

  // Helper for generic paths to save space while maintaining distinct looks
  const getPath = (patternId: string) => {
    switch (patternId) {
      // --- REVERSAL HEAD & SHOULDERS FAMILY ---
      case 'head-shoulders':
        return (
          <>
            <path d="M5 60 L15 40 L25 60 L40 20 L55 60 L65 40 L75 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="0" y1="60" x2="80" y2="60" stroke={strokeGuide} strokeWidth="1.5" strokeDasharray="4 2" />
          </>
        );
      case 'inverse-head-shoulders':
        return (
          <>
            <path d="M5 20 L15 40 L25 20 L40 60 L55 20 L65 40 L75 20" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="0" y1="20" x2="80" y2="20" stroke={strokeGuide} strokeWidth="1.5" strokeDasharray="4 2" />
          </>
        );
      case 'complex-h-s':
        return (
          <>
            <path d="M2 60 L10 40 L18 60 L26 40 L34 60 L40 20 L46 60 L54 40 L62 60 L70 40 L78 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="0" y1="60" x2="80" y2="60" stroke={strokeGuide} strokeWidth="1.5" strokeDasharray="4 2" />
          </>
        );

      // --- DOUBLE/TRIPLE FAMILY ---
      case 'double-top':
      case 'adam-eve-double-top':
        return (
          <>
            <path d="M10 70 L25 20 L40 50 L55 20 L70 70" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="20" y1="20" x2="60" y2="20" stroke={strokeGuide} strokeWidth="1" strokeDasharray="2 2" />
            <line x1="10" y1="50" x2="70" y2="50" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'double-bottom':
      case 'adam-eve-double-bottom':
      case 'dragon-pattern':
        return (
          <>
            <path d="M10 10 L25 60 L40 30 L55 60 L70 10" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="30" x2="70" y2="30" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'triple-top':
        return (
          <>
            <path d="M5 70 L15 20 L27 50 L40 20 L53 50 L65 20 L75 70" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="20" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1" strokeDasharray="4 2" />
          </>
        );
      case 'triple-bottom':
        return (
          <>
            <path d="M5 10 L15 60 L27 30 L40 60 L53 30 L65 60 L75 10" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="60" x2="70" y2="60" stroke={strokeGuide} strokeWidth="1" strokeDasharray="4 2" />
          </>
        );

      // --- WEDGES ---
      case 'rising-wedge':
      case 'rising-wedge-rev':
        return (
          <>
            <path d="M10 70 L20 30 L30 60 L45 25 L55 50 L70 20" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="70" x2="70" y2="45" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="20" y1="30" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );
      case 'falling-wedge':
      case 'falling-wedge-rev':
        return (
          <>
            <path d="M10 10 L20 50 L30 20 L45 55 L55 30 L70 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="10" x2="70" y2="35" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="20" y1="50" x2="70" y2="60" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );

      // --- FLAGS/PENNANTS ---
      case 'bull-flag':
      case 'high-tight-flag':
        return (
          <>
            <path d="M10 70 L10 20 L25 30 L40 25 L55 35 L55 20" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="20" x2="55" y2="30" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="35" x2="55" y2="45" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'bear-flag':
        return (
          <>
            <path d="M10 10 L10 60 L25 50 L40 55 L55 45 L55 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="60" x2="55" y2="50" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="45" x2="55" y2="35" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'bull-pennant':
        return (
          <>
            <path d="M10 70 L10 20 L30 35 L50 25 L60 30" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="20" x2="60" y2="30" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="50" x2="60" y2="30" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'bear-pennant':
        return (
          <>
            <path d="M10 10 L10 60 L30 45 L50 55 L60 50" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="60" x2="60" y2="50" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="30" x2="60" y2="50" stroke={strokeGuide} strokeWidth="1" />
          </>
        );

      // --- TRIANGLES ---
      case 'asc-triangle':
        return (
          <>
            <path d="M10 60 L25 20 L40 60 L55 20 L70 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="20" y1="20" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="10" y1="60" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1.5" strokeDasharray="4 2" opacity="0.5" />
            <line x1="10" y1="60" x2="70" y2="60" stroke="transparent" /> {/* Spacer */}
            <line x1="10" y1="60" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );
      case 'desc-triangle':
        return (
          <>
            <path d="M10 20 L25 60 L40 20 L55 60 L70 20" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="20" y1="60" x2="70" y2="60" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="10" y1="20" x2="70" y2="60" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );
      case 'sym-triangle':
        return (
          <>
            <path d="M10 10 L25 70 L40 20 L55 60 L70 40" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="10" x2="70" y2="40" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="25" y1="70" x2="70" y2="40" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );
      case 'expanding-triangle':
      case 'broadening-top':
      case 'broadening-bottom':
        return (
          <>
            <path d="M10 40 L25 30 L40 50 L55 20 L70 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="40" x2="70" y2="10" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="10" y1="40" x2="70" y2="70" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );

      // --- CHANNELS/RECTANGLES ---
      case 'ascending-channel':
        return (
          <>
            <path d="M10 50 L25 20 L40 60 L55 30 L70 70" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="60" x2="70" y2="80" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="10" x2="70" y2="30" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'descending-channel':
        return (
          <>
            <path d="M10 30 L25 70 L40 20 L55 60 L70 10" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="10" x2="70" y2="0" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="80" x2="70" y2="70" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      case 'rectangle-bull':
      case 'rectangle-bear':
      case 'consolidation-box':
        return (
          <>
            <path d="M10 60 L10 20 L25 60 L40 20 L55 60 L70 20 L70 60" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="20" x2="70" y2="20" stroke={strokeGuide} strokeWidth="1.5" />
            <line x1="10" y1="60" x2="70" y2="60" stroke={strokeGuide} strokeWidth="1.5" />
          </>
        );

      // --- ROUNDED ---
      case 'rounding-bottom':
      case 'cup-handle':
        return (
          <>
            <path d="M10 10 Q 40 80 70 30 L 75 40 L 80 30" stroke={strokePrice} strokeWidth="2" fill="none" />
            <path d="M10 20 Q 40 90 70 40" stroke={strokeGuide} strokeWidth="1" strokeDasharray="2 2" fill="none" opacity="0.5"/>
          </>
        );
      case 'rounding-top':
      case 'inv-cup-handle':
      case 'parabolic-arc':
        return (
          <>
            <path d="M10 70 Q 40 0 70 50 L 75 40 L 80 50" stroke={strokePrice} strokeWidth="2" fill="none" />
            <path d="M10 60 Q 40 -10 70 40" stroke={strokeGuide} strokeWidth="1" strokeDasharray="2 2" fill="none" opacity="0.5"/>
          </>
        );

      // --- DIAMOND ---
      case 'diamond-top':
        return (
          <>
            <path d="M10 40 L30 10 L50 70 L70 40" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="10" y1="40" x2="40" y2="10" stroke={strokeGuide} strokeWidth="1" />
            <line x1="40" y1="10" x2="70" y2="40" stroke={strokeGuide} strokeWidth="1" />
            <line x1="10" y1="40" x2="40" y2="70" stroke={strokeGuide} strokeWidth="1" />
            <line x1="40" y1="70" x2="70" y2="40" stroke={strokeGuide} strokeWidth="1" />
          </>
        );

      // --- SPECIAL/CANDLES ---
      case 'three-black-crows':
        return (
          <>
            <rect x="20" y="10" width="10" height="20" fill={strokePrice} opacity="0.8" />
            <rect x="35" y="25" width="10" height="20" fill={strokePrice} opacity="0.8" />
            <rect x="50" y="40" width="10" height="20" fill={strokePrice} opacity="0.8" />
          </>
        );
      case 'three-white-soldiers':
        return (
          <>
            <rect x="20" y="40" width="10" height="20" stroke={strokeGuide} fill="none" strokeWidth="2" />
            <rect x="35" y="25" width="10" height="20" stroke={strokeGuide} fill="none" strokeWidth="2" />
            <rect x="50" y="10" width="10" height="20" stroke={strokeGuide} fill="none" strokeWidth="2" />
          </>
        );
      case 'v-top':
        return (
          <>
            <path d="M10 70 L40 10 L70 70" stroke={strokePrice} strokeWidth="2" fill="none" />
          </>
        );
      case 'v-bottom':
        return (
          <>
            <path d="M10 10 L40 70 L70 10" stroke={strokePrice} strokeWidth="2" fill="none" />
          </>
        );
      case 'bump-run':
        return (
          <>
            <path d="M5 70 Q 30 60 50 10 L 60 40 L 75 20" stroke={strokePrice} strokeWidth="2" fill="none" />
            <line x1="5" y1="75" x2="80" y2="60" stroke={strokeGuide} strokeWidth="1" />
          </>
        );
      
      // Default / Others
      default:
        return (
          <>
            <path d="M10 60 L20 20 L30 50 L40 30 L50 60 L60 40 L70 70" stroke={strokePrice} strokeWidth="2" fill="none" />
            <rect x="5" y="5" width="70" height="70" stroke={strokeGuide} strokeWidth="0.5" fill="none" opacity="0.3" />
          </>
        );
    }
  };

  return (
    <svg 
      viewBox="0 0 80 80" 
      className={`${className} overflow-visible`} 
      style={{ filter: glowFilter }}
    >
      {getPath(id)}
    </svg>
  );
};

export default PatternIcon;
