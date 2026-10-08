# Requisitos: recuperação de senha na v1 e na v2 pelo `[AUTH]`

**Status**: Fase 0 feita (07/10/2026): D1–D6 respondidas, todas pela recomendação. Pedido do Felipe: "ter a recuperação de senha
na v1 e v2 e utilize o auth para isso".

## Situação atual (levantada no código em 07/10/2026)

| Onde | O que existe |
|---|---|
| `[AUTH]` | `POST /api/auth/forgot-password` e `POST /api/auth/reset-password`, com o limite `throttle:login` (5/min por e-mail+IP, 20/min por IP). Resposta igual para e-mail cadastrado ou não (S11). O link expira em 60 min; um novo pedido só depois de 60 s. O e-mail (`ResetPasswordNotification`) leva para `FRONTEND_URL/?reset_password_token=...&email=...`. Senha nova: mínimo 8 caracteres e checagem de vazamento em produção (S10). |
| `[FE v1]` | `LandingPage.tsx` tem "Esqueci a senha" e a tela de nova senha (lê `reset_password_token` e `email` da URL) e chama o `[AUTH]` por `authPath()`. |
| `[FE v2]` | **Não tem nada.** A tela de login (`components/LandingPage.tsx`) só tem e-mail e senha. |

### Problemas encontrados

1. **v2 sem recuperação**: membro da v2 que esquece a senha não tem como trocar sozinho.
2. **Um link só para as duas versões**: o e-mail sempre aponta para `FRONTEND_URL`. Como só a v1 tem
   a tela, quem pede pela v2 cai num site que ignora o link.
3. **`FRONTEND_URL` de produção não confirmado**: o `.env` do `[AUTH]` de produção foi montado a
   partir do `apiv1.env`, que não tem essa variável. Sem ela, o código usa
   `http://localhost:3000` e o link do e-mail fica quebrado para todo mundo.
4. **E-mail meio em inglês**: `app.locale = en` e o projeto não tem arquivos de tradução. A
   saudação, a assinatura ("Regards, Genesis Auth") e o rodapé ("If you're having trouble
   clicking...") saem em inglês, e as mensagens de validação também ("The password field
   confirmation does not match.").
5. **v1, conferência quebrada**: a tela de nova senha compara `newPassword` com
   `newPasswordConfirmation`, que nenhum campo preenche. A conferência nunca dispara, e o front
   também não avisa do mínimo de 8 caracteres.
6. **Sessões antigas continuam valendo**: trocar a senha não derruba os tokens já emitidos. Quem
   roubou um token continua logado depois da troca.
7. **Token visível na URL**: a v1 deixa `reset_password_token` na barra de endereço durante toda
   a troca. Ele fica no histórico do navegador, e qualquer pessoa olhando a tela vê o link.

## Requisitos

### R1. Pedido de recuperação (v1 e v2)
1. As duas telas de login têm "Esqueci minha senha": pede o e-mail e chama
   `POST /api/auth/forgot-password` do `[AUTH]`, informando a versão (`client: v1|v2`).
2. A resposta é sempre a mesma mensagem, exista ou não a conta (não revela quem é cadastrado).
3. Botão desabilitado durante o envio. Limite atingido (429) mostra "aguarde um minuto".

### R2. E-mail
1. O link leva para a versão de onde o pedido veio: v1 para v1, v2 para v2.
2. Sem `client` (chamada antiga), vale `FRONTEND_URL`, como hoje.
3. E-mail inteiro em português, com o nome Gênesis Labs, validade do link escrita ("expira em 60
   minutos") e o aviso "se não foi você, ignore".
4. O token nunca vai para log.

### R3. Tela de nova senha (v1 e v2)
1. Abre pelo link do e-mail, já com o e-mail preenchido (só leitura).
2. Nova senha e confirmação; o front confere se são iguais e se têm 8+ caracteres antes de enviar.
3. Chama `POST /api/auth/reset-password`. Sucesso: mensagem e volta para o login. Link vencido ou
   já usado: mensagem clara e opção de pedir outro.
4. O token sai da barra de endereço assim que a tela abre (fica só na memória da página).
5. Mensagens de erro do `[AUTH]` em português (inclusive senha vazada e confirmação diferente).

### R4. Segurança no `[AUTH]`
1. Link de uso único (já é, pelo Laravel) e validade de 60 minutos (mantida).
2. Ao trocar a senha, todos os tokens de sessão do membro são revogados (D3).
3. Limites atuais mantidos (`throttle:login` + 60 s entre pedidos).
4. `client` aceita só `v1`/`v2`; valor inválido é ignorado (cai no `FRONTEND_URL`), sem erro que
   revele algo.

### R5. Configuração de produção
1. `[AUTH]` com `FRONTEND_URL_V1`, `FRONTEND_URL_V2` e `FRONTEND_URL` corretos e o SMTP conferido
   (envio real para uma caixa de teste antes do corte).

## Decisões (respondidas pelo Felipe em 07/10/2026, todas pela recomendação)

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Link por versão (`client` no pedido + `FRONTEND_URL_V1`/`_V2`) ou um site só para todos? | **Por versão.** O membro volta para o site que ele usa. |
| D2 | Na v2, a tela de nova senha numa rota própria (`/redefinir-senha?token=...&email=...`) ou dentro da tela de login, por parâmetro (como na v1)? | **Rota própria** na v2 (ela já usa rotas). A v1 continua no formato atual (`/?reset_password_token=`), para não quebrar links já enviados. |
| D3 | Derrubar todas as sessões do membro ao trocar a senha? | **Sim.** Quem trocou a senha por suspeita de invasão espera isso. |
| D4 | Depois de trocar, já entrar logado ou voltar para o login? | **Voltar para o login.** Mais simples e não cria token a partir de um link de e-mail. |
| D5 | Conta inativa (`status` diferente de `active`) pode trocar a senha? | Sim. Trocar a senha não ativa a conta, e o login continua barrando como hoje. |
| D6 | Remetente e nome no e-mail | `contato@genesislabs.com.br`, "Gênesis Labs" (o mesmo SMTP da Hostinger do `apiv1.env`). |
