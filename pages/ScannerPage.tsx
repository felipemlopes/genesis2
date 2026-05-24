import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import OpportunityScanner from '../components/OpportunityScanner';

const ScannerPage: React.FC = () => {
  const navigate = useNavigate();
  const { scannerState, setScannerState, setExchange, setSelectedPair, setTimeframe } = useAppContext();

  const handleAnalyzeOpportunity = (ex: string, pair: string, tf: string) => {
    setExchange(ex);
    setSelectedPair(pair);
    setTimeframe(tf);
    navigate('/dashboard');
  };

  return (
    <OpportunityScanner
      onAnalyze={handleAnalyzeOpportunity}
      savedState={scannerState}
      onSaveState={(newState) => setScannerState((prev) => ({ ...prev, ...newState }))}
    />
  );
};

export default ScannerPage;
