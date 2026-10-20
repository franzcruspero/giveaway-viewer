# Giveaway entrant viewer

Password-protected read of the `pity_system` table. After login, the page lists who is in the current raffle and who lost a previous one. It does not enter people or draw winners.

## Local run

Create `.env.local` with the same Supabase values the Lambdas use, plus the shared viewer password:

```
SUPABASE_URL=
SUPABASE_KEY=
VIEWER_PASSWORD=
```

These stay on the server. Do not prefix them with `NEXT_PUBLIC_`.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The page reads `pity_system` on every visit.

## Deploy

Import this folder into a Vercel Hobby project and set `SUPABASE_URL`, `SUPABASE_KEY`, and `VIEWER_PASSWORD` in the project environment. No database migration is required.
