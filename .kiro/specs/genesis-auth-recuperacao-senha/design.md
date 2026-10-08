# Design: recuperação de senha pelo `[AUTH]`

## Fluxo

```
[FE v1|v2] "Esqueci minha senha"
   └─ POST [AUTH]/api/auth/forgot-password { email, client: "v1"|"v2" }
        └─ resposta sempre igual (200)
        └─ se a conta existe: e-mail com link →
             v1: FRONTEND_URL_V1/?reset_password_token=TOKEN&email=EMAIL   (formato atual)
             v2: FRONTEND_URL_V2/redefinir-senha?token=TOKEN&email=EMAIL     (rota nova)

Membro abre o link → tela de nova senha (tira o token da URL)
   └─ POST [AUTH]/api/auth/reset-password { token, email, password, password_confirmation }
        └─ 200: senha trocada, sessões antigas revogadas → volta para o login
        └─ 400: link vencido/usado → oferece pedir outro
        └─ 422: senha fraca, vazada ou confirmação diferente (mensagem em português)
```

## `[AUTH]`

- **`config/app.php`**: `frontend_urls => ['v1' => env('FRONTEND_URL_V1'), 'v2' => env('FRONTEND_URL_V2')]`,
  mantendo `frontend_url` (`FRONTEND_URL`) como padrão.
- **`ForgotPasswordController`**: aceita `client` opcional (`in:v1,v2`; inválido é descartado, não
  dá 422, para a resposta continuar igual em todos os casos). Passa o `client` para o envio. A
  notificação é disparada pelo `User::sendPasswordResetNotification($token)`, que hoje só recebe o
  token; o `client` vai por um contexto de requisição (ex.: `app()->instance('password_reset_client', $client)`)
  ou por um broker próprio. A forma exata é decidida na Fase 1, com teste.
- **`ResetPasswordNotification`**: monta a URL por versão:
  - `v1` → `{FRONTEND_URL_V1}/?reset_password_token=...&email=...`
  - `v2` → `{FRONTEND_URL_V2}/redefinir-senha?token=...&email=...`
  - nenhum → `{FRONTEND_URL}/?reset_password_token=...&email=...` (igual a hoje)

  Texto todo em português, com `->greeting()`, `->salutation()` e template publicado
  (`resources/views/vendor/notifications/email.blade.php`) traduzindo o rodapé. Assunto:
  "Gênesis Labs — redefinição de senha".
- **`ResetPasswordController`**: no callback do `Password::reset`, `$user->tokens()->delete()`
  (D3) e `event(new PasswordReset($user))`. Mensagens de status traduzidas.
- **Idioma**: `APP_LOCALE=pt_BR` + `lang/pt_BR/{validation,passwords}.php` só com as mensagens que
  essas telas mostram (confirmed, min, uncompromised, required, email; token inválido, aguarde
  para pedir de novo). Assim não muda o idioma de nada além do necessário.

## `[FE v2]`

- **`services/api.ts`**: `pedirRecuperacaoSenha(email)` e `redefinirSenha({token,email,password,password_confirmation})`,
  sempre pelo `[AUTH]` (`authPath`), com `client: 'v2'`.
- **`components/LandingPage.tsx`**: link "Esqueci minha senha" abaixo da senha → modo
  "recuperar acesso" (só e-mail + botão) → mensagem fixa de enviado.
- **`pages/ResetPasswordPage.tsx`**, rota pública `/redefinir-senha` em `router/index.tsx`:
  - lê `token` e `email` da URL e faz `history.replaceState` para limpar a barra de endereço;
  - sem `token`/`email`: mostra "link inválido" e o botão para pedir outro;
  - formulário com nova senha + confirmação, validação no front (iguais, 8+);
  - sucesso: mensagem e `navigate('/login')`.
- **Vazamento pelo `Referer`**: os navegadores atuais usam por padrão
  `strict-origin-when-cross-origin`, que não manda o caminho nem a query para outro domínio. Além
  disso, a página limpa a URL antes de qualquer chamada. Não precisa de mudança no `index.html`.

## `[FE v1]`

- **`LandingPage.tsx`**:
  - `forgot-password` passa a enviar `client: 'v1'`;
  - a conferência de senha passa a comparar `password` com `password_confirmation` (os campos
    que o formulário de fato preenche) + mínimo de 8;
  - ao detectar `reset_password_token` na URL, guarda em estado e limpa a URL na hora (hoje só
    limpa depois do sucesso);
  - erros 400/422 com mensagem em português; link vencido oferece "pedir outro".
- Remover os `console.log` de depuração desses dois handlers.

## Testes

- `[AUTH]` (PHPUnit, sqlite + `DatabaseTransactions`):
  - link certo para `v1`, `v2` e sem `client`; `client` inválido cai no padrão;
  - resposta idêntica para conta existente e inexistente, com e sem `client`;
  - e-mail em português, sem token no log;
  - troca de senha revoga os tokens antigos e o token de reset não serve duas vezes;
  - link vencido (61 min) → 400; senha de 7 caracteres e confirmação diferente → 422 em português.
- `[FE v2]` (vitest): serviço chama o `[AUTH]` com `client: 'v2'`; rota `/redefinir-senha` é
  pública; a página limpa o token da URL.
- `[FE v1]` (`node --test`): payload com `client: 'v1'`; conferência usa os campos certos.
- Ponta a ponta local: `MAIL_MAILER=log` no `[AUTH]` local, pedir pelas duas versões, abrir o
  link que aparece no log e trocar a senha.
