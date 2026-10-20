---
name: Giveaway viewer app
overview: Build a password-protected Next.js app that lists current raffle entrants and previous losers from the existing Supabase pity_system table, ready to deploy on Vercel’s free plan.
todos:
  - id: scaffold
    content: Create the Next.js app in giveaway-viewer
    status: completed
  - id: auth
    content: Add the password form, httpOnly cookie, and logout
    status: completed
  - id: lists
    content: Load pity_system and render current entrants and previous losers
    status: completed
  - id: deploy-notes
    content: Document the three Vercel environment variables in the app README only if needed for local run; otherwise keep them in comments the user already expects from the plan
    status: completed
isProject: false
---

# Giveaway entrant viewer

A small Next.js app in `giveaway-viewer` next to the existing Lambda code. It only reads `pity_system`. It does not enter people or draw winners.

## What the page shows

After the password check, one page with two lists, each sorted by `pity_tickets` descending:

- **In this raffle:** `is_loser` is false. Show username, ticket count, entrant count, and total tickets.
- **Previous losers:** `is_loser` is true. Same columns, so a carried pity stack is visible before they enter again.

The page loads fresh data on every visit. Empty lists get a short empty message.

## Access

One shared password in `VIEWER_PASSWORD`. A server action compares it to the form value and sets an httpOnly cookie. Later requests check that cookie before querying Supabase. A logout button clears the cookie.

`SUPABASE_URL` and `SUPABASE_KEY` stay server-only. They are the same values as the Lambdas and are not prefixed with `NEXT_PUBLIC_`.

## App shape

- [giveaway-viewer/app/page.tsx](giveaway-viewer/app/page.tsx) renders the login form or both lists.
- [giveaway-viewer/app/actions.ts](giveaway-viewer/app/actions.ts) handles login and logout.
- [giveaway-viewer/lib/supabase.ts](giveaway-viewer/lib/supabase.ts) creates the server Supabase client.
- [giveaway-viewer/lib/auth.ts](giveaway-viewer/lib/auth.ts) checks the cookie.

Query:

```ts
supabase.from('pity_system').select('username, pity_tickets, is_loser').order('pity_tickets', { ascending: false })
```

Split the rows in the page by `is_loser`.

## Deploy

Create the app locally, then import the folder into a Vercel Hobby project. Set `SUPABASE_URL`, `SUPABASE_KEY`, and `VIEWER_PASSWORD` in the Vercel project environment. No database migration is required.
