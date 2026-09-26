# VaultPay production deployment

This repo contains a deployment-ready monorepo for Railway and Render. Neither platform connection is currently available in this ChatGPT session, so the actual cloud resources cannot be created from here yet.

## Recommended topology

```text
Public HTTPS domain
        |
        v
vaultpay-web (Nginx)
        |
        +---- /api/* ----> vaultpay-api (private network)
                              |
                              +---- PostgreSQL
                              +---- Flutterwave
                              +---- KYC/payment services
        |
        +-------------------- vaultpay-worker
```

The browser uses same-origin `/api/v1`, so no provider secret is shipped to the browser.

## Railway

Create these services:

- PostgreSQL
- `vaultpay-api` from `full-stack/infra/railway/Dockerfile.api`
- `vaultpay-worker` from `full-stack/infra/railway/Dockerfile.worker`
- `vaultpay-web` from `full-stack/infra/railway/Dockerfile.web`

Use the Railway Variables UI/Raw Editor for secrets. Railway supports Dockerfile deployments, private networking, managed Postgres, variables, and public HTTPS domains. Configure `API_INTERNAL_URL` to the API's private hostname and port. citeturn374926search1turn374926search3turn374926search4

Run once after the database exists:

```bash
DATABASE_URL="$DATABASE_URL" ./scripts/migrate.sh
```

The service's public domain will carry the webhook endpoint:

```text
https://YOUR_DOMAIN/api/v1/webhooks/flutterwave
```

## Render

The repository-root `render.yaml` defines API, worker, web, and Postgres. Render supports Docker services, private networking, custom domains/HTTPS, managed Postgres, `preDeployCommand`, generated secret values, and `sync: false` secret prompts. citeturn504128search0turn504128search2

Create the Blueprint from `render.yaml`, enter the three Flutterwave/URL secrets when prompted, then set `WEB_ORIGIN` to the exact final HTTPS origin.

The API migration runs from the image before deployment through `/app/scripts/migrate.sh`.

## Flutterwave

Set the production credentials only in the host secret manager:

```env
FLW_SECRET_KEY=<live secret key>
FLW_SECRET_HASH=<webhook secret hash>
```

Configure Flutterwave's webhook as:

```text
https://YOUR_DOMAIN/api/v1/webhooks/flutterwave
```

The current integration checks the webhook signature, persists/deduplicates webhook events, verifies critical transactions through Flutterwave before crediting value, and includes a worker for pending transaction polling. Flutterwave documents secret-hash signature verification, fast 200 responses, idempotency, retries, and transaction re-verification before giving value. citeturn712303search0turn712303search1turn712303search3

## Launch gates

1. Licensed Nigerian bank/PSP relationship executed for the exact product.
2. Provider live account approved and transfer functionality enabled.
3. KYC/AML/financial-crime controls approved by compliance.
4. Production database backups and restore test completed.
5. Secrets stored only in the platform secret manager.
6. HTTPS/custom domain verified.
7. Webhook verified with a real provider event and duplicate delivery test.
8. Bank-account name enquiry tested.
9. Transfer success, failure, timeout and reversal tested.
10. Inbound funding and duplicate webhook tested.
11. Ledger reconciliation completed against provider/bank records.
12. Card issuer integration completed before enabling real cards.
13. Security review / penetration test completed.
14. Incident response and customer-support runbooks active.
15. Controlled pilot completed before general release.

## Do not enable live money movement until the partner and compliance gates are signed off.
