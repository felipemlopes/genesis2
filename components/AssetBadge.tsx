import React, { useState } from 'react';

const BASE_LOGO = 'https://assets.coincap.io/assets/icons';

const ativoBase = (par: string): string =>
  par.replace(/(USDT|USDC|BUSD|FDUSD|USD)$/i, '').toLowerCase();

type Tamanho = 'sm' | 'md' | 'lg';

const PX: Record<Tamanho, number> = { sm: 20, md: 28, lg: 40 };

interface Props {
  symbol: string;
  size?: Tamanho;
  mostrarNome?: boolean;
  className?: string;
}

// V6.5 (G12-G13, Determinação DET-7 do PO): toda parte de negociação exibe a imagem da
// criptomoeda ao lado do nome. getLogoUrl estava duplicado (AnalysisResult.tsx, FundingMonitor.tsx)
// e a maioria das telas de negociação não mostrava imagem nenhuma. AssetBadge substitui as duas
// cópias e vira o componente único usado em qualquer tela que exiba um par.
export const AssetBadge: React.FC<Props> = ({
  symbol,
  size = 'md',
  mostrarNome = true,
  className = '',
}) => {
  const [falhou, setFalhou] = useState(false);
  const base = ativoBase(symbol);
  const px = PX[size];

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {!falhou ? (
        <img
          src={`${BASE_LOGO}/${base}@2x.png`}
          alt={symbol}
          width={px}
          height={px}
          loading="lazy"
          onError={() => setFalhou(true)}
          className="rounded-full bg-white/5"
        />
      ) : (
        <span
          style={{ width: px, height: px, fontSize: px * 0.4 }}
          className="rounded-full bg-white/10 flex items-center justify-center font-semibold uppercase"
        >
          {base.slice(0, 2)}
        </span>
      )}
      {mostrarNome && <span className="font-medium">{symbol}</span>}
    </span>
  );
};

export default AssetBadge;
