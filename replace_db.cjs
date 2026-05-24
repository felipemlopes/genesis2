const fs = require('fs');
let code = fs.readFileSync('routes/api.js', 'utf8');

// 1. Remove DB_FILE, readDB, writeDB
code = code.replace(/const DB_FILE = path\.join\(__dirname, '\.\.\/carteiras\.json'\);\s*.*?const writeDB = \(db\) => \{\s*.*?fs\.writeFileSync.*?\s*\}\;/s, `// DEV - ARQUIVO JSON DESCARTADO
// O sistema agora não cria nem utiliza mais 'carteiras.json'.
// O arquivo antigo pode ser deletado do servidor pois a migração MySQL foi concluída.
const { getConnection } = require('../services/database.ts');`);

// 2. Replace setupCarteiraRoutes
code = code.replace(/const setupCarteiraRoutes = \(carteiraName, dbArrayKey, counterKey, requireAdmin = false, checkUserId = false\) => \{.*?setupCarteiraRoutes\('carteira-gemas', 'dbCarteiraGemas', 'gemasIdCounter', true, false\);/s, `
const mapCarteiraTableName = (carteiraName) => {
    if (carteiraName === 'carteira-mae') return 'genesis_carteira_mae';
    if (carteiraName === 'carteira-membro') return 'genesis_carteira_membro';
    if (carteiraName === 'carteira-gemas') return 'genesis_carteira_gemas';
    throw new Error('Nome de carteira inválido: ' + carteiraName);
};

const setupCarteiraRoutes = (carteiraName, dbArrayKey, counterKey, requireAdmin = false, checkUserId = false) => {
    const tableName = mapCarteiraTableName(carteiraName);

    // GET
    router.get(\`/\${carteiraName}\`, requiresAuth, async (req, res) => {
        try {
            const conn = await getConnection();
            try {
                let query = \`SELECT * FROM \${tableName}\`;
                let params = [];
                if (checkUserId) {
                    query += \` WHERE user_id = ?\`;
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
    router.post(\`/\${carteiraName}\`, requiresAuth, async (req, res) => {
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
                const query = \`INSERT INTO \${tableName} (\${keys.join(',')}) VALUES (\${placeholders})\`;

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
    router.put(\`/\${carteiraName}/:id\`, requiresAuth, async (req, res) => {
        if (requireAdmin && !req.isAdmin) return res.status(403).json({ success: false, error: "Acesso negado." });

        const id = parseInt(req.params.id);
        const body = req.body;
        
        try {
            const conn = await getConnection();
            try {
                let verifyQuery = \`SELECT * FROM \${tableName} WHERE id = ?\`;
                let verifyParams = [id];
                if (checkUserId) {
                    verifyQuery += \` AND user_id = ?\`;
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
                        updatePairs.push(\`\${key} = ?\`);
                        params.push(body[key]);
                    }
                }
                
                updatePairs.push(\`atualizado_em = ?\`);
                params.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
                params.push(id);
                
                if (updatePairs.length > 1) { 
                    const query = \`UPDATE \${tableName} SET \${updatePairs.join(', ')} WHERE id = ?\`;
                    await conn.query(query, params);
                }

                const [updated] = await conn.query(\`SELECT * FROM \${tableName} WHERE id = ?\`, [id]);
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
    router.delete(\`/\${carteiraName}/:id\`, requiresAuth, async (req, res) => {
        if (requireAdmin && !req.isAdmin) return res.status(403).json({ success: false, error: "Acesso negado." });

        const id = parseInt(req.params.id);
        
        try {
            const conn = await getConnection();
            try {
                let query = \`DELETE FROM \${tableName} WHERE id = ?\`;
                let params = [id];
                if (checkUserId) {
                    query += \` AND user_id = ?\`;
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
setupCarteiraRoutes('carteira-gemas', 'dbCarteiraGemas', 'gemasIdCounter', true, false);`);

fs.writeFileSync('routes/api.js', code);
console.log('Script ran!');
