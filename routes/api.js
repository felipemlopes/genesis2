const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

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
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        return res.status(500).json({ success: false, error: "Configuração do servidor incompleta: JWT_SECRET ausente." });
    }

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

// ─── SSE: ALERTAS STREAM ──────────────────────────────────────
// Endpoint SSE que faz polling na tabela genesis_alertas a cada 10 segundos
// e transmite alertas novos (enviado_sse = 0) ao cliente.
// Exclui campos 'direcao' e 'urgencia' do payload.
// Envia `: ping` a cada 30s para manter conexão viva.
router.get('/v1/alertas/stream', async (req, res) => {
    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    let lastPing = Date.now();
    let closed = false;

    req.on('close', () => {
        closed = true;
    });

    const poll = async () => {
        while (!closed) {
            try {
                const conn = await getConnection();
                try {
                    // Query unsent alerts
                    const [rows] = await conn.query(
                        'SELECT * FROM genesis_alertas WHERE enviado_sse = 0 ORDER BY created_at ASC LIMIT 50'
                    );

                    for (const alerta of rows) {
                        // Exclude direcao and urgencia from payload
                        const { direcao, urgencia, ...payload } = alerta;
                        res.write(`data: ${JSON.stringify(payload)}\n\n`);

                        // Mark as sent
                        await conn.query(
                            'UPDATE genesis_alertas SET enviado_sse = 1 WHERE id = ?',
                            [alerta.id]
                        );
                    }
                } finally {
                    conn.release();
                }
            } catch (err) {
                console.error('[SSE] Erro ao buscar alertas:', err.message);
            }

            // Send ping every 30 seconds to keep connection alive
            if (Date.now() - lastPing >= 30000) {
                res.write(': ping\n\n');
                lastPing = Date.now();
            }

            // Wait 10 seconds before next poll
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    };

    poll();
});

module.exports = router;
