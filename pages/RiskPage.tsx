import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import RiskCalculatorModal from '../components/RiskCalculatorModal';

const RiskPage: React.FC = () => {
  const { currentPrice, exchange } = useAppContext();
  return <RiskCalculatorModal currentPrice={currentPrice} exchange={exchange} />;
};

export default RiskPage;
