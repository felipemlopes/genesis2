import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppContext } from '../contexts/AppContext';

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAppContext();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
