# VaultPay CBN PSB application readiness pack

## Regulatory status

VaultPay is **not CBN licensed** unless and until CBN grants the applicable licence and the licence is effective. The production software therefore uses:

- `REGULATORY_MODEL=CBN_PSB_PRE_LICENSING`
- `REGULATORY_STATUS=APPLICATION_READY`
- `LIVE_MONEY_ENABLED=false`

These settings prevent the software from representing an application-ready product as a licensed institution or from enabling live-money movement prematurely.

## Official application route

CBN's Licensing, Approval and Request Portal (LARP) is the official online portal for licensing, approvals and related regulatory requests:

https://larp.cbn.gov.ng/

## PSB application workstream

Prepare and validate, with Nigerian regulatory counsel and the CBN application team as appropriate:

1. Proposed legal entity and ownership structure.
2. Board, directors, senior management and governance documentation.
3. Business plan and three-year financial projections.
4. Evidence of required capital and source-of-funds documentation.
5. Enterprise risk-management framework.
6. AML/CFT/CPF, sanctions, PEP, CDD/EDD and transaction-monitoring framework.
7. Consumer-protection, complaints and dispute-management framework.
8. Information-security, cybersecurity, privacy and technology architecture.
9. Business continuity, disaster recovery and incident-response plans.
10. Internal audit, compliance and independent assurance arrangements.
11. Payment-operations, settlement and reconciliation design.
12. Technology outsourcing/shared-services agreements and oversight model.
13. Data governance, records retention and regulatory-reporting procedures.
14. Provider, processor, card and settlement agreements where applicable.
15. Evidence for pre-licensing inspection and operational readiness.

## Product perimeter

The proposed PSB scope is limited to activities permitted under the applicable CBN framework. Do not launch lending, investment, foreign-currency or other regulated products unless there is a separate legal/regulatory basis and approval.

## Licensing stages

The CBN's published PSB guideline describes an Approval-in-Principle stage followed by final licensing and pre-licensing inspection. Requirements, forms, fees, capital and supervisory expectations can be updated by CBN, so the current LARP requirements and CBN correspondence must control the filing.

## Go-live gate

Only after the applicable CBN licence/authorization is effective (or a valid regulated-partner arrangement is documented for the interim operating model) should production move to live-money mode.

Required evidence before changing the software gate:

- Effective CBN authorization or executed regulated-partner arrangement
- Provider production approval
- Signed settlement and reconciliation arrangements
- KYC/AML/fraud controls operational
- Security and penetration testing complete
- Incident, complaints and dispute operations ready
- Regulatory reporting operational
- Backup/restore and disaster-recovery tests passed
- Final legal/compliance sign-off
