import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Texto curto exibido no lugar do componente que falhou. */
  mensagem?: string;
}

interface ErrorBoundaryState {
  falhou: boolean;
}

/**
 * Isola erro de renderização de um bloco (bug relatado por cliente: CarteiraCripto derrubava a
 * página inteira) — o resto do dashboard continua funcionando e o membro pode tentar de novo.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // O projeto não tem @types/react — os membros herdados que este componente usa ficam declarados
  // aqui pra o tsc enxergá-los.
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: ErrorBoundaryState) => void;

  state: ErrorBoundaryState = { falhou: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { falhou: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (!this.state.falhou) {
      return this.props.children;
    }

    return (
      <div className="p-6 rounded-lg border border-white/10 bg-black/30 text-sm text-gray-300">
        <p>{this.props.mensagem ?? 'Não foi possível carregar esta seção.'}</p>
        <button
          type="button"
          onClick={() => this.setState({ falhou: false })}
          className="mt-3 text-xs font-bold text-genesis-accent cursor-pointer hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
