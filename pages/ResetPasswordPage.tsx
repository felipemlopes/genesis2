import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, CheckCircle2 } from 'lucide-react';
import {
  ErroSenha,
  lerLinkDeRedefinicao,
  pedirRecuperacaoSenha,
  redefinirSenha,
  SENHA_MINIMA,
  validarNovaSenha,
} from '../services/recuperacaoSenha';

/**
 * Spec genesis-auth-recuperacao-senha (Fase 2, R3): tela aberta pelo link do e-mail
 * (`/redefinir-senha?token=...&email=...`). O token sai da barra de endereço na hora e fica só
 * na memória da página. Depois de trocar, volta para o login (D4).
 */
const campo =
  'w-full bg-[#0A0A0B] border border-white/5 rounded-2xl py-4 pl-14 pr-4 text-sm text-white focus:outline-none focus:border-genesis-accent/50 transition-all duration-300 font-mono';

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  // Lido uma vez, antes de limpar a URL.
  const [link] = useState(() => lerLinkDeRedefinicao(window.location.search));
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [linkInvalido, setLinkInvalido] = useState(!link);
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState('');
  const [reenvio, setReenvio] = useState('');

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, []);

  const trocar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || enviando) return;
    const problema = validarNovaSenha(senha, confirmacao);
    if (problema) {
      setErro(problema);
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      const msg = await redefinirSenha({
        token: link.token,
        email: link.email,
        password: senha,
        password_confirmation: confirmacao,
      });
      setConcluido(msg);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      const e2 = err instanceof ErroSenha ? err : new ErroSenha('Não foi possível concluir agora.', 0);
      setErro(e2.message);
      if (e2.linkInvalido) setLinkInvalido(true);
    } finally {
      setEnviando(false);
    }
  };

  const pedirOutro = async () => {
    if (!link?.email || enviando) return;
    setEnviando(true);
    try {
      setReenvio(await pedirRecuperacaoSenha(link.email));
    } catch (err) {
      setReenvio(err instanceof ErroSenha ? err.message : 'Não foi possível pedir outro link agora.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 text-white font-sans" style={{ backgroundColor: '#0A0A0B' }}>
      <div className="w-full max-w-md bg-[#0c0c0e] border border-white/5 rounded-[31px] p-8 md:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-light tracking-widest mb-3">NOVA SENHA</h1>
          <p className="text-genesis-text-secondary text-[10px] uppercase tracking-[0.3em]">Gênesis Labs</p>
        </div>

        {concluido ? (
          <div className="text-center space-y-4" role="status">
            <CheckCircle2 className="mx-auto text-genesis-positive" size={32} />
            <p className="text-sm">{concluido}</p>
            <button onClick={() => navigate('/login', { replace: true })} className="text-xs text-genesis-accent hover:text-white uppercase tracking-[0.2em]">
              Ir para o login
            </button>
          </div>
        ) : linkInvalido ? (
          <div className="text-center space-y-6">
            <p className="text-sm text-white/80">
              {erro || 'Este link de recuperação não é válido. Abra o link mais recente que enviamos por e-mail ou peça outro.'}
            </p>
            {link?.email && !reenvio && (
              <button
                onClick={pedirOutro}
                disabled={enviando}
                className="w-full h-12 rounded-2xl border border-genesis-accent/30 text-[10px] font-bold uppercase tracking-[0.3em] hover:border-genesis-accent/60 disabled:opacity-40"
              >
                {enviando ? 'Enviando...' : 'Pedir outro link'}
              </button>
            )}
            {reenvio && <p className="text-xs text-genesis-positive">{reenvio}</p>}
            <button onClick={() => navigate('/login', { replace: true })} className="text-xs text-white/50 hover:text-white uppercase tracking-[0.2em]">
              Voltar para o login
            </button>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={trocar}>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input type="email" value={link?.email ?? ''} readOnly aria-label="E-mail" className={`${campo} text-white/50`} />
            </div>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={`Nova senha (mínimo ${SENHA_MINIMA})`}
                aria-label="Nova senha"
                className={campo}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20" size={16} />
              <input
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.target.value)}
                placeholder="Repita a nova senha"
                aria-label="Repita a nova senha"
                className={campo}
              />
            </div>
            {erro && <p className="text-red-500 text-xs text-center font-medium">{erro}</p>}
            <button
              type="submit"
              disabled={enviando || !senha || !confirmacao}
              className="w-full h-14 rounded-2xl font-bold text-[10px] uppercase tracking-[0.3em] bg-white/[0.03] border border-genesis-positive/30 hover:border-genesis-positive/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enviando ? 'Salvando...' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
