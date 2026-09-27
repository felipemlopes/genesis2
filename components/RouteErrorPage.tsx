import React, { useEffect } from 'react';
import { useRouteError } from 'react-router-dom';

// errorElement das rotas: sem ele o React Router mostra a tela de desenvolvedor ("Hey developer",
// stack trace) para o membro. Aqui o erro vai só para o console e a pessoa recebe um botão de recarregar.
const RouteErrorPage: React.FC = () => {
  const error = useRouteError();

  useEffect(() => {
    console.error('[RouteErrorPage]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0B] text-white px-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold mb-3">Algo deu errado nesta tela</h1>
        <p className="text-sm text-white/60 mb-6">
          Recarregue a página para continuar. Se o erro voltar e o navegador estiver traduzindo o site,
          desative a tradução para o Gênesis Labs.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2 rounded-lg bg-genesis-positive text-black text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
};

export default RouteErrorPage;
