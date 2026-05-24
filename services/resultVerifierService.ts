import { getConnection } from './database';
import { fetchMarketKlines } from './cryptoApi';

export class ResultVerifierService {
    static async verificarResultadosPendentes() {
        try {
            const conn = await getConnection();
            try {
                // Busca análises pendentes das últimas 72 horas
                const query = `
                    SELECT id, ativo, direcao, stop_loss, take_profit_1, take_profit_2, take_profit_3, criado_em
                    FROM genesis_analises 
                    WHERE resultado = 'PENDENTE' 
                    AND direcao IN ('LONG', 'SHORT')
                    AND criado_em >= DATE_SUB(NOW(), INTERVAL 72 HOUR)
                `;
                const [rows]: any = await conn.query(query);

                for (const analise of rows) {
                    try {
                        const symbol = analise.ativo.replace('/', '').toUpperCase();
                        let currentPrice = 0;
                        try {
                            const klines = await fetchMarketKlines(symbol, '1m', 1);
                            if (klines && klines.length > 0) {
                                currentPrice = parseFloat(klines[0][4]); // Close price
                            }
                        } catch (e) {
                            console.error(`Erro ao buscar preço para ${symbol}`, e);
                            continue;
                        }

                        if (currentPrice === 0) continue;

                        let novoResultado = 'PENDENTE';
                        const isLong = analise.direcao === 'LONG';
                        const stop = parseFloat(analise.stop_loss);
                        const tp1 = parseFloat(analise.take_profit_1);
                        const tp2 = parseFloat(analise.take_profit_2);
                        const tp3 = parseFloat(analise.take_profit_3);

                        if (isLong) {
                            if (stop && currentPrice <= stop) novoResultado = 'STOP_ATINGIDO';
                            else if (tp3 && currentPrice >= tp3) novoResultado = 'TP3_ATINGIDO';
                            else if (tp2 && currentPrice >= tp2) novoResultado = 'TP2_ATINGIDO';
                            else if (tp1 && currentPrice >= tp1) novoResultado = 'TP1_ATINGIDO';
                        } else {
                            if (stop && currentPrice >= stop) novoResultado = 'STOP_ATINGIDO';
                            else if (tp3 && currentPrice <= tp3) novoResultado = 'TP3_ATINGIDO';
                            else if (tp2 && currentPrice <= tp2) novoResultado = 'TP2_ATINGIDO';
                            else if (tp1 && currentPrice <= tp1) novoResultado = 'TP1_ATINGIDO';
                        }

                        if (novoResultado !== 'PENDENTE') {
                            // Aproximação da entrada. O preço de entrada idealmente estaria em setup_entrada (texto),
                            // mas usaremos a proporção de stop_loss e tp1 para estimar se não tivermos.
                            // De forma simples:
                            let estimadoEntrada = tp1 && stop ? (isLong ? (2*stop + tp1) / 3 : (2*stop + tp1) / 3) : currentPrice; // Estimado
                            let pctLucro = isLong ? ((currentPrice - estimadoEntrada) / estimadoEntrada) * 100 : ((estimadoEntrada - currentPrice) / estimadoEntrada) * 100;
                            
                            let distanceToStop = Math.abs(estimadoEntrada - stop);
                            let distanceToCurrent = Math.abs(currentPrice - estimadoEntrada);
                            let rrRealizado = distanceToStop > 0 ? (distanceToCurrent / distanceToStop) : 0;
                            
                            if (novoResultado === 'STOP_ATINGIDO') {
                                rrRealizado = -1;
                            } else {
                                // Se for lucro
                                rrRealizado = Math.abs(rrRealizado);
                            }

                            const updateQ = `
                                UPDATE genesis_analises 
                                SET resultado = ?, preco_resultado = ?, data_resultado = NOW(), lucro_percentual = ?, risco_retorno_realizado = ?
                                WHERE id = ?
                            `;
                            await conn.query(updateQ, [novoResultado, currentPrice, pctLucro, rrRealizado, analise.id]);
                        }
                    } catch(err) {
                        console.error("Erro processando análise: ", err);
                    }
                }
            } finally {
                conn.release();
            }
        } catch (e) {
            console.error("Erro em verificarResultadosPendentes: ", e);
        }
    }

    static iniciarVerificacaoAutomatica() {
        // DEV - ATIVAR: Chamar este serviço no servidor via setInterval após as credenciais MySQL estarem configuradas.
        setInterval(() => {
            this.verificarResultadosPendentes();
        }, 5 * 60 * 1000);
        
        this.verificarResultadosPendentes();
    }
}
