import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: [
          'sandbox.genesislabs.com.br',
          'genesislabs.com.br',
          'teste.genesislabs.com.br',
          '*.genesislabs.com.br',
        ],
      },
      plugins: [react()],
      define: {
        'process.env.API_BASE_URL': JSON.stringify(env.API_BASE_URL),
        'process.env.AI_GATEWAY': JSON.stringify(env.AI_GATEWAY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
