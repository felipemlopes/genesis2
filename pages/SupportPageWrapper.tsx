import React from 'react';
import SupportPage from '../components/SupportPage';

const SupportPageWrapper: React.FC = () => <SupportPage onBack={() => window.history.back()} />;

export default SupportPageWrapper;
