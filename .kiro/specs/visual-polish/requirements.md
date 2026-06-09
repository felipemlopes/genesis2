# Documento de Requisitos — Visual Polish

## Introdução

Este documento especifica os requisitos visuais e cosméticos para alinhar o frontend 2.0-main com a versão oficial (0012-oficial-gemini-3.1). Trata-se exclusivamente de mudanças visuais — animações, efeitos, componentes de apresentação e responsividade — sem alteração de lógica de negócio.

## Glossário

- **LandingPage**: Componente de página inicial pré-autenticação (`components/LandingPage.tsx`)
- **Sidebar**: Barra lateral de navegação do aplicativo (`components/Sidebar.tsx`)
- **VersionSelector**: Componente de seleção de versão em tela cheia (1.0 vs 2.0 Beta)
- **AlertaPopup**: Componente de notificação de alertas de mercado em tempo real
- **RadarNews**: Componente de mapa interativo com monitoramento geopolítico
- **Framer_Motion**: Biblioteca `framer-motion` utilizada para animações declarativas em React
- **Shimmer**: Efeito visual de brilho translúcido que percorre um elemento horizontalmente
- **Glassmorphism**: Estilo visual com fundo semi-transparente, blur e borda sutil
- **Neon_Glow**: Efeito de brilho colorido em bordas ou sombras simulando luz neon

## Requisitos

### Requisito 1: Background Animado 3D na LandingPage

**User Story:** Como usuário, eu quero ver um background com orbs animados e fluidos na LandingPage, para que a experiência visual seja imersiva e premium.

#### Critérios de Aceite

1. WHEN a LandingPage é renderizada, THE LandingPage SHALL exibir orbs de background usando `motion.div` do Framer_Motion com animações contínuas de `translate3d` e `scale`
2. THE LandingPage SHALL renderizar os orbs com dimensões de pelo menos 50% de largura e 70% de altura do container pai
3. THE LandingPage SHALL aplicar animações com duração entre 20s e 25s, repetição infinita e easing `easeInOut` nos orbs de background
4. THE LandingPage SHALL utilizar gradientes radiais com opacidade entre 0.05 e 0.06 e blur de 120px nos orbs

### Requisito 2: Header com Pill de Navegação na LandingPage

**User Story:** Como usuário, eu quero ver um header estilizado com container pill, backdrop-blur e links com underline animado, para que a navegação seja visualmente sofisticada.

#### Critérios de Aceite

1. THE LandingPage SHALL renderizar o header dentro de um container pill com `bg-[#0c0c0e]/80`, `backdrop-blur-xl`, `border border-white/5`, `rounded-2xl` e `shadow-[0_10px_30px_rgba(0,0,0,0.5)]`
2. WHEN o usuário passa o mouse sobre um link de navegação, THE LandingPage SHALL exibir um span underline com gradiente que expande de 0% para 100% de largura
3. THE LandingPage SHALL exibir o botão "Acessar" com efeito Shimmer interno e ícone `ArrowRight` que translada horizontalmente no hover
4. THE LandingPage SHALL renderizar o logo com dimensões `w-10 h-10 rounded-xl`, borda `border-white/5`, overlay gradiente no hover (`bg-gradient-to-tr`) e sombra roxa brilhante no hover

### Requisito 3: Hero Section com Animações Framer Motion

**User Story:** Como usuário, eu quero que a seção hero tenha animações de entrada suaves via Framer Motion e texto com gradiente, para que o impacto visual inicial seja marcante.

#### Critérios de Aceite

1. WHEN a seção hero é renderizada, THE LandingPage SHALL animar o conteúdo com `motion.div` usando propriedades `initial` (opacity: 0, y: 20) e `animate` (opacity: 1, y: 0)
2. THE LandingPage SHALL renderizar a palavra "Fronteira" com `bg-clip-text text-transparent bg-gradient-to-r` em vez de `drop-shadow`
3. THE LandingPage SHALL renderizar o botão principal "Acessar" com estilo Glassmorphism (`bg-white/[0.02]`, borda sutil, glow no hover e Shimmer interno)

### Requisito 4: Cards de Filosofia com Stagger Animation e Neon Glow

**User Story:** Como usuário, eu quero que os cards de filosofia tenham animação de entrada sequencial e efeito neon nas bordas ao hover, para uma experiência visual premium.

#### Critérios de Aceite

1. WHEN os cards de filosofia entram na viewport, THE LandingPage SHALL animá-los com `motion.div` usando stagger delay sequencial entre cada card
2. WHEN o usuário passa o mouse sobre um card, THE LandingPage SHALL exibir borda com Neon_Glow usando `group-hover:from-genesis-accent` com `blur-[6px]`
3. WHEN o usuário passa o mouse sobre um card, THE LandingPage SHALL exibir efeito Shimmer interno no card
4. THE LandingPage SHALL aplicar padding generoso (mínimo `p-10`) nos cards de filosofia

### Requisito 5: Componente VersionSelector

**User Story:** Como usuário, eu quero uma tela de seleção de versão em tela cheia com cards grandes animados e efeitos neon, para que a escolha entre versões seja visualmente impactante. O seletor é a primeira tela exibida, antes de qualquer autenticação.

#### Critérios de Aceite

1. THE VersionSelector SHALL renderizar em tela cheia com background animado 3D (orbs com `motion.div`, `translate3d`, `scale`)
2. THE VersionSelector SHALL exibir cards de seleção com altura mínima de `h-[420px]` e borda dupla neon (camada blur + camada sólida)
3. WHEN o usuário passa o mouse sobre um card de versão, THE VersionSelector SHALL exibir glow de `shadow-[0_0_60px]` e uma linha `h-px` que expande de 0 para 100% de largura
4. THE VersionSelector SHALL exibir botão com efeito Shimmer e placeholder de logo com Shimmer horizontal
5. THE VersionSelector SHALL aceitar uma prop `onSelectVersion` que recebe o número da versão selecionada (1 ou 2)
6. WHEN o usuário seleciona a Versão 2, THE VersionSelector SHALL navegar para a página de login da aplicação atual (`/login`) usando `react-router-dom`
7. WHEN o usuário seleciona a Versão 1, THE VersionSelector SHALL redirecionar o navegador via `window.location.href` para a URL definida na variável de ambiente `VITE_V1_URL`
8. THE VersionSelector SHALL ser exibido como a rota raiz (`/`) da aplicação, antes de qualquer fluxo de autenticação
9. THE sistema SHALL ler a URL da Versão 1 exclusivamente de `import.meta.env.VITE_V1_URL`, nunca hardcodada no código

### Requisito 6: AlertaPopup com Countdown e Glow Direcional

**User Story:** Como usuário, eu quero que os popups de alerta tenham barra de progresso animada e glow colorido por direção, para feedback visual imediato sobre a natureza do alerta.

#### Critérios de Aceite

1. THE AlertaPopup SHALL exibir uma barra de progresso animada na base com `@keyframes progress` de duração 12 segundos (de largura 100% para 0%)
2. WHEN a direção do alerta é bullish, THE AlertaPopup SHALL aplicar glow verde (`shadow-[0_0_15px_rgba(16,185,129,0.2)]`)
3. WHEN a direção do alerta é bearish, THE AlertaPopup SHALL aplicar glow vermelho (`shadow-[0_0_15px_rgba(239,68,68,0.2)]`)
4. THE AlertaPopup SHALL animar a entrada com `animate-in slide-in-from-right fade-in duration-500`
5. THE AlertaPopup SHALL ter largura fixa de `w-[350px]`
6. THE AlertaPopup SHALL exibir divisor visual `border-t border-white/5` entre seções de conteúdo

### Requisito 7: Componente RadarNews com Mapa e Ticker

**User Story:** Como usuário, eu quero o componente RadarNews com mapa interativo Leaflet, ticker animado e pill de status, para visualização geopolítica imersiva.

#### Critérios de Aceite

1. THE RadarNews SHALL renderizar um mapa interativo usando `react-leaflet` com `MapContainer`, `TileLayer` e `Marker`
2. THE RadarNews SHALL exibir um ticker "Monitoramento Ativo" na base do mapa com animação marquee contínua
3. THE RadarNews SHALL exibir um pill de status com dot pulsante (`animate-pulse`) indicando se o monitoramento está ativo
4. THE RadarNews SHALL aplicar glow no pill de status quando ativo

### Requisito 8: Responsividade de Labels na Sidebar

**User Story:** Como usuário em dispositivo desktop, eu quero que labels e títulos de seção da sidebar fiquem ocultos em telas menores e visíveis apenas em `lg`, para melhor uso do espaço.

#### Critérios de Aceite

1. THE Sidebar SHALL aplicar classes `hidden lg:flex` ou `hidden lg:block` nos labels de texto dos itens de menu
2. THE Sidebar SHALL aplicar classes `hidden lg:block` nos títulos de seção (Principal, Análise, Mercado, Contexto)
3. WHILE a viewport tem largura inferior ao breakpoint `lg`, THE Sidebar SHALL exibir apenas os ícones dos itens de menu sem texto

### Requisito 9: Animações Stagger com Framer Motion nos Cards do App

**User Story:** Como usuário, eu quero que cards e seções do app inteiro usem animação stagger com Framer Motion na entrada, para uma experiência fluida e profissional.

#### Critérios de Aceite

1. WHEN cards de seção são renderizados, THE Sistema SHALL animá-los usando `motion.div` com propriedades `initial` (opacity: 0, y: 10) e `animate` (opacity: 1, y: 0)
2. THE Sistema SHALL aplicar delays incrementais (stagger) entre os cards usando `transition.delay` calculado por índice
3. THE Sistema SHALL utilizar `ease: "easeOut"` e duração entre 0.3s e 0.6s para as animações de entrada

### Requisito 10: Efeito Shimmer Reutilizável

**User Story:** Como desenvolvedor, eu quero um utilitário de efeito Shimmer reutilizável, para aplicá-lo consistentemente em botões, cards e placeholders em toda a aplicação.

#### Critérios de Aceite

1. THE Sistema SHALL disponibilizar uma classe CSS ou componente reutilizável para o efeito Shimmer
2. THE Shimmer SHALL consistir em um gradiente translúcido (`from-transparent via-white/5 to-transparent`) que translada horizontalmente de -100% para +100%
3. THE Shimmer SHALL ter duração de animação entre 1s e 2s com repetição infinita ou ativação por hover conforme o contexto
