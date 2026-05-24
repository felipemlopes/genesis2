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
  const res = await fetch(`${API_BASE}/v1/analises`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateResultadoAnalise(id: number, data: any) {
  const res = await fetch(`${API_BASE}/v1/analises/${id}/resultado`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
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
