# VaultPay live deployment package

The application is prepared for production deployment on Railway or Render. The project is split into web, API, worker, and managed PostgreSQL services.

## Current runtime topology

Browser -> public HTTPS web service -> private API service -> PostgreSQL
                                      -> provider APIs
                                      -> worker

The browser calls `/api/v1` on the same public origin, while the Nginx layer proxies API requests to the private API service.

## Important live-money boundary

This package does not contain banking, KYC, or Flutterwave live credentials and does not claim that the product is approved for regulated operation. A licensed Nigerian bank/payment partner and approved provider accounts are still required before customer funds can be accepted.

## Deployment artifacts

- `infra/railway/Dockerfile.api`
- `infra/railway/Dockerfile.worker`
- `infra/railway/Dockerfile.web`
- `infra/railway/nginx.conf.template`
- `infra/railway/DEPLOY.md`
- `infra/render.yaml`
- `scripts/migrate.sh`
- `deploy.env.example`

## Production sequence

1. Connect the Git repository to Railway or Render.
2. Provision managed PostgreSQL.
3. Deploy API and worker.
4. Run migrations.
5. Deploy web service.
6. Obtain HTTPS domain.
7. Set `WEB_ORIGIN` to the exact HTTPS origin.
8. Set Flutterwave live credentials in the hosting secret store.
9. Configure the Flutterwave webhook to `/api/v1/webhooks/flutterwave`.
10. Run end-to-end staging and live verification tests.
11. Complete regulated-partner and compliance approvals.
12. Launch with monitoring, reconciliation, incident response, and rollback procedures active.
