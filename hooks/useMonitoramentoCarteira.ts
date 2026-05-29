// hooks/useMonitoramentoCarteira.ts
import { useEffect, useRef } from 'react';
import { updateCarteiraMae, updateCarteiraMembro, updateCarteiraGemas } from '../services/api';

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
  max_price?: number | null;
  max_price_date?: string | null;
  max_variation_pct?: number | null;
  wallet_type?: 'mae' | 'gemas' | 'membro';
}

/**
 * Hook para monitorar os ativos em segundo plano e disparar alertas
 */
export const useMonitoramentoCarteira = (
  ativosMembro: AtivoMonitorado[], 
  ativosMae: AtivoMonitorado[],
  isAdmin: boolean,
  ativosGemas?: AtivoMonitorado[]
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

    // Verifica e atualiza ATH para cada ativo no ciclo de polling
    const verificarATH = async (ativos: AtivoMonitorado[], tipo: 'MEMBRO' | 'MAE' | 'GEMAS') => {
      for (const at of ativos) {
        if (at.status !== 'ATIVO' || !at.preco_atual || !at.preco_entrada) continue;

        const maxPriceAtual = at.max_price ?? 0;

        // Se preço atual supera o max_price registrado (ou max_price é null/0), atualizar ATH
        if (at.preco_atual > maxPriceAtual) {
          const max_variation_pct = ((at.preco_atual - at.preco_entrada) / at.preco_entrada) * 100;
          const athData = {
            max_price: at.preco_atual,
            max_price_date: new Date().toISOString(),
            max_variation_pct: parseFloat(max_variation_pct.toFixed(2)),
          };

          try {
            if (tipo === 'MAE') {
              await updateCarteiraMae(at.id, athData);
            } else if (tipo === 'GEMAS') {
              await updateCarteiraGemas(at.id, athData);
            } else {
              await updateCarteiraMembro(at.id, athData);
            }
            // Atualizar referência local para evitar PUT repetido no próximo ciclo
            at.max_price = at.preco_atual;
            at.max_price_date = athData.max_price_date;
            at.max_variation_pct = athData.max_variation_pct;
          } catch (err) {
            // Erro de rede não interrompe o polling
            console.warn(`[ATH] Falha ao atualizar ATH para ${at.ativo}:`, err);
          }
        }
      }
    };

    const intervalId = setInterval(() => {
      if (!unmounted) {
         checarAlertas(ativosMembro, 'MEMBRO');
         if (isAdmin) checarAlertas(ativosMae, 'MAE');
         // Verificar ATH em todos os ativos ativos
         verificarATH(ativosMembro, 'MEMBRO');
         if (isAdmin) {
           verificarATH(ativosMae, 'MAE');
           if (ativosGemas) verificarATH(ativosGemas, 'GEMAS');
         }
      }
    }, 30000);

    return () => {
      unmounted = true;
      clearInterval(intervalId);
    };
  }, [ativosMembro, ativosMae, isAdmin, ativosGemas]);
};
