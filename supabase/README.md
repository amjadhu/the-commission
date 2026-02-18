Supabase setup for The Commission

1) Create a Supabase project
   - Use the Supabase web dashboard (recommended) or the Supabase CLI.
   - From the dashboard, go to Settings → API to copy the Project URL and anon key.

2) Set credentials
   - Copy .env.template to .env or set these environment variables:
     SUPABASE_URL=your_project_url
     SUPABASE_ANON_KEY=your_anon_key
   - (Optional) For server-side migrations or admin tasks use the service_role key but store it securely.

3) Apply the schema
   - Option A (SQL editor): Open the Supabase SQL editor in the dashboard and run supabase/schema.sql
   - Option B (psql): psql "<connection-string>" -f supabase/schema.sql (get connection string from Project → Settings → Database)
   - Option C (local dev): use 'supabase start' for a local Postgres and psql against it.

4) Wire the client
   - Include the Supabase JS SDK in index.html, e.g:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>
   - Use createClient(SUPABASE_URL, SUPABASE_ANON_KEY) and replace DB.* usage with the adapter in js/supabase.js

Notes
 - The SQL creates tables matching the app's Firestore usage: reactions, takes, votes, rankings.
 - Timestamps are stored as bigint milliseconds to match Date.now() usage in the app.
