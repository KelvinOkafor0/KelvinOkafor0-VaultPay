# VaultPay CBN-PSB operating structure

## Status

This document defines the target regulatory architecture for VaultPay. It does **not** create a CBN licence or authorize VaultPay to carry on regulated banking activities. Until CBN licensing or an approved regulated-partner arrangement is in force, the production application remains in a pre-licensing/gated mode.

## Target legal and operating model

Proposed group structure:

```
VaultPay Group / HoldCo (optional)
├── VaultPay Technologies Ltd
│   ├── Product and software/IP
│   ├── Mobile/web applications
│   ├── API and engineering
│   └── Technology services under arm's-length agreements
│
└── VaultPay Payment Service Bank Ltd (proposed regulated entity)
    ├── Customer accounts and deposits
    ├── Payment and remittance services
    ├── Electronic wallet
    ├── Debit/prepaid card programme
    ├── CBN reporting and supervision
    ├── AML/CFT/CPF
    ├── Consumer protection
    ├── Risk, treasury and reconciliation
    └── National Payments System integration
```

CBN's published PSB framework permits fintech companies to promote a PSB and describes PSBs as deposit-taking/payment institutions. The framework also states that a PSB may accept deposits, provide payments/remittances, issue debit/prepaid cards and operate an electronic wallet, while loans and advances are not permitted under that framework. urlCBN PSB licensing guidelinehttps://www.cbn.gov.ng/out/2018/fprd/guidelines%20for%20the%20licensing%20and%20regulation%20of%20payment%20services%20banks.pdf

## VaultPay software boundary

VaultPay Technologies is the technology layer. It must not present itself as the licensed bank unless the regulated entity actually holds the applicable CBN authorization.

The application therefore exposes:

- `REGULATORY_MODEL=CBN_PSB_PRE_LICENSING`
- `REGULATORY_STATUS=APPLICATION_READY`
- `LIVE_MONEY_ENABLED=false`

Live money movement is deliberately gated until the regulatory and provider prerequisites are complete.

## Required regulated controls

The target PSB implementation must include governance, risk management, compliance, IT/infrastructure, AML/CFT, KYC, consumer protection, internal controls, audit, security and reporting. CBN's published PSB licensing guideline describes an Approval-in-Principle stage, final licensing, pre-licensing inspection and ongoing supervisory requirements. urlCBN PSB supervisory frameworkhttps://www.cbn.gov.ng/Out/2021/CCD/Supervisory%20Framework%20for%20PSBs.pdf

The CBN's current 2026 initiatives also include stronger real-time fraud monitoring, identity verification for online account opening/reactivation, multi-factor authentication for instant-payment opt-in/opt-out controls, and temporary restrictions for newly activated devices. urlCBN 2026 reforms and initiativeshttps://www.cbn.gov.ng/AboutCBN/Reforms.html

## Product boundary

### Allowed target PSB products

- NGN customer accounts
- Savings/deposit products within the permitted PSB scope
- Electronic wallet
- P2P/internal transfers
- Nigerian bank transfers/remittances
- Inbound funding
- Debit/prepaid cards
- Bill payments
- Statements and transaction history

### Not included as a PSB product by default

- Lending/loan products
- Credit facilities
- Unapproved investment products
- Foreign-currency deposits
- Any activity outside the licensed scope

Any product outside the PSB scope requires the relevant separate regulatory basis or licensed partner.

## Licensing sequence

1. Finalize the product perimeter and legal entity structure.
2. Prepare the PSB business case, governance, ownership, management, risk, compliance, IT and financial plan.
3. Submit the CBN PSB application/AIP package.
4. Complete the CBN review and, if granted, operate from the AIP stage toward final licensing.
5. Complete CAC and corporate documentation steps required by the applicable CBN licensing process.
6. Complete pre-licensing inspection and National Payments System integration requirements.
7. Obtain final licence/commencement approvals.
8. Enter live-money production mode only after regulatory and provider sign-off.

CBN's published guideline requires a formal application, business case, governance, risk, compliance and financial-viability materials, and states that a proposed PSB should not be registered with CAC in that process until written AIP has been obtained. Requirements can be varied by CBN, so the current application instructions must be confirmed before filing. urlCBN PSB licensing guidelinehttps://www.cbn.gov.ng/out/2018/fprd/guidelines%20for%20the%20licensing%20and%20regulation%20of%20payment%20services%20banks.pdf

## Interim production model

Until VaultPay itself is licensed, the safer production model is:

```
Customer
  ↓
VaultPay Technologies
  ↓
Approved CBN-regulated bank/PSP
  ↓
Regulated account / settlement / payment rails
```

VaultPay remains the technology provider; the regulated institution holds the regulated relationship and performs the activities within its authorization.

## Production gate

No live-money flag should be enabled merely because provider API credentials exist.

Required before enabling live money:

- applicable CBN authorization or executed regulated-partner arrangement
- provider approval
- KYC/AML/CFT/CPF controls
- fraud monitoring
- signed contracts and settlement/reconciliation procedures
- security assessment and operational runbooks
- webhook verification
- backup/restore and incident testing
- production limits and customer-protection controls
