# Supabase Database Schema

This folder contains the database schema for The Commission app.

## Setup Instructions

**See the main [README.md](../README.md) for complete Supabase setup instructions**, including:
- Creating a Supabase project
- Getting your credentials
- Configuring `js/config.local.js`
- Applying the database schema

## Schema Details

The `schema.sql` file creates four tables:

- **reactions** — Stores emoji reactions to news articles
  - `id`, `newsId`, `emoji`, `userId`, `timestamp`

- **takes** — Stores user posts/opinions
  - `id`, `text`, `authorId`, `timestamp`

- **votes** — Stores agree/disagree votes on takes
  - `id`, `takeId`, `vote` (enum: 'agree'|'disagree'), `userId`, `timestamp`

- **rankings** — Stores each user's team rankings
  - `userId` (primary key), `ranking` (array of team abbreviations), `updatedAt`

All timestamps are stored as `bigint` milliseconds to match JavaScript's `Date.now()` usage in the app.

## Applying the Schema

Once you have a Supabase project, apply the schema using the SQL Editor:

1. Go to Supabase **SQL Editor** → **New query**
2. Copy and run the SQL from `supabase/schema.sql`
3. The tables are now ready to use
