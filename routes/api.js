const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { GenesisPipeline } = require('../engine/genesisPipeline');
const { EnsembleGenesis } = require('../engine/ensembleGenesis');
global.EnsembleGenesis = EnsembleGenesis;

const { geminiClient } = require('../services/gemini');

// DEV - ARQUIVO JSON DESCARTADO
// O sistema agora não cria nem utiliza mais 'carteiras.json'.
// O arquivo antigo pode ser deletado do servidor pois a migração MySQL foi concluída.
const { getConnection } = require('../services/database.ts');

const requiresAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: "Não autorizado: Token não fornecido ou formato inválido." });
    }
    
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'fallback_secret_only_for_dev_if_missing';
    
    try {
        const decoded = jwt.verify(token, secret);
        req.userId = decoded.userId;
        req.isAdmin = decoded.isAdmin;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, error: "Não autorizado: Token inválido ou expirado." });
    }
};


const mapCarteiraTableName = (carteiraName) => {
    if (carteiraName === 'carteira-mae') return 'genesis_carteira_mae';
    if (carteiraName === 'carteira-membro') return 'genesis_carteira_membro';
    if (carteiraName === 'carteira-gemas') return 'genesis_carteira_gemas';
    throw new Error('Nome de carteira inválido: ' + carteiraName);
};

const setupCarteiraRoutes = (carteiraName, dbArrayKey, counterKey, requireAdmin = false, checkUserId = false) => {
    const tableName = mapCarteiraTableName(carteiraName);

    // GET
    router.get(`/${carteiraName}`, requiresAuth, async (req, res) => {
        try {
            const conn = await getConnection();
            try {
                let query = `SELECT * FROM ${tableName}`;
                let params = [];
                if (checkUserId) {
                    query += ` WHERE user_id = ?`;
                    params.push(req.userId);
                }
                const [rows] = await conn.query(query, params);
                res.json({ success: true, data: rows });
            } finally {
                conn.release();
            }
        } catch (e) {
            console.error("[Fallback BD] Erro ao acessar MySQL (GET):", e);
            res.status(503).json({ success: false, error: "Banco de dados indisponível no momento." });
        }
    });

    // POST
    router.post(`/${carteiraName}`, requiresAuth, async (req, res) => {
        if (requireAdmin && !req.isAdmin) return res.status(403).json({ success: false, error: "Acesso negado." });
        
        try {
            const conn = await getConnection();
            try {
                const body = req.body;
                const ativo = {
                    ativo: body.ativo,
                    nome_completo: body.nome_completo || null,
                    corretora: body.corretora,
                    preco_entrada: body.preco_entrada,
                    preco_atual: body.preco_atual || null,
                    data_entrada: body.data_entrada || new Date().toISOString().split('T')[0],
                    tipo: body.tipo || 'GEMA',
                    status: 'ATIVO',
                    criado_em: new Date().toISOString().slice(0, 19).replace('T', ' ')
                };
                
                if (checkUserId) {
                    ativo.user_id = req.userId;
                    ativo.alvo_saida = body.alvo_saida || null;
                } else {
                    ativo.alvo_cima = body.alvo_cima || null;
                    ativo.alvo_baixo = body.alvo_baixo || null;
                    ativo.telegram_mensagem = body.telegram_mensagem || null;
                }

                const keys = Object.keys(ativo);
                const values = Object.values(ativo);
                const placeholders = keys.map(() => '?').join(',');
                const query = `INSERT INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;

                const [result] = await conn.query(query, values);
                ativo.id = result.insertId;
                
                res.json({ success: true, data: ativo });
            } finally {
                conn.release();
            }
        } catch (e) {
            console.error("[Fallback BD] Erro ao acessar MySQL (POST):", e);
            res.status(503).json({ success: false, error: "Banco de dados indisponível no momento." });
        }
    });

    // PUT
    router.put(`/${carteiraName}/:id`, requiresAuth, async (req, res) => {
        if (requireAdmin && !req.isAdmin) return res.status(403).json({ success: false, error: "Acesso negado." });

        const id = parseInt(req.params.id);
        const body = req.body;
        
        try {
            const conn = await getConnection();
            try {
                let verifyQuery = `SELECT * FROM ${tableName} WHERE id = ?`;
                let verifyParams = [id];
                if (checkUserId) {
                    verifyQuery += ` AND user_id = ?`;
                    verifyParams.push(req.userId);
                }
                const [existing] = await conn.query(verifyQuery, verifyParams);
                if (existing.length === 0) {
                    conn.release();
                    return res.status(404).json({ success: false, error: "Ativo não encontrado ou sem permissão." });
                }

                const excludeFields = ['id', 'user_id', 'criado_em'];
                let updatePairs = [];
                let params = [];
                
                for (const key of Object.keys(body)) {
                    if (!excludeFields.includes(key)) {
                        updatePairs.push(`${key} = ?`);
                        params.push(body[key]);
                    }
                }
                
                updatePairs.push(`atualizado_em = ?`);
                params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
                params.push(id);
                
                if (updatePairs.length > 1) { 
                    const query = `UPDATE ${tableName} SET ${updatePairs.join(', ')} WHERE id = ?`;
                    await conn.query(query, params);
                }

                const [updated] = await conn.query(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
                res.json({ success: true, data: updated[0] });
            } finally {
                conn.release();
            }
        } catch (e) {
            console.error("[Fallback BD] Erro ao acessar MySQL (PUT):", e);
            res.status(503).json({ success: false, error: "Banco de dados indisponível no momento." });
        }
    });

    // DELETE
    router.delete(`/${carteiraName}/:id`, requiresAuth, async (req, res) => {
        if (requireAdmin && !req.isAdmin) return res.status(403).json({ success: false, error: "Acesso negado." });

        const id = parseInt(req.params.id);
        
        try {
            const conn = await getConnection();
            try {
                let query = `DELETE FROM ${tableName} WHERE id = ?`;
                let params = [id];
                if (checkUserId) {
                    query += ` AND user_id = ?`;
                    params.push(req.userId);
                }
                const [result] = await conn.query(query, params);
                
                if (result.affectedRows === 0) {
                    res.status(404).json({ success: false, error: "Ativo não encontrado ou sem permissão." });
                } else {
                    res.json({ success: true, deletedId: id });
                }
            } finally {
                conn.release();
            }
        } catch (e) {
            console.error("[Fallback BD] Erro ao acessar MySQL (DELETE):", e);
            res.status(503).json({ success: false, error: "Banco de dados indisponível no momento." });
        }
    });
};

setupCarteiraRoutes('carteira-mae', 'dbCarteiraMae', 'maeIdCounter', true, false);
setupCarteiraRoutes('carteira-membro', 'dbCarteiraMembro', 'membroIdCounter', false, true);
setupCarteiraRoutes('carteira-gemas', 'dbCarteiraGemas', 'gemasIdCounter', true, false);

/* =========================================
   EXISTING ANALYSIS ENDPOINT
   ========================================= */

router.post('/analisar', async (req, res) => {
  try {
    const { imageBase64, exchange, symbol, interval = '1d' } = req.body;

    const promptVisao = `Você é um scanner visual especializado. Sua ÚNICA função é extrair elementos GRÁFICOS desenhados pelo usuário nesta imagem de chart.

Você está TERMINANTEMENTE PROIBido de:
- Ler valores de indicadores técnicos (RSI, ADX, MACD, EMA, etc.)
- Estimar preços pelo eixo Y da imagem
- Fazer análise de mercado ou prever movimentos
- Calcular qualquer métrica matemática

Você DEVE extrair APENAS estes elementos em JSON:

{
  "linhas_tendencia": [
    {"tipo": "LTA|LTB|HORIZONTAL", "pontos": [[x1,y1],[x2,y2]], "cor": "string"}
  ],
  "caixas": [
    {"label": "string", "top": float, "bottom": float, "left": float, "right": float}
  ],
  "suportes": [float, float],
  "resistencias": [float, float],
  "fibonacci": [float, float, float],
  "anotacoes": [
    {"texto": "string", "posicao": [x,y]}
  ],
  "padroes_monitorados": ["string"],
  "setas": [
    {"direcao": "UP|DOWN", "origem": [x,y], "destino": [x,y]}
  ]
}

Se não houver elementos desenhados, retorne: {"elementos": []}

NUNCA retorne valores de RSI, ADX, MACD, preço atual, ou qualquer número que apareça em indicadores do painel inferior. Esses dados virão de APIs separadas.`;

    const elementosVisuais = await geminiClient.vision(imageBase64, promptVisao);

    const pipeline = new GenesisPipeline(exchange);
    const resultado = await pipeline.analisar(symbol, interval, elementosVisuais);

    const promptNarrativa = `Você é Genesis, analista quantitativo de derivativos cripto profissional.

Você recebeu um setup matemático já calculado pelo sistema. Sua função é APENAS gerar uma narrativa clara e profissional em português.

DADOS FORNECIDOS (não invente nada além destes):
- Ativo: ${symbol}
- Preço atual: ${resultado.indicadores.preco}
- Regime: ${resultado.ensemble.regime}
- Score: ${resultado.ensemble.score}/100
- Confiança: ${resultado.ensemble.confianca}%
- Direção: ${resultado.ensemble.direcao}
- Setup: ${JSON.stringify(resultado.execucao.setup)}
- Indicadores: ${JSON.stringify(resultado.indicadores)}
- Contexto visual do trader: ${JSON.stringify(resultado.contextoVisual)}
- Alerta: ${resultado.ensemble.alerta || 'Nenhum'}

REGRAS:
1. Máximo 200 palavras
2. Explique POR QUE o setup foi gerado, citando confluências entre dados técnicos e elementos visuais
3. Se score < 65, ADICIONE: "Operar com cautela. Alavancagem reduzida."
4. NUNCA invente números — use apenas os fornecidos acima
5. NUNCA sugira alterar o setup — ele já foi validado matematicamente
6. Tom profissional, direto, sem floreios`;

    const narrativa = await geminiClient.text(promptNarrativa);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      exchange,
      symbol,
      ...resultado,
      narrativa,
      direcaoProvavel: resultado.ensemble.direcao,
      scoreProbabilidade: resultado.ensemble.score,
      confianca: resultado.ensemble.confianca,
      regime: resultado.ensemble.regime,
      alerta: resultado.ensemble.alerta,
      acao: resultado.execucao.acao,
      motivo: resultado.execucao.motivo,
      zonaInteresse: resultado.execucao.zonaInteresse || null,
      entradaSugerida: resultado.execucao.setup?.entrada || null,
      stopLoss: resultado.execucao.setup?.stop || null,
      alvos: resultado.execucao.setup ? [
        resultado.execucao.setup.tp1,
        resultado.execucao.setup.tp2,
        resultado.execucao.setup.tp3
      ] : [],
      alavancagem: resultado.execucao.setup?.alavancagem || null,
      liquidacao: resultado.execucao.setup?.liquidacao || null,
      riscoPct: resultado.execucao.setup?.riscoPct || null,
      rr1: resultado.execucao.setup?.rr1 || null,
      indicadores: {
        rsi: resultado.indicadores.rsi,
        adx: resultado.indicadores.adx,
        plusDI: resultado.indicadores.plusDI,
        minusDI: resultado.indicadores.minusDI,
        macdHist: resultado.indicadores.macdHist,
        ema21: resultado.indicadores.ema21,
        ema50: resultado.indicadores.ema50,
        ema200: resultado.indicadores.ema200,
        atr: resultado.indicadores.atr,
        cvd: resultado.indicadores.cvd
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST - Salvar análise
router.post('/salvar-analise', requiresAuth, async (req, res) => {
    try {
        const {
            ativo, corretora, timeframe, score, vies, direcao, alavancagem,
            resumo_analise, setup_entrada, stop_loss, take_profit_1, take_profit_2,
            take_profit_3, risco_retorno
        } = req.body;

        const conn = await getConnection();
        try {
            const query = `
                INSERT INTO genesis_analises (
                    user_id, ativo, corretora, timeframe, score, vies, direcao, 
                    alavancagem, resumo_analise, setup_entrada, stop_loss, 
                    take_profit_1, take_profit_2, take_profit_3, risco_retorno, criado_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `;
            const params = [
                req.userId, ativo, corretora || null, timeframe || null, score || 0,
                vies || null, direcao || null, alavancagem || null, resumo_analise || null,
                setup_entrada || null, stop_loss || null, take_profit_1 || null,
                take_profit_2 || null, take_profit_3 || null, risco_retorno || null
            ];
            await conn.query(query, params);
            res.json({ success: true, message: "Análise salva com sucesso." });
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error("[MySQL] Erro ao salvar análise:", e);
        res.status(500).json({ success: false, error: "Erro interno ao salvar análise no banco de dados." });
    }
});

// DEV - CONECTAR: Esta rota depende de uma tabela genesis_analises que precisa ser criada.
router.get('/historico-analises', requiresAuth, async (req, res) => {
    try {
        const conn = await getConnection();
        try {
            const query = `
                SELECT *
                FROM genesis_analises 
                WHERE user_id = ? 
                ORDER BY criado_em DESC 
                LIMIT 50
            `;
            const [rows] = await conn.query(query, [req.userId]);
            res.json({ success: true, data: rows });
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error("[MySQL] Erro ao buscar histórico:", e);
        res.status(500).json({ success: false, error: "Banco de dados indisponível no momento." });
    }
});

// NOVA ROTA: ESTATÍSTICAS DO SISTEMA
router.get('/estatisticas-sistema', requiresAuth, async (req, res) => {
    try {
        const conn = await getConnection();
        try {
            // Conta total de análises nos últimos 30 dias
            const [totalRows] = await conn.query(`SELECT COUNT(*) as total FROM genesis_analises WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)`);
            const totalAnalises = totalRows[0].total || 0;

            if (totalAnalises === 0) {
                return res.json({ success: true, data: { totalAnalises: 0, taxaAcertoGeral: 0, tp1Pct: 0, tp2Pct: 0, tp3Pct: 0, stopPct: 0, rrMedio: 0, melhorSequencia: 0, melhorAtivo: 'N/A' } });
            }

            // Conta os diferentes resultados
            const [resultadosRows] = await conn.query(`
                SELECT resultado, COUNT(*) as qtd 
                FROM genesis_analises 
                WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
                AND resultado != 'PENDENTE'
                GROUP BY resultado
            `);

            let tp1 = 0, tp2 = 0, tp3 = 0, stop = 0;
            let totalResolvidas = 0;

            resultadosRows.forEach(row => {
                totalResolvidas += row.qtd;
                if (row.resultado === 'TP1_ATINGIDO') tp1 += row.qtd;
                else if (row.resultado === 'TP2_ATINGIDO') tp2 += row.qtd;
                else if (row.resultado === 'TP3_ATINGIDO') tp3 += row.qtd;
                else if (row.resultado === 'STOP_ATINGIDO') stop += row.qtd;
            });

            const acertos = tp1 + tp2 + tp3;
            const tp1Pct = totalResolvidas > 0 ? (tp1 / totalResolvidas) * 100 : 0;
            const tp2Pct = totalResolvidas > 0 ? (tp2 / totalResolvidas) * 100 : 0;
            const tp3Pct = totalResolvidas > 0 ? (tp3 / totalResolvidas) * 100 : 0;
            const stopPct = totalResolvidas > 0 ? (stop / totalResolvidas) * 100 : 0;
            const taxaAcertoGeral = totalResolvidas > 0 ? (acertos / totalResolvidas) * 100 : 0;

            // RR médio
            const [rrRows] = await conn.query(`SELECT AVG(risco_retorno_realizado) as avg_rr FROM genesis_analises WHERE resultado != 'PENDENTE' AND criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND risco_retorno_realizado IS NOT NULL`);
            const rrMedio = rrRows[0].avg_rr || 0;

            // Ativo com maior taxa de acerto (mínimo de 3 análises)
            const [ativoRows] = await conn.query(`
                SELECT ativo, 
                       SUM(CASE WHEN resultado IN ('TP1_ATINGIDO', 'TP2_ATINGIDO', 'TP3_ATINGIDO') THEN 1 ELSE 0 END) / COUNT(*) as win_rate,
                       COUNT(*) as total_trades
                FROM genesis_analises
                WHERE resultado != 'PENDENTE' AND criado_em >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                GROUP BY ativo
                HAVING total_trades >= 3
                ORDER BY win_rate DESC, total_trades DESC
                LIMIT 1
            `);
            const melhorAtivo = ativoRows.length > 0 ? ativoRows[0].ativo : 'N/A';

            // Melhor sequência simples (aproximada, busca os últimos seguidos de qq usuário) - Omitida query complexa, vamos usar random de mentira ou uma query que ordena por id para os fechados.
            const [historicoOrdenado] = await conn.query(`SELECT resultado FROM genesis_analises WHERE resultado != 'PENDENTE' ORDER BY data_resultado DESC LIMIT 100`);
            
            let melhorSequencia = 0;
            let seqAtual = 0;
            for (let i = 0; i < historicoOrdenado.length; i++) {
                if (['TP1_ATINGIDO', 'TP2_ATINGIDO', 'TP3_ATINGIDO'].includes(historicoOrdenado[i].resultado)) {
                    seqAtual++;
                    if (seqAtual > melhorSequencia) melhorSequencia = seqAtual;
                } else {
                    seqAtual = 0;
                }
            }

            res.json({
                success: true,
                data: {
                    totalAnalises,
                    totalResolvidas,
                    taxaAcertoGeral,
                    tp1Pct,
                    tp2Pct,
                    tp3Pct,
                    stopPct,
                    rrMedio,
                    melhorSequencia,
                    melhorAtivo
                }
            });
        } finally {
            conn.release();
        }
    } catch (e) {
        console.error("[MySQL] Erro ao buscar estatísticas do sistema:", e);
        res.status(500).json({ success: false, error: "Erro ao calcular estatísticas." });
    }
});

module.exports = router;
