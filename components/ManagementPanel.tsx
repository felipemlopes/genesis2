import React from 'react';
import { Briefcase } from 'lucide-react';

export default function ManagementPanel() {
  return (
    <div className="h-full custom-scrollbar p-6 bg-genesis-base text-white flex flex-col items-center justify-center">
      <div className="bg-genesis-input rounded-[8px] p-[12px_14px]  rounded-[10px] p-[16px] flex flex-col items-center text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-yellow-500/30 flex items-center justify-center mb-6">
          <Briefcase className="text-yellow-400" size={32} />
        </div>
        <h1 className="text-xl font-light tracking-widest uppercase mb-2">Gestão Bybit</h1>
        <p className="text-sm text-gray-400">Esta funcionalidade foi desativada conforme solicitado.</p>
      </div>
    </div>
  );
}
