# Commission

A web app for NFL fans to browse news feeds, post hot takes, and rank teams.

## Running locally

Open `index.html` in a browser — no build step required.

### Supabase configuration

This app uses Supabase as a shared database for rankings, takes, and reactions. To set it up:

1. **Create a Supabase project** — Sign up at [supabase.com](https://supabase.com)

2. **Get your credentials:**
   - Go to **Settings** → **API**
   - Copy your **Project URL** and **anon key**

3. **Configure locally:**
   - Copy `js/config.local.example.js` to `js/config.local.js`
   - Open `js/config.local.js` and replace the placeholder values with your URL and key
   - `js/config.local.js` is ignored by git — your secrets stay local

4. **Set up the database schema:**
   - Go to Supabase **SQL Editor** → **New query**
   - Copy and run the SQL from `supabase/schema.sql`
   - This creates the `reactions`, `takes`, `votes`, and `rankings` tables

5. **Start the server:** `python -m http.server` then open `http://localhost:8000`

**Note:** Without Supabase configured, the app falls back to localStorage (local-only mode).

## Browser tests

The test suite uses [Playwright](https://playwright.dev/) to run 32 automated checks against the app (feed loading, user selection, hot takes, rankings, navigation).

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Setup (one time)

```bash
npm install
npx playwright install chromium
```

### Run tests

```bash
npm test
```

The test script spins up a local HTTP server automatically, runs all checks in a headless Chromium browser, then shuts everything down. You should see output like:

```
===== 32 passed, 0 failed, 0 console errors =====
```
