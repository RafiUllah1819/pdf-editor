-- Migration 004 — Add editor_states table
--
-- editor_states was only in db/schema.sql, not in any prior migration.
-- Users who ran migrations 001-003 on a pre-existing DB are missing this table.
--
-- Run:
--   psql $DATABASE_URL < db/migrations/004_add_editor_states.sql
--
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS editor_states (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id       UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  annotations_json  JSONB       NOT NULL DEFAULT '[]',
  page_order_json   JSONB       NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS editor_states_document_id_uidx
  ON editor_states(document_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER editor_states_updated_at
  BEFORE UPDATE ON editor_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
