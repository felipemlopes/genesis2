import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import 'dotenv/config';
import crypto from "crypto";
import jwt from "jsonwebtoken";

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

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Login Route
  app.post("/api/auth/login", async (req, res) => {
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

  try {
    const apiRoutes = (await import("./routes/api.js")).default;
    app.use("/api", apiRoutes);
  } catch (err: any) {
    console.warn("Skipping API mount due to missing modules", err.message);
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

  // Gemini Proxy Route
  app.post("/api/gemini-proxy", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key is missing on the server" });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model,
        contents,
        config
      });

      res.json(response);
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message });
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