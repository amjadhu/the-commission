-- Supabase schema for The Commission
-- Timestamps store milliseconds since epoch to match the app's Date.now()

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reactions: one row per (news_id, emoji, user_id)
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id text NOT NULL,
  emoji text NOT NULL,
  user_id text NOT NULL,
  timestamp bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS reactions_unique ON reactions (news_id, emoji, user_id);
CREATE INDEX IF NOT EXISTS reactions_news_idx ON reactions (news_id);

-- Takes: user-submitted hot opinions
CREATE TABLE IF NOT EXISTS takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  author_id text NOT NULL,
  timestamp bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS takes_timestamp_idx ON takes (timestamp DESC);

-- Votes: one vote row per (take_id, user_id)
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id uuid REFERENCES takes(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('agree','disagree')),
  user_id text NOT NULL,
  timestamp bigint NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS votes_unique ON votes (take_id, user_id);

-- Rankings: saved per-user ranking
CREATE TABLE IF NOT EXISTS rankings (
  user_id text PRIMARY KEY,
  ranking jsonb NOT NULL,
  updated_at bigint NOT NULL
);

-- ============================================================
-- Row Level Security
-- The app uses the anon key only (no Supabase Auth).
-- RLS is enabled to satisfy security requirements; policies
-- grant the anon role the access the app needs.
-- ============================================================

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE takes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings  ENABLE ROW LEVEL SECURITY;

-- reactions: public read, anon can insert/delete
CREATE POLICY "reactions_select" ON reactions FOR SELECT TO anon USING (true);
CREATE POLICY "reactions_insert" ON reactions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "reactions_delete" ON reactions FOR DELETE TO anon USING (true);

-- takes: public read, anon can insert
CREATE POLICY "takes_select" ON takes FOR SELECT TO anon USING (true);
CREATE POLICY "takes_insert" ON takes FOR INSERT TO anon WITH CHECK (true);

-- votes: public read, anon can insert/delete
CREATE POLICY "votes_select" ON votes FOR SELECT TO anon USING (true);
CREATE POLICY "votes_insert" ON votes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "votes_delete" ON votes FOR DELETE TO anon USING (true);

-- rankings: public read, anon can insert/update
CREATE POLICY "rankings_select" ON rankings FOR SELECT TO anon USING (true);
CREATE POLICY "rankings_insert" ON rankings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "rankings_update" ON rankings FOR UPDATE TO anon USING (true) WITH CHECK (true);
