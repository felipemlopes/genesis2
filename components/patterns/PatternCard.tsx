
import React, { useState } from 'react';
import PatternIcon from './PatternIcon';
import { PatternDef } from './PatternsData';

interface PatternCardProps {
  pattern: PatternDef;
  onClick: (pattern: PatternDef) => void;
}

const PatternCard: React.FC<PatternCardProps> = ({ pattern, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative group flex flex-col transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* MAIN CARD AREA */}
      <div 
        onClick={() => onClick(pattern)}
        className="bg-genesis-card border border-genesis-border-default rounded-[10px] p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative z-10 hover:-translate-y-1 hover:-[0_0_20px_rgba(139,92,246,0.15)] hover:border-genesis-accent/50"
      >
        
        {/* SVG CONTAINER */}
        <div className={`w-24 h-24 relative flex items-center justify-center transition-all duration-500 ${isHovered ? 'scale-110' : ''}`}>
           <div className={`absolute inset-0 bg-genesis-accent/5 rounded-full blur-xl transition-colors ${isHovered ? 'bg-genesis-accent/10' : ''}`}></div>
           
           <div className={`w-full h-full transition-all duration-500 ease-in-out ${isHovered ? 'blur-0' : 'blur-md'}`}>
             <PatternIcon id={pattern.id} className="w-full h-full" />
           </div>
        </div>

      </div>
    </div>
  );
};

export default PatternCard;
