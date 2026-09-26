# VaultPay API examples

## Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phone": "+2348012345678",
  "email": "user@example.com",
  "password": "A-long-password-123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

## Start KYC

```http
POST /api/v1/kyc
Authorization: Bearer <access-token>
Content-Type: application/json
```

## Name enquiry

```http
POST /api/v1/transfers/name-enquiry
Authorization: Bearer <access-token>
Content-Type: application/json

{"bankCode":"000013","accountNumber":"0123456789"}
```

## Create transfer

```http
POST /api/v1/transfers
Authorization: Bearer <access-token>
Idempotency-Key: 8b1d8d41-...
Content-Type: application/json

{
  "sourceAccountId":"<account-uuid>",
  "beneficiaryId":"<beneficiary-uuid>",
  "amount":"50000.00",
  "currency":"NGN",
  "description":"Rent"
}
```

## Authorize transfer

```http
POST /api/v1/transfers/<transfer-uuid>/authorize
Authorization: Bearer <access-token>
```
