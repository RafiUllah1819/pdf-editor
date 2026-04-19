-- Migration 002 — Add working_file_path to documents
-- Stores the storage key of the SDK-edited copy.
-- The original file_path is never touched after upload.
--
-- Run:  psql $DATABASE_URL < db/migrations/002_add_working_file.sql

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS working_file_path TEXT;
