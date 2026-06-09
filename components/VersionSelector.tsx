import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Terminal, ArrowRight } from 'lucide-react';

export interface VersionSelectorProps {
  onSelectVersion?: (version: 1 | 2) => void;
}

const VersionSelector: React.FC<VersionSelectorProps> = ({ onSelectVersion }) => {
  const navigate = useNavigate();
  const v1Url = import.meta.env.VITE_V1_URL;

  const handleSelect = (version: 1 | 2) => {
    onSelectVersion?.(version);
    if (version === 1) {
      window.location.href = v1Url;
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Background 3D orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-[-10%] left-[-10%] w-[60%] h-[70%] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(176,38,255,0.06) 0%, transparent 70%)' }}
          animate={{ x: [0, 30, -20, 0], y: [0, -40, 20, 0], scale: [1, 1.1, 0.95, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[70%] rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)' }}
          animate={{ x: [0, -25, 35, 0], y: [0, 30, -25, 0], scale: [1, 0.95, 1.08, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center gap-3 mb-16"
        >
          <div className="w-10 h-10 rounded-xl border border-white/5 flex items-center justify-center bg-genesis-accent/5 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
            <Terminal size={18} className="text-genesis-accent" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-bold text-xl text-white" style={{ letterSpacing: '-0.01em' }}>Gênesis</span>
            <span className="font-medium text-[10px] text-gray-500 uppercase" style={{ letterSpacing: '0.12em' }}>Labs</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-center mb-12"
        >
          <p className="text-[10px] font-bold text-genesis-accent uppercase tracking-[0.4em] mb-3">Selecione a versão</p>
          <h1 className="text-3xl md:text-4xl font-light text-white tracking-tight">Qual plataforma deseja acessar?</h1>
        </motion.div>

        {/* Version cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Version 1 card */}
          <VersionCard
            version={1}
            title="Gênesis 1.0"
            subtitle="Versão Clássica"
            description="Plataforma original com análise técnica via IA, scanner de oportunidades e gestão de operações."
            badge="Estável"
            badgeColor="text-genesis-positive"
            delay={0.2}
            onSelect={() => handleSelect(1)}
          />

          {/* Version 2 card */}
          <VersionCard
            version={2}
            title="Gênesis 2.0"
            subtitle="Beta"
            description="Nova geração com dashboard modular, radar geopolítico, monitoramento on-chain e muito mais."
            badge="Beta"
            badgeColor="text-genesis-accent"
            delay={0.35}
            onSelect={() => handleSelect(2)}
            highlighted
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 text-[9px] text-gray-600 font-mono uppercase tracking-widest"
        >
          Plataforma Educacional • Não constitui recomendação de investimento
        </motion.p>
      </div>
    </div>
  );
};

interface VersionCardProps {
  version: 1 | 2;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  delay: number;
  onSelect: () => void;
  highlighted?: boolean;
}

const VersionCard: React.FC<VersionCardProps> = ({
  version,
  title,
  subtitle,
  description,
  badge,
  badgeColor,
  delay,
  onSelect,
  highlighted = false,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    className="relative group cursor-pointer min-h-[420px] flex flex-col"
    onClick={onSelect}
  >
    {/* Neon border blur layer */}
    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
      <div className={`absolute inset-0 rounded-2xl blur-[6px] bg-gradient-to-r ${highlighted ? 'from-genesis-accent/0 via-genesis-accent/20 to-genesis-accent/0' : 'from-genesis-positive/0 via-genesis-positive/15 to-genesis-positive/0'}`} />
    </div>

    {/* Solid border card */}
    <div className={`relative flex flex-col flex-1 rounded-2xl border bg-genesis-card p-10 transition-all duration-500
      group-hover:-translate-y-1
      ${highlighted
        ? 'border-genesis-accent/20 group-hover:shadow-[0_0_60px_rgba(176,38,255,0.3)]'
        : 'border-white/5 group-hover:shadow-[0_0_60px_rgba(57,255,20,0.2)]'
      }`}
    >
      {/* Shimmer on hover */}
      <div className="shimmer-hover" />

      {/* Expanding line on hover */}
      <div className={`absolute bottom-0 left-0 h-px w-0 group-hover:w-full transition-all duration-500 rounded-full
        ${highlighted ? 'bg-gradient-to-r from-genesis-accent/0 via-genesis-accent to-genesis-accent/0' : 'bg-gradient-to-r from-genesis-positive/0 via-genesis-positive to-genesis-positive/0'}`}
      />

      {/* Logo placeholder with shimmer */}
      <div className="relative overflow-hidden w-14 h-14 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center mb-8">
        <div className="shimmer-effect" />
        <span className="text-2xl font-bold text-white/20 select-none">{version}</span>
      </div>

      {/* Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[9px] font-bold uppercase tracking-[0.3em] ${badgeColor}`}>{badge}</span>
        <span className="w-1 h-1 rounded-full bg-white/10" />
        <span className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">{subtitle}</span>
      </div>

      <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">{title}</h2>
      <p className="text-sm text-gray-500 leading-relaxed font-light flex-1">{description}</p>

      {/* CTA */}
      <div className={`mt-8 relative overflow-hidden flex items-center justify-center gap-2 py-3 px-6 rounded-xl border text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300
        ${highlighted
          ? 'border-genesis-accent/20 text-genesis-accent bg-genesis-accent/5 group-hover:bg-genesis-accent/10'
          : 'border-white/5 text-white/50 bg-white/[0.02] group-hover:text-white group-hover:border-white/10'
        }`}
      >
        <span className="shimmer-effect opacity-0 group-hover:opacity-100" />
        Acessar
        <ArrowRight size={13} className="transition-transform duration-300 group-hover:translate-x-1" />
      </div>
    </div>
  </motion.div>
);

export default VersionSelector;
