import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import { router } from './router';
import { AppProvider } from './contexts/AppContext';
import { GeoEngineProvider } from './contexts/GeoEngineContext';

Chart.register(...registerables);

const rootElement = document.getElementById('root') as HTMLElement;
const root = createRoot(rootElement);

root.render(
  <AppProvider>
    <GeoEngineProvider>
      <RouterProvider router={router} />
    </GeoEngineProvider>
  </AppProvider>
);
