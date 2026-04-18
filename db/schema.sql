-- PDF Editor MVP — PostgreSQL Schema
-- Run this once against your database to create all tables.
-- Requires PostgreSQL 13+ (gen_random_uuid is built-in).

-- -----------------------------------------------------------------------
-- documents
-- Stores metadata for every uploaded PDF file.
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  original_name TEXT        NOT NULL,
  file_path     TEXT        NOT NULL,          -- local path or storage key
  file_size     INTEGER     NOT NULL,          -- bytes
  page_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------
-- editor_states
-- One row per document; stores annotation data and page order as JSONB.
-- Created automatically when a document is first opened in the editor.
-- -----------------------------------------------------------------------
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

-- -----------------------------------------------------------------------
-- Trigger: keep updated_at current on every UPDATE automatically
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER editor_states_updated_at
  BEFORE UPDATE ON editor_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
