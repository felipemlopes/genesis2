// hooks/useMonitoramentoCarteira.ts
import { useEffect, useRef } from 'react';

export interface AtivoMonitorado {
  id: number;
  ativo: string;
  corretora: string;
  preco_entrada: number;
  preco_atual?: number;
  alvo_saida?: number;
  alvo_cima?: number;
  alvo_baixo?: number;
  telegram_mensagem?: string;
  status: 'ATIVO' | 'VENDIDO';
}

/**
 * Hook para monitorar os ativos em segundo plano e disparar alertas
 */
export const useMonitoramentoCarteira = (
  ativosMembro: AtivoMonitorado[], 
  ativosMae: AtivoMonitorado[],
  isAdmin: boolean
) => {
  const alertasDisparados = useRef(new Set<string>());

  useEffect(() => {
    let unmounted = false;

    const checarAlertas = (ativos: AtivoMonitorado[], tipo: 'MEMBRO'|'MAE') => {
      ativos.forEach(at => {
        if (at.status !== 'ATIVO' || !at.preco_atual) return;

        if (tipo === 'MEMBRO' && at.alvo_saida && at.preco_atual >= at.alvo_saida) {
          const alertKey = `membro-${at.id}-${at.alvo_saida}`;
          if (alertasDisparados.current.has(alertKey)) return;
          alertasDisparados.current.add(alertKey);

          window.dispatchEvent(new CustomEvent('carteira:alvo-atingido', {
            detail: {
              ativo: at.ativo,
              corretora: at.corretora,
              preco_entrada: at.preco_entrada,
              preco_atual: at.preco_atual,
              alvo_saida: at.alvo_saida,
              variacao: ((at.preco_atual - at.preco_entrada) / at.preco_entrada * 100).toFixed(2),
            }
          }));
        }

        if (tipo === 'MAE') {
          if (at.alvo_cima && at.preco_atual >= at.alvo_cima) {
            const alertKey = `mae-cima-${at.id}-${at.alvo_cima}`;
            if (!alertasDisparados.current.has(alertKey)) {
              alertasDisparados.current.add(alertKey);
              window.dispatchEvent(new CustomEvent('carteira:alvo-atingido', {
                detail: {
                  ativo: at.ativo,
                  corretora: at.corretora,
                  tipo_alvo: 'ALVO_CIMA',
                  preco_atual: at.preco_atual,
                  alvo: at.alvo_cima,
                  mensagem: at.telegram_mensagem || '',
                }
              }));
            }
          }
          if (at.alvo_baixo && at.preco_atual <= at.alvo_baixo) {
            const alertKey = `mae-baixo-${at.id}-${at.alvo_baixo}`;
            if (!alertasDisparados.current.has(alertKey)) {
              alertasDisparados.current.add(alertKey);
              window.dispatchEvent(new CustomEvent('carteira:alvo-atingido', {
                detail: {
                  ativo: at.ativo,
                  corretora: at.corretora,
                  tipo_alvo: 'ALVO_BAIXO',
                  preco_atual: at.preco_atual,
                  alvo: at.alvo_baixo,
                  mensagem: at.telegram_mensagem || '',
                }
              }));
            }
          }
        }
      });
    };

    const intervalId = setInterval(() => {
      if (!unmounted) {
         checarAlertas(ativosMembro, 'MEMBRO');
         if (isAdmin) checarAlertas(ativosMae, 'MAE');
      }
    }, 30000);

    return () => {
      unmounted = true;
      clearInterval(intervalId);
    };
  }, [ativosMembro, ativosMae, isAdmin]);
};
