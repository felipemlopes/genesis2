import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    // .kilo/worktrees/ é cópia local antiga do projeto (não versionada) — rodava a suíte duas vezes,
    // com código desatualizado, e respondia pela maior parte das falhas "pré-existentes".
    exclude: ['**/node_modules/**', '**/dist/**', '.kilo/**'],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': '.',
    },
  },
});
