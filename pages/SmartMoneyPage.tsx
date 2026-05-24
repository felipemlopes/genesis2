import React from 'react';
import { useAppContext } from '../contexts/AppContext';
import SmartMoney from '../components/SmartMoney';

const SmartMoneyPage: React.FC = () => {
  const { selectedPair } = useAppContext();
  return <SmartMoney selectedPair={selectedPair} />;
};

export default SmartMoneyPage;
