DO $$ BEGIN CREATE TYPE inbound_transfer_status AS ENUM ('PENDING','SUCCESS','FAILED','REVERSED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS inbound_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id),
  provider VARCHAR(100) NOT NULL,
  provider_reference VARCHAR(255) NOT NULL,
  provider_event_id VARCHAR(255),
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  status inbound_transfer_status NOT NULL DEFAULT 'PENDING',
  source_account_number VARCHAR(64),
  source_name VARCHAR(255),
  narration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_reference),
  UNIQUE(provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_inbound_account_created ON inbound_transfers(account_id, created_at DESC);
