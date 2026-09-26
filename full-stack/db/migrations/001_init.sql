CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN CREATE TYPE user_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('CUSTOMER','ADMIN','OPS','COMPLIANCE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('NOT_STARTED','PENDING','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE account_status AS ENUM ('PENDING','ACTIVE','FROZEN','CLOSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE ledger_entry_type AS ENUM ('DEBIT','CREDIT'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE transfer_status AS ENUM ('CREATED','PENDING_AUTH','AUTHORIZED','SUBMITTED','PROCESSING','SUCCESS','FAILED','REVERSED','REFUNDED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE card_type AS ENUM ('VIRTUAL','PHYSICAL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE card_status AS ENUM ('PENDING','ACTIVE','FROZEN','BLOCKED','EXPIRED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE,
  phone VARCHAR(32) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status user_status NOT NULL DEFAULT 'PENDING',
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kyc_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  provider VARCHAR(100),
  provider_reference VARCHAR(255),
  verification_level VARCHAR(50),
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_profile_id UUID NOT NULL REFERENCES kyc_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  storage_reference TEXT NOT NULL,
  document_hash TEXT,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  provider_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  account_number VARCHAR(32) UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  status account_status NOT NULL DEFAULT 'PENDING',
  ledger_balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (ledger_balance >= 0),
  available_balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  provider VARCHAR(100),
  provider_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  code VARCHAR(100) UNIQUE NOT NULL,
  currency CHAR(3) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  ledger_account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  entry_type ledger_entry_type NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_code VARCHAR(20) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  account_name VARCHAR(200) NOT NULL,
  provider_reference VARCHAR(255),
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, bank_code, account_number)
);

CREATE TABLE IF NOT EXISTS transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_account_id UUID NOT NULL REFERENCES accounts(id),
  beneficiary_id UUID REFERENCES beneficiaries(id),
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'NGN',
  fee NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  status transfer_status NOT NULL DEFAULT 'CREATED',
  provider VARCHAR(100),
  provider_reference VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL,
  description TEXT,
  failure_code VARCHAR(100),
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_account_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id),
  issuer VARCHAR(100) NOT NULL,
  issuer_reference VARCHAR(255) NOT NULL UNIQUE,
  card_type card_type NOT NULL,
  network VARCHAR(30),
  token_reference TEXT,
  last4 CHAR(4),
  expiry_month SMALLINT CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year SMALLINT,
  status card_status NOT NULL DEFAULT 'PENDING',
  online_enabled BOOLEAN NOT NULL DEFAULT true,
  pos_enabled BOOLEAN NOT NULL DEFAULT true,
  atm_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_limit NUMERIC(20,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id),
  provider_reference VARCHAR(255),
  merchant_name VARCHAR(255),
  merchant_category_code VARCHAR(10),
  amount NUMERIC(20,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  status VARCHAR(30) NOT NULL,
  authorization_code VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_hash TEXT NOT NULL,
  response_code INTEGER,
  response_body JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (user_id, endpoint, key)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, event_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(30) NOT NULL,
  actor_id UUID,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  request_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(100) NOT NULL,
  business_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL,
  difference NUMERIC(20,2) NOT NULL DEFAULT 0,
  report_reference VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, business_date)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transfers_source_created ON transfers(source_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_provider_reference ON transfers(provider_reference);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(ledger_account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_transactions_card_created ON card_transactions(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_profiles(status);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(published_at, created_at) WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id, revoked_at);

