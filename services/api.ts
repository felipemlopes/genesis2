const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('genesis_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getFormDataHeaders(): Record<string, string> {
  const token = localStorage.getItem('genesis_token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ─── AUTH ──────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (res.ok && data.access_token) {
    localStorage.setItem('genesis_token', data.access_token);
    return { success: true, user: data.user };
  }
  return { success: false, message: data.message || 'Credenciais invalidas' };
}

export async function getMe() {
  const res = await fetch(`${API_BASE}/v1/me`, { headers: getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/v1/logout`, { method: 'POST', headers: getAuthHeaders() });
  } catch (_) {}
  localStorage.removeItem('genesis_token');
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem('genesis_token');
}

export async function fetchCredits(): Promise<number | null> {
  const res = await fetch(`${API_BASE}/v1/credits`, { headers: getAuthHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.credits ?? null;
}

// ─── CARTEIRA MEMBRO ──────────────────────────────────────────

export async function fetchCarteiraMembro() {
  const res = await fetch(`${API_BASE}/v1/carteira-membro`, { headers: getAuthHeaders() });
  return res.json();
}

export async function storeCarteiraMembro(data: any) {
  const res = await fetch(`${API_BASE}/v1/carteira-membro`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCarteiraMembro(id: number, data: any) {
  const res = await fetch(`${API_BASE}/v1/carteira-membro/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCarteiraMembro(id: number) {
  const res = await fetch(`${API_BASE}/v1/carteira-membro/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.json();
}

// ─── CARTEIRA MAE (admin) ─────────────────────────────────────

export async function fetchCarteiraMae() {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-mae`, { headers: getAuthHeaders() });
  return res.json();
}

export async function storeCarteiraMae(data: any) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-mae`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCarteiraMae(id: number, data: any) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-mae/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCarteiraMae(id: number) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-mae/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.json();
}

// ─── CARTEIRA GEMAS (admin) ───────────────────────────────────

export async function fetchCarteiraGemas() {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-gemas`, { headers: getAuthHeaders() });
  return res.json();
}

export async function storeCarteiraGemas(data: any) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-gemas`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateCarteiraGemas(id: number, data: any) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-gemas/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteCarteiraGemas(id: number) {
  const res = await fetch(`${API_BASE}/v1/admin/carteira-gemas/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.json();
}

// ─── ANALISES ─────────────────────────────────────────────────

export async function fetchHistoricoAnalises() {
  const res = await fetch(`${API_BASE}/v1/analises`, { headers: getAuthHeaders() });
  return res.json();
}

export async function storeAnalise(data: any) {
  console.log('[storeAnalise] Enviando payload:', JSON.stringify(data));
  const res = await fetch(`${API_BASE}/v1/analises`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  console.log('[storeAnalise] Resposta:', JSON.stringify(json));
  return json;
}

export async function updateResultadoAnalise(id: number, data: any) {
  const res = await fetch(`${API_BASE}/v1/analises/${id}/resultado`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteAnalise(id: number) {
  const res = await fetch(`${API_BASE}/v1/analises/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function deleteAllAnalises() {
  const res = await fetch(`${API_BASE}/v1/analises`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  return res.json();
}

// ─── ZONA SELECIONADA ─────────────────────────────────────────

export async function selecionarZona(analiseId: string | number, zona: 'A' | 'B', userId: string | number): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/v1/analises/${analiseId}/zona-selecionada`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ zona, user_id: userId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.message || 'Erro ao salvar zona selecionada' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro de rede ao salvar zona' };
  }
}

// ─── CRÉDITOS ─────────────────────────────────────────────────

export async function consumeCredits(type: string, idempotencyKey?: string): Promise<{ success: boolean; credits?: number; error?: string }> {
  const body: Record<string, string> = { type };
  if (idempotencyKey) body.idempotency_key = idempotencyKey;
  const res = await fetch(`${API_BASE}/v1/credits/consume/${type}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { success: false, error: data.message || 'Erro ao debitar créditos' };
  return { success: true, credits: data.credits };
}

// ─── REVEAL ALERTA ────────────────────────────────────────────

export interface RevealResponse {
  success: boolean;
  ativo: string;
  corretora: string;
  preco_atual: number;
  timeframes: string[];
  credits_remaining: number;
  error?: string;
}

export async function revealAlerta(alertaId: number, idempotencyKey: string): Promise<RevealResponse> {
  const res = await fetch(`${API_BASE}/v1/alertas/${alertaId}/reveal`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
  const json = await res.json();
  if (!res.ok) {
    return { success: false, ativo: '', corretora: '', preco_atual: 0, timeframes: [], credits_remaining: 0, error: json.message || json.error || 'Erro ao revelar alerta' };
  }
  const payload = json.data || json;
  return { success: true, ativo: payload.ativo, corretora: payload.corretora, preco_atual: payload.preco_atual, timeframes: payload.timeframes || [], credits_remaining: payload.credits_remaining || 0 };
}

// ─── PROXY DE PREÇOS ──────────────────────────────────────────

export async function fetchPrice(symbol: string): Promise<{ price: number; exchange: string; symbol: string; timestamp: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/price/${encodeURIComponent(symbol)}`, { headers: getAuthHeaders() });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ─── ESTATISTICAS ─────────────────────────────────────────────

export async function fetchEstatisticas() {
  const res = await fetch(`${API_BASE}/v1/estatisticas`, { headers: getAuthHeaders() });
  return res.json();
}

// ─── ALERTAS SSE ──────────────────────────────────────────────

export function connectAlertasSSE(onMessage: (data: any) => void): EventSource {
  const token = localStorage.getItem('genesis_token');
  const url = `${API_BASE}/v1/alertas/stream${token ? `?token=${token}` : ''}`;
  const es = new EventSource(url);
  es.onmessage = (event) => {
    if (event.data === 'ping') return;
    try {
      const data = JSON.parse(event.data);
      if (data._reconnect) return; // Servidor pediu reconexão — EventSource reconecta sozinho
      onMessage(data);
    } catch (_) {}
  };
  return es;
}

// ─── IA GATEWAY ───────────────────────────────────────────────

export async function scangraph(imageFile: File) {
  const formData = new FormData();
  formData.append('image', imageFile);
  const res = await fetch(`${API_BASE}/v1/scangraph`, {
    method: 'POST',
    headers: getFormDataHeaders(),
    body: formData,
  });
  return res.json();
}

export async function analyze(imageFile: File, params: Record<string, any>) {
  const formData = new FormData();
  formData.append('image', imageFile);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  const res = await fetch(`${API_BASE}/v1/analyze`, {
    method: 'POST',
    headers: getFormDataHeaders(),
    body: formData,
  });
  return res.json();
}

// ─── ALERTAS — CONFIGURAÇÃO E MONITORAMENTO ───────────────────

export async function fetchAlertaConfig() {
  const res = await fetch(`${API_BASE}/v1/admin/alerta-config`, { headers: getAuthHeaders() });
  return res.json();
}

export async function updateAlertaConfig(carteira: string, data: { passo_valorizacao: number; passo_desvalorizacao: number; intervalo_minutos: number; ativo: boolean }) {
  const res = await fetch(`${API_BASE}/v1/admin/alerta-config/${encodeURIComponent(carteira)}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchMonitorStatus() {
  const res = await fetch(`${API_BASE}/v1/admin/monitor/status`, { headers: getAuthHeaders() });
  return res.json();
}

export async function resetMonitorAlerta(carteira: string) {
  const res = await fetch(`${API_BASE}/v1/admin/monitor/reset/${encodeURIComponent(carteira)}`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function fetchMonitorLog(page?: number) {
  const url = page
    ? `${API_BASE}/v1/admin/monitor/log?page=${page}`
    : `${API_BASE}/v1/admin/monitor/log`;
  const res = await fetch(url, { headers: getAuthHeaders() });
  return res.json();
}
