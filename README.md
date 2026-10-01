<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8befcbae-69fe-4dea-8147-711cc88d8750

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Bloqueio de segredos no commit

Spec `genesis-seguranca-correcoes` (S7): chave de API, token ou dump de banco não podem ir para o Git. Para o `git commit` barrar isso nesta máquina, instale o [gitleaks](https://github.com/gitleaks/gitleaks) e crie o hook uma vez:

```sh
printf '#!/bin/sh\ngitleaks protect --staged --redact -v\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Arquivos `.sql`, `.sql.gz` e `.dump` também não devem ser commitados; se aparecerem no `git status`, adicione ao `.gitignore`.


## Gate de qualidade (V6.12)

O workflow `.github/workflows/genesis-quality-gate.yml` roda em todo PR e em todo push nas branches de produção. Política:

- **Crítico não mitigado:** bloqueia o merge.
- **Alto explorável em produção:** bloqueia o merge.
- **Moderado:** exige triagem registrada no PR (o que é, se é explorável aqui e o que foi feito).

Aviso que já foi avaliado e não é explorável fica registrado com o motivo — na API, em `composer.json` (`config.audit.ignore`) e em `.trivyignore`; no front, o `npm audit` barra a partir de `high`. Aviso novo volta a bloquear até ser triado.
