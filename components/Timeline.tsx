import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GeoEvent } from '../services/geopoliticalEngine';

interface TimelineProps {
  events: GeoEvent[];
  onEventClick: (event: GeoEvent) => void;
}

export const translateBias = (bias: string) => {
  const map: Record<string, string> = {
    'BULLISH': 'Alta (Bullish)',
    'BEARISH': 'Baixa (Bearish)',
    'RISK_OFF': 'Aversão ao Risco',
    'RISK_ON': 'Apetite ao Risco',
    'INFLATIONARY': 'Inflacionário',
    'DEFLATIONARY': 'Deflacionário',
    'SUPPLY_SHOCK': 'Choque de Oferta',
    'NEUTRAL': 'Neutro'
  };
  return map[bias] || bias;
};

export const Timeline: React.FC<TimelineProps> = ({ events, onEventClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayCount = isExpanded ? 15 : 3;

  return (
    <div className="w-80 max-h-[500px] overflow-y-auto bg-black/40 shadow-xl  rounded-2xl p-5 shadow-2xl pointer-events-auto flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">Event Feed</h3>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[9px] font-bold text-green-500/80 uppercase tracking-widest">Live</span>
        </div>
      </div>
      
      <div className="space-y-4 flex-1 overflow-y-auto pr-2">
        <AnimatePresence mode="popLayout">
          {events.slice(0, displayCount).map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: 30, filter: 'blur(10px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -30, filter: 'blur(10px)' }}
              onClick={() => onEventClick(ev)}
              className="group relative pl-4  hover: transition-all cursor-pointer py-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] font-mono text-gray-500">{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${
                  ev.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500' :
                  ev.severity === 'HIGH' ? 'bg-orange-500/10 text-orange-500' :
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {ev.category}
                </span>
              </div>
              <div className="text-[11px] font-bold text-white/80 group-hover:text-white transition-colors leading-tight mb-1">
                {ev.title}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold uppercase ${
                  ['BULLISH', 'RISK_ON'].includes(ev.market_impact.signal) ? 'text-green-500' : 
                  ['BEARISH', 'RISK_OFF', 'SUPPLY_SHOCK'].includes(ev.market_impact.signal) ? 'text-red-500' : 'text-blue-500'
                }`}>
                  {translateBias(ev.market_impact.signal)}
                </span>
                <span className="text-[9px] text-gray-500 font-medium truncate max-w-[120px]">
                  {ev.market_impact.asset}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {events.length > 3 && (
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full mt-4 pt-4  text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors shrink-0"
        >
          {isExpanded ? 'Recolher' : 'Expandir'}
        </button>
      )}
    </div>
  );
};
