// hooks/useMonitoramentoCarteira.ts
import { useEffect, useState } from 'react';
import { buscarPrecoSpot } from '../services/spotPriceService';

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
  const [ativosAtualizados, setAtivosAtualizados] = useState<AtivoMonitorado[]>([]);

  useEffect(() => {
    let unmounted = false;

    const checarAlertas = (ativos: AtivoMonitorado[], tipo: 'MEMBRO'|'MAE') => {
      ativos.forEach(at => {
        if (at.status !== 'ATIVO' || !at.preco_atual) return;

        if (tipo === 'MEMBRO' && at.alvo_saida && at.preco_atual >= at.alvo_saida) {
          // Em um app real, lançaríamos uma toast/modal
        }

        if (tipo === 'MAE') {
          // DEV - TELEGRAM: quando o alvo da Carteira Mãe for atingido disparar a mensagem 
          // configurada no campo telegram_mensagem para o canal do Telegram do Gênesis 
          // usando o bot já configurado no projeto.
          if (at.alvo_cima && at.preco_atual >= at.alvo_cima) {
             // disparar telegram alvo cima
          }
          if (at.alvo_baixo && at.preco_atual <= at.alvo_baixo) {
             // disparar telegram alvo baixo
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
