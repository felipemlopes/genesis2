/**
 * Spec genesis-seguranca-correcoes (S8/S17) + V6.12 (§12.1): o servidor Node do front deixou de
 * existir. Em 29/09 saíram as rotas legadas (injeção de SQL no PUT de carteira, stream de alertas sem
 * login, login LastLink com JWT próprio, proxy aberto da Bybit — a prova de exploração delas ficou
 * registrada no tasks.md da spec de segurança). Em 30/09 saiu o próprio `server.ts`: produção sobe
 * `vite preview` (ecosystem.config.cjs), desenvolvimento sobe `vite`.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

const raiz = path.resolve(__dirname, '../..');
const pacote = JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf-8'));

describe('S8/S17 + V6.12: o front não tem mais servidor Node próprio', () => {
  it('server.ts, rotas legadas e acesso direto ao MySQL não existem', () => {
    for (const arquivo of ['server.ts', 'routes/api.js', 'services/database.ts']) {
      expect(fs.existsSync(path.join(raiz, arquivo)), arquivo).toBe(false);
    }
  });

  it('nenhuma dependência de servidor sobrou no package.json', () => {
    const todas = { ...pacote.dependencies, ...pacote.devDependencies };
    for (const dependencia of ['express', 'cors', 'express-rate-limit', 'jsonwebtoken', 'mysql2', 'dotenv', '@types/express', '@types/cors']) {
      expect(todas, dependencia).not.toHaveProperty(dependencia);
    }
  });

  it('scripts só do Vite: dev, build e preview; sem start de servidor', () => {
    expect(pacote.scripts.dev).toBe('vite');
    expect(pacote.scripts.build).toBe('vite build');
    expect(pacote.scripts.preview).toBe('vite preview');
    expect(pacote.scripts).not.toHaveProperty('start');
  });

  it('produção continua subindo o vite preview', () => {
    const ecossistema = fs.readFileSync(path.join(raiz, 'ecosystem.config.cjs'), 'utf-8');
    expect(ecossistema).toContain('run preview');
    expect(ecossistema).not.toContain('server.cjs');
  });
});
