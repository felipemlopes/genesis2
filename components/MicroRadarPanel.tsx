import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, AlertTriangle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

interface RadarAlerta {
  id: number;
  tipo: string;
  urgencia: string;
  criado_em: string;
  status: string;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('genesis_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

const MicroRadarPanel: React.FC = () => {
  const navigate = useNavigate();
  const [alerta, setAlerta] = useState<RadarAlerta | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  const fetchAlerta = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/radar/alertas`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const json = await res.json();
      setAlerta(json.data || null);
      setErro(null);
    } catch {
      // Silent fail on polling errors
    }
  }, []);

  // Polling every 30s
  useEffect(() => {
    setLoading(true);
    fetchAlerta().finally(() => setLoading(false));
    const interval = setInterval(fetchAlerta, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerta]);

  const handleAnalisar = async () => {
    if (!alerta || revealing) return;
    setRevealing(true);
    setErro(null);

    try {
      const res = await fetch(`${API_BASE}/v1/radar/revelar/${alerta.id}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const json = await res.json();

      if (res.status === 402) {
        setErro('Créditos insuficientes');
        return;
      }

      if (!res.ok) {
        setErro(json.message || 'Erro ao revelar alerta');
        return;
      }

      const { ativo, corretora, timeframe } = json.data;
      setAlerta(null);
      navigate(
        `/dashboard?symbol=${encodeURIComponent(ativo)}&exchange=${encodeURIComponent(corretora)}&timeframe=${encodeURIComponent(timeframe || '1h')}&radar_id=${alerta.id}`
      );
    } catch {
      setErro('Erro de rede. Tente novamente.');
    } finally {
      setRevealing(false);
    }
  };

  if (loading && !alerta) return null;
  if (!alerta) return null;

  return (
    <div className="bg-[#0a0a0f] border border-genesis-accent/20 rounded-xl p-4 shadow-[0_0_20px_rgba(176,38,255,0.05)]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-genesis-accent/10 flex items-center justify-center">
          <Radar size={18} className="text-genesis-accent animate-pulse" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white uppercase tracking-wider">
            Oportunidade detectada
          </p>
          <p className="text-[10px] text-genesis-text-secondary mt-0.5">
            Clique para revelar o ativo
          </p>
        </div>
        <button
          onClick={handleAnalisar}
          disabled={revealing}
          className="px-4 py-2 bg-genesis-accent hover:bg-genesis-accent/80 text-white text-xs font-bold uppercase tracking-widest rounded-md animate-pulse disabled:opacity-50 disabled:animate-none transition-all shadow-[0_0_15px_rgba(176,38,255,0.3)]"
        >
          {revealing ? '...' : 'ANALISAR'}
        </button>
      </div>

      {erro && (
        <div className="mt-3 flex items-center gap-2 text-genesis-negative text-[10px]">
          <AlertTriangle size={12} />
          <span>{erro}</span>
        </div>
      )}
    </div>
  );
};

export default MicroRadarPanel;
