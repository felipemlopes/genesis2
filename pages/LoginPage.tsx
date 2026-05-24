import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';
import LandingPage from '../components/LandingPage';

const LoginPage: React.FC = () => {
  const { setIsAuthenticated, isAuthenticated } = useAppContext();
  const navigate = useNavigate();

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return <LandingPage onLogin={() => setIsAuthenticated(true)} />;
};

export default LoginPage;
