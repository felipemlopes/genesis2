import React, { useState, useEffect } from 'react';
import { Bell, Save, Settings, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchAlertaConfig, updateAlertaConfig } from '../services/api';

interface AlertaConfig {
  tipo_carteira: 'mae' | 'gemas';
  passo_valorizacao: number;
  passo_desvalorizacao: number;
  intervalo_minutos: number;
  ativo: boolean;
}

interface FormState {
  passo_valorizacao: string;
  passo_desvalorizacao: string;
  intervalo_minutos: string;
  ativo: boolean;
}

interface FormErrors {
  passo_valorizacao?: string;
  passo_desvalorizacao?: string;
  intervalo_minutos?: string;
}

interface FeedbackState {
  type: 'success' | 'error';
  message: string;
}

const DEFAULT_FORM: FormState = {
  passo_valorizacao: '5',
  passo_desvalorizacao: '5',
  intervalo_minutos: '5',
  ativo: true,
};

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const passoVal = parseFloat(form.passo_valorizacao);
  const passoDesval = parseFloat(form.passo_desvalorizacao);
  const intervalo = parseInt(form.intervalo_minutos, 10);

  if (isNaN(passoVal) || passoVal <= 0 || passoVal > 100) {
    errors.passo_valorizacao = 'Deve ser > 0 e ≤ 100';
  }
  if (isNaN(passoDesval) || passoDesval <= 0 || passoDesval > 100) {
    errors.passo_desvalorizacao = 'Deve ser > 0 e ≤ 100';
  }
  if (isNaN(intervalo) || intervalo < 1 || intervalo > 1440) {
    errors.intervalo_minutos = 'Deve ser ≥ 1 e ≤ 1440';
  }

  return errors;
}

const AlertConfigPanel: React.FC = () => {
  const [maeForm, setMaeForm] = useState<FormState>(DEFAULT_FORM);
  const [gemasForm, setGemasForm] = useState<FormState>(DEFAULT_FORM);
  const [maeErrors, setMaeErrors] = useState<FormErrors>({});
  const [gemasErrors, setGemasErrors] = useState<FormErrors>({});
  const [maeFeedback, setMaeFeedback] = useState<FeedbackState | null>(null);
  const [gemasFeedback, setGemasFeedback] = useState<FeedbackState | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMae, setSavingMae] = useState(false);
  const [savingGemas, setSavingGemas] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const res = await fetchAlertaConfig();
      const configs: AlertaConfig[] = res.data || [];

      const mae = configs.find((c) => c.tipo_carteira === 'mae');
      const gemas = configs.find((c) => c.tipo_carteira === 'gemas');

      if (mae) {
        setMaeForm({
          passo_valorizacao: String(mae.passo_valorizacao),
          passo_desvalorizacao: String(mae.passo_desvalorizacao),
          intervalo_minutos: String(mae.intervalo_minutos),
          ativo: mae.ativo,
        });
      }
      if (gemas) {
        setGemasForm({
          passo_valorizacao: String(gemas.passo_valorizacao),
          passo_desvalorizacao: String(gemas.passo_desvalorizacao),
          intervalo_minutos: String(gemas.intervalo_minutos),
          ativo: gemas.ativo,
        });
      }
    } catch {
      setMaeFeedback({ type: 'error', message: 'Erro ao carregar configurações' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(carteira: 'mae' | 'gemas') {
    const form = carteira === 'mae' ? maeForm : gemasForm;
    const setErrors = carteira === 'mae' ? setMaeErrors : setGemasErrors;
    const setFeedback = carteira === 'mae' ? setMaeFeedback : setGemasFeedback;
    const setSaving = carteira === 'mae' ? setSavingMae : setSavingGemas;

    const errors = validateForm(form);
    setErrors(errors);

    if (Object.keys(errors).length > 0) return;

    try {
      setSaving(true);
      setFeedback(null);

      await updateAlertaConfig(carteira, {
        passo_valorizacao: parseFloat(form.passo_valorizacao),
        passo_desvalorizacao: parseFloat(form.passo_desvalorizacao),
        intervalo_minutos: parseInt(form.intervalo_minutos, 10),
        ativo: form.ativo,
      });

      setFeedback({ type: 'success', message: 'Configuração salva com sucesso' });
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao salvar configuração' });
    } finally {
      setSaving(false);
    }
  }

  function renderCarteiraSection(
    title: string,
    carteira: 'mae' | 'gemas',
    form: FormState,
    setForm: React.Dispatch<React.SetStateAction<FormState>>,
    errors: FormErrors,
    feedback: FeedbackState | null,
    saving: boolean
  ) {
    return (
      <div className="bg-[#0b0b0f] border border-white/5 rounded-2xl p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">
              {form.ativo ? 'Ativo' : 'Inativo'}
            </span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, ativo: !prev.ativo }))}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                form.ativo ? 'bg-genesis-accent' : 'bg-white/10'
              }`}
              aria-label={`Toggle monitoramento ${title}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                  form.ativo ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* Passo Valorização */}
          <div>
            <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1.5">
              Passo Valorização (%)
            </label>
            <input
              type="number"
              value={form.passo_valorizacao}
              onChange={(e) => setForm((prev) => ({ ...prev, passo_valorizacao: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none focus:border-genesis-accent font-mono"
              placeholder="Ex: 5"
              min="0.01"
              max="100"
              step="0.01"
            />
            {errors.passo_valorizacao && (
              <span className="text-[9px] text-red-400 mt-1 block">{errors.passo_valorizacao}</span>
            )}
          </div>

          {/* Passo Desvalorização */}
          <div>
            <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1.5">
              Passo Desvalorização (%)
            </label>
            <input
              type="number"
              value={form.passo_desvalorizacao}
              onChange={(e) => setForm((prev) => ({ ...prev, passo_desvalorizacao: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none focus:border-genesis-accent font-mono"
              placeholder="Ex: 5"
              min="0.01"
              max="100"
              step="0.01"
            />
            {errors.passo_desvalorizacao && (
              <span className="text-[9px] text-red-400 mt-1 block">{errors.passo_desvalorizacao}</span>
            )}
          </div>

          {/* Intervalo Minutos */}
          <div>
            <label className="text-[9px] text-gray-500 uppercase font-bold tracking-widest block mb-1.5">
              Intervalo de Verificação (min)
            </label>
            <input
              type="number"
              value={form.intervalo_minutos}
              onChange={(e) => setForm((prev) => ({ ...prev, intervalo_minutos: e.target.value }))}
              className="w-full bg-black border border-white/10 rounded p-3 text-xs text-white outline-none focus:border-genesis-accent font-mono"
              placeholder="Ex: 5"
              min="1"
              max="1440"
              step="1"
            />
            {errors.intervalo_minutos && (
              <span className="text-[9px] text-red-400 mt-1 block">{errors.intervalo_minutos}</span>
            )}
          </div>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${
              feedback.type === 'success' ? 'text-genesis-positive' : 'text-red-400'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
            {feedback.message}
          </div>
        )}

        {/* Save Button */}
        <button
          type="button"
          onClick={() => handleSave(carteira)}
          disabled={saving}
          className="mt-6 w-full flex items-center justify-center gap-2 bg-genesis-accent/10 border border-genesis-accent/30 hover:bg-genesis-accent/20 text-genesis-accent text-[10px] uppercase font-bold tracking-widest rounded-lg py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={12} />
          {saving ? 'Salvando...' : 'Salvar Configuração'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-[#0b0b0f] border border-white/5 rounded-2xl p-8 flex items-center justify-center">
        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-widest animate-pulse">
          Carregando configurações...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-genesis-accent/10 rounded-lg flex items-center justify-center">
          <Bell size={14} className="text-genesis-accent" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Settings size={12} className="text-gray-500" />
            Configuração de Alertas
          </h2>
          <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">
            Defina os parâmetros de monitoramento para cada carteira
          </p>
        </div>
      </div>

      {/* Carteira Sections Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderCarteiraSection(
          'Carteira Mãe',
          'mae',
          maeForm,
          setMaeForm,
          maeErrors,
          maeFeedback,
          savingMae
        )}
        {renderCarteiraSection(
          'Carteira Gema',
          'gemas',
          gemasForm,
          setGemasForm,
          gemasErrors,
          gemasFeedback,
          savingGemas
        )}
      </div>
    </div>
  );
};

export default AlertConfigPanel;
