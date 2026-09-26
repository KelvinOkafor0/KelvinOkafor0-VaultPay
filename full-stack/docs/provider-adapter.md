# Provider adapter contract

VaultPay deliberately isolates bank, KYC, and card integrations behind interfaces in `apps/api/src/services/providers.ts`.

## Bank

Implement:

```ts
nameEnquiry(bankCode, accountNumber)
submitTransfer({ bankCode, accountNumber, amount, reference, description })
```

The production implementation should also add a provider status-query method, signed webhooks, retry policy, timeout policy, provider error mapping, and settlement/reconciliation support.

## KYC

Implement:

```ts
start({ firstName, lastName, dateOfBirth, phone })
```

The production adapter should support the complete approved onboarding and verification flow, not merely return a pass/fail flag.

## Cards

Implement:

```ts
issue({ userId, accountId, type })
setStatus(issuerReference, status)
```

The production adapter should cover lifecycle events, funding/account linkage, card controls, transaction webhooks, replacement, and scheme/issuer-specific security controls.

## Important

Provider API credentials, signing keys, encryption keys, and certificates belong in a secrets manager/HSM-backed environment. They must not be committed to the repository or returned to clients.
