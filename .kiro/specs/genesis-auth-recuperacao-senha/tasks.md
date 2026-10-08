# Plano de implementação: recuperação de senha na v1 e na v2 pelo `[AUTH]`

**Status**: Fases 0 a 3 feitas (07/10/2026); 0.2 e 0.3 dependem do Felipe no servidor/painel. Nada commitado. Requisitos em `requirements.md`,
desenho em `design.md`. Nenhuma migração nem seed (esta spec não precisa de nenhuma).

Repositórios: `[AUTH]` = `auth genesis` (`master`), `[FE v2]` = este repo (`staging`),
`[FE v1]` = `G-nesis-Labs-Oficial-1` (`main`).

**Relação com a spec `genesis-auth-cobranca-centralizada`**: tocam arquivos diferentes, exceto
`routes/api.php` e `.env.example` do `[AUTH]` (sem conflito de lógica). As duas podem ser
publicadas juntas no fim.

## Fase 0: decisões e conferência de produção
- [x] 0.1 Responder D1–D6 (`requirements.md`). Todas pela recomendação: link por versão, rota
      própria `/redefinir-senha` na v2, derruba todas as sessões e volta ao login, conta inativa
      pode trocar, remetente `contato@genesislabs.com.br` / "Gênesis Labs".
- [ ] 0.2 No servidor, ver o que o `[AUTH]` de produção usa hoje (sem mostrar senha):
      ```bash
      grep -E '^(APP_NAME|FRONTEND_URL|MAIL_MAILER|MAIL_HOST|MAIL_PORT|MAIL_FROM_ADDRESS|MAIL_FROM_NAME)=' \
        /home/genesislabs-auth/htdocs/auth.genesislabs.com.br/.env
      ```
      Se `FRONTEND_URL` estiver ausente, **o link de recuperação de hoje está quebrado** (vai para
      `localhost:3000`): corrigir já, apontando para a v1 (`https://v1.genesislabs.com.br`), sem
      esperar o resto da spec. _Problema 3_
      **Achado local (07/10)**: o `apiv1.env` (base do `.env` de produção do `[AUTH]`) **não tem
      `FRONTEND_URL`**, e o código usa `http://localhost:3000` por padrão
      (`config/app.php:60`). O SMTP do `apiv1.env` é Hostinger (`smtp.hostinger.com:587`,
      `contato@genesislabs.com.br`) e `MAIL_FROM_NAME="${APP_NAME}"` = "G-nesis". Falta só o
      Felipe rodar o grep no servidor para confirmar se alguém já acrescentou. **Pendente (Felipe).**
- [ ] 0.3 Conferir no painel da Hostinger que a caixa `contato@genesislabs.com.br` existe e envia.
      **Pendente (Felipe)**; também pode ser confirmado no teste real da 5.4.

## Fase 1: `[AUTH]`
- [x] 1.1 `FRONTEND_URL_V1` / `FRONTEND_URL_V2` em `config/app.php` e `.env.example`. _R2.1, R5_
- [x] 1.2 `forgot-password` aceita `client` (`v1`/`v2`, inválido descartado) e leva até a
      notificação. Resposta continua idêntica em todos os casos. _R1.1, R1.2, R4.4_
- [x] 1.3 `ResetPasswordNotification` com URL por versão (formato da v1 mantido; rota
      `/redefinir-senha` na v2; sem `client` igual a hoje). _R2.1, R2.2_
- [x] 1.4 E-mail em português: texto, saudação, assinatura "Gênesis Labs", validade do link e
      template publicado com o rodapé traduzido. _R2.3_
- [x] 1.5 `APP_LOCALE=pt_BR` + `lang/pt_BR/validation.php` e `passwords.php` só com as mensagens
      usadas aqui. _R3.5_
- [x] 1.6 `reset-password` revoga todos os tokens do membro e dispara `PasswordReset`. _R4.2, D3_
- [x] 1.7 Testes (ver `design.md`) + suíte completa do `[AUTH]`.
      **Feito 07/10**: `tests/Feature/RecuperacaoSenhaTest.php` (13 testes); suíte completa 158/158.
      Diferenças em relação ao `design.md`:
      - o `client` vai pelo callback do `Password::sendResetLink($credenciais, fn($user, $token))`,
        sem estado global; `User::sendPasswordResetNotification` ficou como estava (sem client);
      - o rodapé e a saudação do e-mail foram traduzidos por `lang/pt_BR.json`, sem publicar o
        template; `passwords.php` não foi criado (os controllers devolvem mensagens próprias);
      - `config('app.locale')` virou `env('APP_LOCALE', 'pt_BR')`; o que não está em
        `lang/pt_BR/validation.php` cai no inglês do framework;
      - v2 só usa `/redefinir-senha` se `FRONTEND_URL_V2` estiver preenchido; senão cai no
        `FRONTEND_URL` no formato antigo (que a v1 entende).
      Nada commitado.

## Fase 2: `[FE v2]`
- [x] 2.1 `services/api.ts`: `pedirRecuperacaoSenha()` e `redefinirSenha()` pelo `[AUTH]`, com
      `client: 'v2'`. _R1.1_
- [x] 2.2 `LandingPage.tsx`: "Esqueci minha senha" → modo recuperar acesso (e-mail + enviar +
      mensagem fixa). _R1_
- [x] 2.3 `pages/ResetPasswordPage.tsx` + rota pública `/redefinir-senha`: lê e limpa o token da
      URL, valida no front, trata 400/422/429, volta para `/login`. _R3_
- [x] 2.4 Testes vitest + `npm run lint` + `npm run build`.
      **Feito 07/10**: `__tests__/recuperacaoSenha.test.ts` (12 testes); vitest 549 verdes, tsc limpo,
      build ok. O serviço ficou em `services/recuperacaoSenha.ts` (não em `api.ts`), usando o
      `baseDoAuth` do `billing.ts`: sem `VITE_AUTH_API_URL` mostra "indisponível" (a genesis-api
      não tem essas rotas). O e-mail na tela de nova senha aparece só leitura.

## Fase 3: `[FE v1]`
- [x] 3.1 `forgot-password` com `client: 'v1'`. _R1.1_
- [x] 3.2 Conferência de senha nos campos certos (`password`/`password_confirmation`) + mínimo 8.
      _Problema 5_
- [x] 3.3 Token sai da URL assim que a tela abre; mensagens 400/422 em português; link vencido
      oferece pedir outro; tirar os `console.log` dos handlers. _R3.3, R3.4_
- [x] 3.4 Testes `node --test` + `npm run build`.
      **Feito 07/10**: regras puras em `services/senha.ts` + `tests/senha.test.mjs` (6 testes);
      `test:baseline` 20/20, tsc com os mesmos 3 erros antigos, build ok. Link vencido pergunta
      (`confirm`) se quer receber outro no mesmo e-mail. Removidos os `console.log` dos dois
      handlers e do `onSubmit`; os de login/cadastro ficaram (fora do escopo). A mudança que já
      estava no cadastro (mínimo 8) não foi tocada.

## Fase 4: ensaio local
- [ ] 4.1 `[AUTH]` local com `MAIL_MAILER=log`, `FRONTEND_URL_V1=http://localhost:3003`,
      `FRONTEND_URL_V2=http://localhost:3002`.
- [ ] 4.2 Pedir pela v2 → abrir o link do log → trocar → entrar com a senha nova; confirmar que
      um token antigo deixou de funcionar.
- [ ] 4.3 O mesmo pela v1.
- [ ] 4.4 Link vencido e link usado duas vezes: mensagem certa nas duas versões.

## Fase 5: produção (só com autorização)
- [ ] 5.1 `.env` do `[AUTH]`: `FRONTEND_URL=https://v1.genesislabs.com.br`,
      `FRONTEND_URL_V1=https://v1.genesislabs.com.br`, `FRONTEND_URL_V2=https://v2.genesislabs.com.br`,
      `APP_LOCALE=pt_BR`, `MAIL_FROM_NAME="Gênesis Labs"`.
- [ ] 5.2 Deploy `[AUTH]` + `php artisan config:cache`.
- [ ] 5.3 Deploy `[FE v2]` e `[FE v1]` (build).
- [ ] 5.4 Teste real com uma conta de teste nas duas versões (e-mail chega, link abre na versão
      certa, troca funciona).

## Rollback
- Front: voltar o commit e refazer o build. O `[AUTH]` continua aceitando pedido sem `client`.
- `[AUTH]`: voltar o commit; os links já enviados pela v1 continuam no formato antigo e funcionam.
  Links já enviados para `/redefinir-senha` da v2 deixam de funcionar (o membro pede outro).
