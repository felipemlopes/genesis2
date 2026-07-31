import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import 'dotenv/config';
import crypto from "crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

if (process.env.NODE_ENV === 'production') {
  console.log = function() {};
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET ausente. O servidor não pode iniciar sem um segredo JWT configurado.');
  }
  return secret;
}

export function gerarToken(userId: string, isAdmin: boolean) {
  return jwt.sign({ userId, isAdmin }, getJwtSecret(), { expiresIn: '24h' });
}

export function verificarToken(token: string) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    return null;
  }
}

// DEV - CONFIGURAR: Substituir a URL e os headers abaixo pelos dados reais da API do LastLink fornecidos pela plataforma.
async function verificarMembroLastLink(lastlinkToken: string) {
  try {
    const apiUrl = process.env.LASTLINK_API_URL || "https://api.lastlink.com/v1/auth/check";
    const apiKey = process.env.LASTLINK_API_KEY || "";

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({ token: lastlinkToken })
    });

    if (response.ok) {
      const data = await response.json();
      // Ajuste os campos 'status' e 'userId' de acordo com a documentação do LastLink
      const isAtivo = data.isActive || data.status === "ACTIVE" || data.status === "active";
      if (isAtivo) {
        const userId = data.userId || data.id || data.email || lastlinkToken;
        return { userId: userId.toString(), isAdmin: false };
      }
    }
    return null;
  } catch (error) {
    console.error("Erro ao verificar LastLink:", error);
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3001;

  // V6.5 (A05): cors() sem lista de origens respondia Access-Control-Allow-Origin: * para qualquer site.
  const ORIGENS_PERMITIDAS = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl, health check, same-origin
      if (ORIGENS_PERMITIDAS.includes(origin)) return callback(null, true);
      return callback(new Error('Origem nao permitida'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  }));

  // V6.5 (A06): 50mb sem limite de taxa permitia derrubar o processo com poucas requisições simultâneas
  // grandes. Nenhum endpoint deste servidor recebe JSON grande de verdade (ele faz login e proxy).
  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: true, limit: '256kb' }));

  const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Muitas tentativas. Aguarde um minuto.' },
  });

  // Login Route
  app.post("/api/auth/login", loginLimiter, async (req, res) => {
    const { lastlinkToken } = req.body;

    if (!lastlinkToken) {
      return res.status(401).json({ success: false, message: "Token Ausente. Assinatura não está ativa ou o token é inválido." });
    }

    const membro = await verificarMembroLastLink(lastlinkToken);

    if (!membro) {
      return res.status(401).json({ success: false, message: "Assinatura não está ativa ou o token é inválido." });
    }

    let isAdmin = membro.isAdmin;
    if (membro.userId === process.env.ADMIN_USER_ID) {
      isAdmin = true;
    }

    const token = gerarToken(membro.userId, isAdmin);
    res.json({ success: true, token });
  });

  // V6.5 (A06, alerta adicional): antes só emitia console.warn e o servidor subia sem essas rotas, em
  // silêncio. Falha explícita — se o import quebrar, ninguém vai notar sozinho que metade da API sumiu.
  try {
    const apiRoutes = (await import("./routes/api.js")).default;
    app.use("/api", apiRoutes);
  } catch (err: any) {
    console.error("FALHA CRITICA ao montar rotas da API:", err.message);
    process.exit(1);
  }

  // API route to proxy Bybit public requests ONLY
  app.all("/api/bybit/*endpoint", async (req, res) => {
    try {
      const endpoint = Array.isArray(req.params.endpoint) ? req.params.endpoint[0] : req.params.endpoint;
      
      // Security: Only allow public market endpoints
      if (!endpoint.startsWith('v5/market/')) {
        return res.status(403).json({ retCode: 403, retMsg: "Acesso a endpoints privados bloqueado." });
      }

      const targetUrl = `https://api.bybit.com/${endpoint}`;
      
      // Extract query string
      const queryIndex = req.originalUrl.indexOf('?');
      const exactQueryString = queryIndex !== -1 ? req.originalUrl.substring(queryIndex) : '';
      const finalUrl = `${targetUrl}${exactQueryString}`;

      const response = await fetch(finalUrl, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.text();
      let json = null;
      try { json = JSON.parse(data); } catch (e) {}

      res.status(response.status).send(json || data);
    } catch (error: any) {
      console.error("Bybit Proxy Error:", error);
      res.status(500).json({ retCode: 500, retMsg: "Internal Proxy Error", error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();