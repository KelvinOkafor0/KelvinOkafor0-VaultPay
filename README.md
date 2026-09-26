# VaultPay

VaultPay is a Nigerian fintech MVP prepared for a licensed-bank/PSP-led production launch.

## Packages

- `demo/` — browser demo
- `full-stack/` — web app, API, ledger, database migrations, provider adapters, worker, and operational docs
- `render.yaml` — Render Blueprint for API, worker, web, and managed Postgres
- `full-stack/infra/railway/` — Railway Dockerfiles and deployment guide
- `.github/workflows/ci.yml` — build verification workflow

## Live deployment

Actual cloud deployment requires the owner's hosting/Git provider connection and provider credentials. The source is deployment-ready, but secrets must be entered into the host secret manager.

See `full-stack/DEPLOYMENT.md` and `full-stack/infra/railway/DEPLOY.md`.
