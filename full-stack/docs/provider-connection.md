# VaultPay live provider connection

The default concrete provider in this release is Flutterwave for Nigerian bank rails.

## Environment

```dotenv
BANK_PROVIDER=flutterwave
KYC_PROVIDER=flutterwave
CARD_PROVIDER=mock
FLW_BASE_URL=https://api.flutterwave.com
FLW_SECRET_KEY=<server-side-secret>
FLW_SECRET_HASH=<webhook-secret-hash>
FLW_KYC_REDIRECT_URL=https://app.example.com/kyc/callback
```

Keep `FLW_SECRET_KEY` and `FLW_SECRET_HASH` only on the server. Flutterwave's current authentication documentation says the secret key is for secure server-side environments and should not be exposed in frontend code.

## Implemented flows

- `GET /api/v1/banks` -> Flutterwave `GET /v3/banks/NG`
- `POST /api/v1/transfers/name-enquiry` -> Flutterwave `POST /v3/accounts/resolve`
- `POST /api/v1/transfers` + `POST /api/v1/transfers/:id/authorize` -> VaultPay ledger + worker -> Flutterwave `POST /v3/transfers`
- `POST /api/v1/accounts/:id/funding-instructions` -> Flutterwave `POST /v3/virtual-account-numbers`
- `POST /api/v1/kyc` -> Flutterwave `POST /v3/bvn/verifications` and hosted consent
- `POST /api/v1/webhooks/flutterwave` -> signed provider webhook + idempotent processing for BVN completion, outbound transfers, and inbound virtual-account `charge.completed` events

## Money movement

A transfer is authorized in the VaultPay ledger first. The worker then calls the provider outside the database transaction, records the provider reference, and marks the transfer `PROCESSING`. Final success/failure/reversal is applied from the verified provider status or webhook.

For inbound funding, a signed `charge.completed` webhook is verified again through Flutterwave's transaction-verification endpoint before VaultPay credits the customer's account. The credit creates a balanced double-entry journal and an `inbound_transfers` record.

## KYC

VaultPay does not persist the raw BVN in the application database. The user submits the BVN to the backend for consent initiation; the provider returns a consent URL and reference. Completion is received asynchronously from the provider.

## Cards

The MVP continues to use a mock card issuer. The card provider is intentionally separated because production card issuance requires a contracted issuer/card-program provider and applicable enablement. The current Flutterwave virtual-card reference documentation says that service is not publicly available and requires contacting Flutterwave support, so the app does not silently pretend that card issuing is live.
