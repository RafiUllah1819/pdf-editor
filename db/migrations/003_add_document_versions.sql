-- Migration 003 — Document versioning
--
-- What this adds:
--   1. document_versions table  — one row per saved version of a document.
--      version_num = 1 is always the original upload; 2, 3, … are SDK saves.
--   2. documents.latest_version_num  — integer counter so "give me the latest
--      file" is a single column read, no subquery needed.
--
-- What this removes:
--   3. documents.working_file_path  — superseded by document_versions.
--      (Added in migration 002; safe to drop because it was never in production.)
--
-- Run:
--   psql $DATABASE_URL < db/migrations/003_add_document_versions.sql
--
-- Idempotent: safe to run more than once.

-- ── 1. Versions table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_versions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_num  INTEGER     NOT NULL,            -- 1 = original, 2+ = edits
  file_path    TEXT        NOT NULL,            -- storage key (same as documents.file_path)
  file_size    INTEGER     NOT NULL,
  label        TEXT,                            -- optional human label, e.g. "original" / "edited"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (document_id, version_num)
);

CREATE INDEX IF NOT EXISTS document_versions_document_id_idx
  ON document_versions (document_id);

-- ── 2. latest_version_num counter on documents ───────────────────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS latest_version_num INTEGER NOT NULL DEFAULT 1;

-- ── 3. Drop working_file_path (superseded) ───────────────────────────────────
ALTER TABLE documents
  DROP COLUMN IF EXISTS working_file_path;

-- ── 4. Backfill version 1 for all existing documents ────────────────────────
-- Uses INSERT … ON CONFLICT DO NOTHING so re-running is safe.
INSERT INTO document_versions (document_id, version_num, file_path, file_size, label)
SELECT id, 1, file_path, file_size, 'original'
FROM   documents
ON CONFLICT (document_id, version_num) DO NOTHING;
