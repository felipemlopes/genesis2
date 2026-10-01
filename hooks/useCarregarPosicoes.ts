import { useEffect } from 'react';
import { useAppContext } from '../contexts/AppContext';
import { listarPosicoes } from '../services/api';
import { separarPorStatus, tradeDoServidor } from '../utils/posicoes';

/**
 * V6.12 (§8.3): as telas de posições ativas e de histórico carregam do servidor ao abrir — a posição
 * confirmada sobrevive ao F5. Falha de rede não apaga o que já está na tela.
 */
export function useCarregarPosicoes(): void {
  const { setActiveTrades, setClosedTrades } = useAppContext();

  useEffect(() => {
    let ativo = true;
    void listarPosicoes().then((resultado) => {
      if (!ativo || resultado.success === false) return;
      const { ativas, encerradas } = separarPorStatus(resultado.data.map(tradeDoServidor));
      setActiveTrades(ativas);
      setClosedTrades(encerradas);
    });
    return () => { ativo = false; };
  }, [setActiveTrades, setClosedTrades]);
}
