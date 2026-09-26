# VaultPay MVP

VaultPay is a partner-led financial platform MVP for Nigeria. It includes a responsive customer web app, an Expo mobile starter, Fastify/TypeScript API, PostgreSQL schema, double-entry ledger, idempotency, outbox worker, mock KYC/bank/card adapters, audit logs, admin/compliance scaffolding, and an OpenAPI contract.

## What is real vs simulated

The repository is runnable in local/demo mode. The KYC, bank transfer and card adapters are intentionally mock adapters. They do not connect to a bank, NIP, card scheme, or real-money settlement service.

Before any real-money launch, replace the mock adapters with the APIs of the licensed Nigerian sponsor bank/PSP and complete the legal, regulatory, security, PCI, AML/KYC, privacy, operational-resilience, and partner-certification work required for the exact product.

## Run locally

Requirements: Docker Desktop (or Docker Engine + Compose), Node 22+ if running outside Docker.

```bash
docker compose up
```

Web app: http://localhost:5173
API: http://localhost:4000/api/v1/health

The database migration in `db/migrations/001_init.sql` runs when the PostgreSQL volume is first created.

To create a local admin:

```bash
npm install
npm --workspace apps/api run create-admin -- admin@vaultpay.local +2348000000000 'ChangeMe-Admin-12345!'
```

The local demo KYC adapter marks a user verified so the demo account can be opened. This is intentionally disabled from auto-account creation in `NODE_ENV=production`.

## Live Flutterwave connection

This repository now includes a concrete Flutterwave adapter for Nigerian bank account resolution, NGN transfers, NGN virtual/funding accounts, BVN consent KYC, signed webhooks, and asynchronous transfer polling. Flutterwave documents these APIs for Nigerian merchants, including transfer prerequisites, account resolution, virtual accounts and BVN consent flows.

1. Create/approve the merchant account in Flutterwave and enable the required transfer, virtual-account, and BVN features.
2. Copy your **server-side** secret key and webhook secret hash into `.env`. Keep the secret key off the frontend and out of source control.
3. Set `BANK_PROVIDER=flutterwave` and `KYC_PROVIDER=flutterwave`.
4. Set the provider webhook URL to `https://YOUR_API_HOST/api/v1/webhooks/flutterwave`.
5. Set the BVN redirect URL to your HTTPS customer callback route.
6. Run the database migrations and start the API + worker.

The application does not and should not auto-generate live secrets. Without an approved provider account and its credentials, the integration remains unconfigured and will return provider configuration errors instead of pretending to move money.

## Real-money adapter boundary

Implement these interfaces in `apps/api/src/services/providers.ts` for the selected regulated partner:

- `BankProvider.nameEnquiry()`
- `BankProvider.submitTransfer()`
- `KycProvider.start()`
- `CardProvider.issue()`
- `CardProvider.setStatus()`

Keep provider credentials in a secrets manager; never commit them.

## Ledger rules

`journal_entries` + `journal_lines` form an immutable financial journal. Every journal entry must balance: total debits equal total credits. Account balance fields are cached views for low-latency reads; the journal is authoritative.

Transfers use an explicit state machine and an idempotency key. Authorized transfers are placed on the outbox, then the worker talks to the provider. External calls are not held open inside database transactions.

## Production hardening before launch

- Use the regulated sponsor's account and settlement records as an external source of truth and reconcile them continuously.
- Add provider-specific signed webhooks, event deduplication, replay protection, and state-transition validation.
- Add step-up authentication and transaction signing for money movement and privileged actions.
- Use an approved KYC/identity provider and the sponsor's customer due-diligence rules.
- Implement AML/CFT/CPF transaction monitoring, sanctions/PEP screening, case management, and reporting workflows.
- Keep raw card credentials in a PCI-compliant card environment; use issuer tokens in VaultPay.
- Add secrets management, KMS/HSM-backed keys, database encryption, backups, point-in-time recovery, disaster recovery, WAF, DDoS protection, vulnerability management, penetration testing, security monitoring, and incident response.
- Implement Nigeria Data Protection Act governance, privacy notices, retention/deletion controls, data-subject workflows, vendor/processor controls, and breach response.
- Add rate limits and abuse controls per authentication, transfer, beneficiary and card endpoint.
- Add automated reconciliation between VaultPay, sponsor-bank, processor and settlement reports.

## Directory

```text
apps/api        API, auth, ledger, payments, cards, KYC, admin, worker
apps/web        Responsive customer/admin web app
apps/mobile     Expo React Native starter
db              PostgreSQL migration and seed files
docs            OpenAPI contract and launch documentation
```
