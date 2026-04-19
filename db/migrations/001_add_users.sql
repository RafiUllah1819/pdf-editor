-- Migration 001 — Add users table and link documents to users
-- Run this against an EXISTING database that was set up before auth was added.
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS).
--
-- Steps:
--   1. Run this file:
--        psql $DATABASE_URL < db/migrations/001_add_users.sql
--
--   2. Create your first account by registering at /login in the app.
--
--   3. Find your new user ID:
--        SELECT id, email FROM users;
--
--   4. Assign existing documents to that user (replace <YOUR_USER_ID>):
--        UPDATE documents SET user_id = '<YOUR_USER_ID>' WHERE user_id IS NULL;
--
--   5. Enforce NOT NULL now that all rows have a user_id:
--        ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;

-- ── 1. Create users table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Add user_id column (nullable to allow existing rows) ─────────────────
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
