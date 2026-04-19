-- PDF Editor MVP — PostgreSQL Schema
-- Run once on a fresh database:  psql $DATABASE_URL < db/schema.sql
-- For an existing database use:  db/migrations/001_add_users.sql
-- Requires PostgreSQL 13+

-- ─────────────────────────────────────────────────────────────────────────────
-- users
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- documents
-- Each document belongs to one user.  Deleting a user cascades to documents.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL,
  original_name       TEXT        NOT NULL,
  file_path           TEXT        NOT NULL,   -- storage key of the original upload; never changes
  file_size           INTEGER     NOT NULL,
  page_count          INTEGER     NOT NULL DEFAULT 0,
  latest_version_num  INTEGER     NOT NULL DEFAULT 1,  -- mirrors max(document_versions.version_num)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- document_versions
-- One row per saved state of a document.  version_num 1 = original upload.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_num  INTEGER     NOT NULL,
  file_path    TEXT        NOT NULL,
  file_size    INTEGER     NOT NULL,
  label        TEXT,                            -- "original" | "edited" | user-supplied
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, version_num)
);

CREATE INDEX IF NOT EXISTS document_versions_document_id_idx
  ON document_versions (document_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- editor_states
-- One row per document; annotations and page order stored as JSONB.
-- Created automatically when a document is first opened in the editor.
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: keep updated_at current on every UPDATE
-- ─────────────────────────────────────────────────────────────────────────────
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
