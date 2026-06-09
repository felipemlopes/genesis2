import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../layouts/AppLayout';
import ProtectedRoute from '../components/ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import VersionSelector from '../components/VersionSelector';

const GenesisPage = lazy(() => import('../pages/GenesisPage'));
const CarteiraPage = lazy(() => import('../pages/CarteiraPage'));
const ActiveTradesPage = lazy(() => import('../pages/ActiveTradesPage'));
const HistoryPage = lazy(() => import('../pages/HistoryPage'));
const AnalysisHistoryPage = lazy(() => import('../pages/AnalysisHistoryPage'));
const ScannerPage = lazy(() => import('../pages/ScannerPage'));
const RiskPage = lazy(() => import('../pages/RiskPage'));
const FlowTrackPage = lazy(() => import('../pages/FlowTrackPage'));
const FundingPage = lazy(() => import('../pages/FundingPage'));
const LiquidationPage = lazy(() => import('../pages/LiquidationPage'));
const OiMonitorPage = lazy(() => import('../pages/OiMonitorPage'));
const LiquidityMapPage = lazy(() => import('../pages/LiquidityMapPage'));
const SmartMoneyPage = lazy(() => import('../pages/SmartMoneyPage'));
const PatternsPageWrapper = lazy(() => import('../pages/PatternsPageWrapper'));
const TrendAnalyzerPage = lazy(() => import('../pages/TrendAnalyzerPage'));
const SupportPageWrapper = lazy(() => import('../pages/SupportPageWrapper'));
const NewListingsPage = lazy(() => import('../pages/NewListingsPage'));
const LearnPage = lazy(() => import('../pages/LearnPage'));
const MindMetricsPage = lazy(() => import('../pages/MindMetricsPage'));
const GeopoliticalPage = lazy(() => import('../pages/GeopoliticalPage'));

const Loading = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-6 h-6 border-2 border-genesis-positive border-t-transparent rounded-full animate-spin" />
  </div>
);

const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/select-version',
    element: <VersionSelector />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <AppLayout />,
        children: [
          { index: true, element: <SuspenseWrapper><GenesisPage /></SuspenseWrapper> },
          { path: 'carteira', element: <SuspenseWrapper><CarteiraPage /></SuspenseWrapper> },
          { path: 'trades', element: <SuspenseWrapper><ActiveTradesPage /></SuspenseWrapper> },
          { path: 'historico', element: <SuspenseWrapper><HistoryPage /></SuspenseWrapper> },
          { path: 'performance', element: <SuspenseWrapper><AnalysisHistoryPage /></SuspenseWrapper> },
          { path: 'scanner', element: <SuspenseWrapper><ScannerPage /></SuspenseWrapper> },
          { path: 'padroes', element: <SuspenseWrapper><PatternsPageWrapper /></SuspenseWrapper> },
          { path: 'tendencia', element: <SuspenseWrapper><TrendAnalyzerPage /></SuspenseWrapper> },
          { path: 'mind-metrics', element: <SuspenseWrapper><MindMetricsPage /></SuspenseWrapper> },
          { path: 'flowtrack', element: <SuspenseWrapper><FlowTrackPage /></SuspenseWrapper> },
          { path: 'funding', element: <SuspenseWrapper><FundingPage /></SuspenseWrapper> },
          { path: 'liquidacao', element: <SuspenseWrapper><LiquidationPage /></SuspenseWrapper> },
          { path: 'oi-monitor', element: <SuspenseWrapper><OiMonitorPage /></SuspenseWrapper> },
          { path: 'liquidez', element: <SuspenseWrapper><LiquidityMapPage /></SuspenseWrapper> },
          { path: 'smart-money', element: <SuspenseWrapper><SmartMoneyPage /></SuspenseWrapper> },
          { path: 'geopolitica', element: <SuspenseWrapper><GeopoliticalPage /></SuspenseWrapper> },
          { path: 'risco', element: <SuspenseWrapper><RiskPage /></SuspenseWrapper> },
          { path: 'listagens', element: <SuspenseWrapper><NewListingsPage /></SuspenseWrapper> },
          { path: 'aprender', element: <SuspenseWrapper><LearnPage /></SuspenseWrapper> },
          { path: 'suporte', element: <SuspenseWrapper><SupportPageWrapper /></SuspenseWrapper> },
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);
