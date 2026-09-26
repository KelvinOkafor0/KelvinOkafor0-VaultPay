ALTER TABLE accounts ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS processing_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS last_error TEXT;
CREATE INDEX IF NOT EXISTS idx_outbox_available ON outbox_events(published_at,available_at,processing_at,created_at) WHERE published_at IS NULL;
