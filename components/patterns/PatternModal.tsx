
import React from 'react';
import { X, TrendingUp, AlertTriangle, Crosshair, Zap, BookOpen } from 'lucide-react';
import PatternIcon from './PatternIcon';
import { PatternDef } from './PatternsData';

interface PatternModalProps {
  pattern: PatternDef;
  onClose: () => void;
}

const PatternModal: React.FC<PatternModalProps> = ({ pattern, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80  p-[16px] animate-in fade-in duration-300">
      <div 
        className="w-full max-w-4xl bg-[#050505] border border-genesis-accent/30 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.15)] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-[16px]">
             <div className="w-10 h-10 rounded-full bg-genesis-accent/10 flex items-center justify-center border border-genesis-accent/20">
                <BookOpen size={20} className="text-genesis-accent" />
             </div>
             <div>
               <h2 className="text-xl font-bold text-white uppercase tracking-widest">{pattern.name}</h2>
               <span className="text-xs text-gray-500 font-mono">{pattern.category} Pattern</span>
             </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
           <div className="flex flex-col md:flex-row gap-8">
              
              {/* LEFT: VISUAL */}
              <div className="md:w-1/3 flex flex-col gap-6">
                 <div className="aspect-square bg-black border border-white/10 rounded-xl flex items-center justify-center p-8 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-genesis-accent/5 blur-3xl"></div>
                    <PatternIcon id={pattern.id} className="w-full h-full z-10 drop--[0_0_8px_rgba(139,92,246,0.8)]" />
                 </div>
                 
                 <div className="bg-white/5 rounded-[10px] p-[16px] border border-white/5">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <TrendingUp size={14} /> Tendência Esperada
                    </h4>
                    <p className={`text-sm font-mono font-bold ${pattern.trend.includes('Alta') || pattern.trend.includes('Bullish') ? 'text-genesis-positive' : (pattern.trend.includes('Baixa') || pattern.trend.includes('Bearish') ? 'text-genesis-negative' : 'text-yellow-400')}`}>
                       {pattern.trend}
                    </p>
                 </div>
              </div>

              {/* RIGHT: DATA */}
              <div className="md:w-2/3 space-y-6">
                 
                 <div>
                    <h3 className="text-white text-lg font-light mb-2">Definição Técnica</h3>
                    <p className="text-gray-400 text-sm leading-relaxed text-justify">
                       {pattern.fullDesc}
                    </p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                    <div className="bg-black border border-white/10 rounded-lg p-[16px]">
                       <h4 className="text-[10px] text-genesis-accent font-bold uppercase mb-2 flex items-center gap-2">
                          <Crosshair size={12} /> Formação
                       </h4>
                       <p className="text-xs text-gray-300 leading-relaxed">{pattern.formation}</p>
                    </div>
                    <div className="bg-black border border-white/10 rounded-lg p-[16px]">
                       <h4 className="text-[10px] text-genesis-accent font-bold uppercase mb-2 flex items-center gap-2">
                          <Zap size={12} /> Sinais de Confirmação
                       </h4>
                       <p className="text-xs text-gray-300 leading-relaxed">{pattern.signals}</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div>
                       <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Contexto Ideal</span>
                       <p className="text-xs text-gray-300 border-b border-white/20 pl-3">{pattern.context}</p>
                    </div>
                    
                    <div>
                       <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1 flex items-center gap-1">
                          <AlertTriangle size={10} className="text-orange-500" /> Riscos
                       </span>
                       <p className="text-xs text-gray-300 border-b border-orange-500/30 pl-3">{pattern.risks}</p>
                    </div>

                    <div>
                       <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Exemplo Real</span>
                       <p className="text-xs text-white font-mono bg-white/5 p-2 rounded">{pattern.example}</p>
                    </div>
                 </div>

              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default PatternModal;
