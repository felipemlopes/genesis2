# Plano de Implementação: Visual Polish

## Visão Geral

Implementação incremental das melhorias visuais para alinhar o frontend 2.0-main com a versão oficial. A ordem prioriza dependências: utilitário shimmer (base para outros componentes) → LandingPage (maior volume de mudanças) → novos componentes → ajustes menores.

## Tasks

- [x] 1. Implementar efeito Shimmer reutilizável (CSS global)
  - [x] 1.1 Adicionar keyframes e classes shimmer no `index.html`
    - Inserir na seção `<style type="text/tailwindcss">` os keyframes `shimmer`, classes `.shimmer-effect` e `.shimmer-hover`
    - Garantir `pointer-events: none` em ambas as classes
    - Gradiente: `from-transparent via-white/5 to-transparent`
    - Duração padrão: 2s infinito (`.shimmer-effect`) e 1.5s hover (`.shimmer-hover`)
    - _Requisitos: 10.1, 10.2, 10.3_

  - [ ]* 1.2 Escrever teste unitário para presença do shimmer no DOM
    - Verificar que as classes `.shimmer-effect` e `.shimmer-hover` estão disponíveis globalmente
    - _Requisitos: 10.1_

- [x] 2. Implementar Background Animado 3D e Hero na LandingPage
  - [x] 2.1 Substituir background estático por orbs `motion.div` com animação 3D
    - Usar `motion.div` com `animate` para `x`, `y` e `scale` simultâneos (ativa translate3d via GPU)
    - Orbs com dimensões mínimas 50% largura / 70% altura
    - Gradientes radiais com opacidade 0.05–0.06, blur-[120px]
    - Duração 22s e 25s, `repeat: Infinity`, `ease: 'easeInOut'`
    - Container com `pointer-events-none` e `overflow-hidden`
    - _Requisitos: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implementar Hero Section com motion.div e texto gradiente
    - Envolver conteúdo hero em `motion.div` com `initial={{ opacity: 0, y: 20 }}` e `animate={{ opacity: 1, y: 0 }}`
    - Substituir `drop-shadow` de "Fronteira" por `bg-clip-text text-transparent bg-gradient-to-r`
    - Botão principal "Acessar" com glassmorphism (`bg-white/[0.02]`, borda sutil, shimmer interno, glow no hover)
    - _Requisitos: 3.1, 3.2, 3.3_

  - [ ]* 2.3 Escrever testes unitários para LandingPage (background + hero)
    - Verificar presença de `motion.div` com classe `blur-[120px]`
    - Verificar que "Fronteira" usa `bg-clip-text` e NÃO `drop-shadow`
    - _Requisitos: 1.1, 3.2_

- [x] 3. Implementar Header Pill e Cards de Filosofia na LandingPage
  - [x] 3.1 Refatorar header para container pill com glassmorphism
    - Container: `bg-[#0c0c0e]/80`, `backdrop-blur-xl`, `border border-white/5`, `rounded-2xl`, `shadow-[0_10px_30px_rgba(0,0,0,0.5)]`
    - Links com underline animado (span `w-0 group-hover:w-full` com gradiente)
    - Botão "Acessar" com shimmer interno + ícone `ArrowRight` com `hover:translate-x-1`
    - Logo: `w-10 h-10 rounded-xl`, `border-white/5`, overlay gradiente no hover, sombra roxa
    - _Requisitos: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Implementar cards de filosofia com stagger e neon glow
    - Envolver cada card em `motion.div` com `whileInView`, stagger delay `i * 0.15`
    - Borda neon: div absoluto com `blur-[6px]` e `group-hover:opacity-100`
    - Shimmer interno no hover via classe `.shimmer-hover`
    - Padding mínimo `p-10` nos cards
    - _Requisitos: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 3.3 Escrever teste property-based: stagger delay escala com índice
    - **Property 1: Stagger delay escala com índice**
    - Para qualquer array de N cards (1 ≤ N ≤ 20) e staggerInterval positivo, delay[i] === i * staggerInterval
    - **Valida: Requisitos 4.1, 9.2**

- [ ] 4. Checkpoint — Verificar LandingPage completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Criar componente VersionSelector
  - [x] 5.1 Criar `components/VersionSelector.tsx` com interface e estrutura base
    - Interface: `VersionSelectorProps { onSelectVersion?: (version: 1 | 2) => void }`
    - Layout tela cheia (`fixed inset-0`) com background 3D (orbs animados)
    - Grid `grid-cols-1 md:grid-cols-2 gap-8` centralizado
    - Montar na rota raiz `/` do react-router-dom (antes do fluxo de autenticação)
    - _Requisitos: 5.1, 5.5, 5.8_

  - [x] 5.2 Implementar cards de versão com efeitos visuais e lógica de navegação
    - Cards com `min-h-[420px]` e borda dupla neon (camada blur + camada sólida)
    - Hover: `shadow-[0_0_60px_rgba(176,38,255,0.3)]` + linha `h-px` expandível `w-0 group-hover:w-full`
    - Botão com shimmer + logo placeholder com shimmer horizontal
    - Versão 1 selecionada: `window.location.href = import.meta.env.VITE_V1_URL`
    - Versão 2 selecionada: `navigate('/login')` via `useNavigate`
    - Adicionar `VITE_V1_URL` no `.env` e `.env.example`
    - _Requisitos: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9_

  - [ ]* 5.3 Escrever teste property-based: callback retorna versão válida
    - **Property 3: VersionSelector callback retorna versão válida**
    - Para qualquer sequência de cliques simulados, callback sempre recebe 1 ou 2
    - **Valida: Requisitos 5.5**

  - [ ]* 5.4 Escrever testes unitários para VersionSelector
    - Verificar renderização de 2 cards com `min-h-[420px]`
    - Verificar presença de background 3D
    - _Requisitos: 5.1, 5.2_

- [x] 6. Modificar AlertaPopup (RadarNewsPopup) com countdown e glow direcional
  - [x] 6.1 Ajustar estilos e barra de progresso no `RadarNewsPopup.tsx`
    - Alterar largura para `w-[350px]`
    - Alterar duração do keyframe `radarProgress` para 12s
    - Manter animação de entrada `animate-in slide-in-from-right fade-in duration-500`
    - Adicionar `border-t border-white/5` entre seções de conteúdo
    - _Requisitos: 6.1, 6.4, 6.5, 6.6_

  - [x] 6.2 Implementar glow direcional por market_bias
    - Bullish: `shadow-[0_0_15px_rgba(16,185,129,0.2)]`
    - Bearish: `shadow-[0_0_15px_rgba(239,68,68,0.2)]`
    - Lógica condicional baseada em `item.market_bias`
    - _Requisitos: 6.2, 6.3_

  - [ ]* 6.3 Escrever teste property-based: glow direcional corresponde ao bias
    - **Property 2: Glow direcional corresponde ao bias**
    - Para qualquer alerta com market_bias BULLISH/BEARISH/NEUTRAL, a classe de glow deve conter a cor correta
    - **Valida: Requisitos 6.2, 6.3**

- [x] 7. Ajustes no GeopoliticalRadar (RadarNews)
  - [x] 7.1 Adicionar glow no pill de status do `GeopoliticalRadar.tsx`
    - Adicionar `shadow-[0_0_10px_rgba(57,255,20,0.3)]` no pill quando monitoramento ativo
    - Garantir estilo glassmorphism no pill de status
    - _Requisitos: 7.3, 7.4_

- [x] 8. Implementar labels responsivos na Sidebar
  - [x] 8.1 Aplicar classes responsivas nos labels do `Sidebar.tsx`
    - Títulos de seção (Principal, Análise, Mercado, Contexto): `hidden lg:block`
    - Labels dos itens de menu: `hidden lg:block` ou `hidden lg:flex`
    - Viewport < lg: exibir apenas ícones
    - _Requisitos: 8.1, 8.2, 8.3_

  - [ ]* 8.2 Escrever teste property-based: labels possuem classes responsivas
    - **Property 4: Labels da sidebar possuem classes responsivas**
    - Para qualquer conjunto de items de menu gerado, todos os labels devem conter `hidden` + `lg:block` ou `lg:flex`
    - **Valida: Requisitos 8.1, 8.2**

- [x] 9. Implementar stagger animations globais nos cards do app
  - [x] 9.1 Aplicar motion wrapper com stagger nos dashboards
    - Envolver cards em `motion.div` com `initial={{ opacity: 0, y: 10 }}` e `animate={{ opacity: 1, y: 0 }}`
    - Delays incrementais: `delay: index * 0.08`
    - `ease: 'easeOut'`, duração 0.4s
    - Aplicar no `AppLayout.tsx` ou diretamente nos grids de cards das páginas principais
    - _Requisitos: 9.1, 9.2, 9.3_

- [ ] 10. Checkpoint final — Validação completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- Tasks marcadas com `*` são opcionais e podem ser ignoradas para um MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes property-based validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
