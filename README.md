# Fantasy Survivor — Season 51

A private four-team Survivor fantasy-league dashboard, starting at Episode 3.

The deployed app uses Supabase as the shared source of truth. Scores, episodes,
team names, and login setup are no longer stored in an individual browser.

## Local preview

```bash
python3 -m http.server 4173 --directory dist
```

Open `http://localhost:4173`.

Initial league access uses a team name and the league key `1234`. Team scores are calculated from scoring events in the browser.

## Supabase + Vercel setup

1. In Supabase, open **SQL Editor**, create a new query, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it.
2. In Vercel, confirm the Supabase integration is connected to this project for
   Production, Preview, and Development. It provides `SUPABASE_URL` and a
   server-only `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`).
3. In Vercel **Project Settings → Environment Variables**, add a long random
   value named `LEAGUE_SESSION_SECRET`. Do not expose or commit it.
4. Redeploy. The API automatically creates the initial Season 51 league record
   the first time it is opened.

For local API testing, provide those same three values in a local `.env` file
or in your terminal environment. Never put the Supabase secret in `dist/` or
any browser-visible JavaScript.
