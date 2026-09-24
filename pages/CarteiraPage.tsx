import React from 'react';
import CarteiraCripto from '../components/CarteiraCripto';
import ErrorBoundary from '../components/ErrorBoundary';

const CarteiraPage: React.FC = () => (
  <ErrorBoundary mensagem="Não foi possível carregar a carteira agora.">
    <CarteiraCripto />
  </ErrorBoundary>
);

export default CarteiraPage;
