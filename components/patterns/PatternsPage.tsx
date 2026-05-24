
import React, { useState } from 'react';
import { PATTERNS_DB, PatternDef } from './PatternsData';
import PatternCard from './PatternCard';
import PatternModal from './PatternModal';
import { Shapes } from 'lucide-react';

const PatternsPage: React.FC = () => {
  const [selectedPattern, setSelectedPattern] = useState<PatternDef | null>(null);

  return (
    <div className="h-full flex flex-col bg-black overflow-y-auto custom-scrollbar p-6 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex items-center gap-[16px] mb-8 border-b border-white/5 pb-6">
         <div className="w-12 h-12 rounded-xl bg-genesis-accent/10 flex items-center justify-center border border-genesis-accent/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <Shapes size={24} className="text-genesis-accent" />
         </div>
         <div>
            <h1 className="text-2xl font-thin text-white tracking-widest uppercase">Figuras Gráficas</h1>
            <p className="text-xs text-gray-500 font-mono">Enciclopédia Visual de Padrões Técnicos</p>
         </div>
      </div>

      {/* GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pb-20">
         {PATTERNS_DB.map((pattern) => (
            <PatternCard 
               key={pattern.id} 
               pattern={pattern} 
               onClick={setSelectedPattern} 
            />
         ))}
      </div>

      {/* MODAL */}
      {selectedPattern && (
         <PatternModal 
            pattern={selectedPattern} 
            onClose={() => setSelectedPattern(null)} 
         />
      )}

    </div>
  );
};

export default PatternsPage;
