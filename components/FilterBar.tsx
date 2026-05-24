import React from 'react';
import { Category } from '../services/geopoliticalEngine';

interface FilterBarProps {
  onCategoryChange: (category: Category | 'ALL') => void;
  onTimeChange: (time: '15m' | '1h' | '6h' | '24h') => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ onCategoryChange, onTimeChange }) => {
  const categories: (Category | 'ALL')[] = ['ALL', 'WAR', 'ENERGY', 'SHIPPING', 'TRADE', 'MILITARY', 'DIPLOMACY'];
  const times: ('15m' | '1h' | '6h' | '24h')[] = ['15m', '1h', '6h', '24h'];

  return (
    <div className="flex flex-col gap-[16px] bg-black/40 shadow-xl  p-[16px] rounded-2xl shadow-2xl">
      <div className="space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Categorias</div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className="px-3 py-1.5 bg-white/5  rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white hover: transition-all"
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-2">Janela Temporal</div>
        <div className="flex gap-2">
          {times.map(time => (
            <button
              key={time}
              onClick={() => onTimeChange(time)}
              className="px-3 py-1.5 bg-white/5  rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-white/10 hover:text-white hover: transition-all"
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
