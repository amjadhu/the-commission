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
  ranking jsonb,
  updated_at bigint
);
