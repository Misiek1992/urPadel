# urPadel 🎾

**The home of Americano & Mexicano padel tournaments.** Clubs organize social
tournaments, players enter scores right at the court, and a rolling one-year
club ranking updates automatically.

## Features

- **Four formats**: Americano, Mexicano, Americano Team, Mexicano Team
  - Americano: rotating partners, schedule optimised to minimise repeated
    partners/opponents (perfect whist rotation where one exists)
  - Mexicano: round 1 by lottery, then every round seeded from the live
    leaderboard — 1st & 2nd vs 3rd & 4th on court 1, and so on
  - Team variants: fixed pairs playing as units
- **Tournament wizard**: pick a format, import players (Playtomic export,
  CSV, text file or paste), choose numbered or custom-named courts, set
  match points (16/21/24/32/custom)
- **Live play**: every court gets its own tablet-friendly page for score
  entry; rounds advance manually when everyone has finished; a
  standings-seeded **final round** (1st with 2nd vs 3rd with 4th) can be
  played before closing
- **Results**: full per-round × per-player results matrix for every
  tournament, live and after closing
- **Club ranking**: 1st place 100 pts, 2nd 90 … 10th 10, everyone else 1
  participation point; points count for **365 days**; managers can edit
  points and add manual adjustments
- **Roles**: public club pages → club managers (assigned by email) →
  super admins (default: `m.ignaczak.92@gmail.com`), with a full audit log
  in the super admin panel

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Clerk (auth) ·
MongoDB Atlas via Mongoose

## Getting started

```bash
npm install
npm run seed     # loads the demo club, 18 players, tournaments & rankings
npm run dev      # http://localhost:3000
```

Configuration lives in `.env.local` — copy `.env.example` and fill in your
own Clerk keys / `MONGODB_URI` / `SUPERADMIN_EMAIL`.

### Demo data

`npm run seed` creates **Padel Arena Warsaw** (`/club/padel-arena-warsaw`)
with 18 players, three finished tournaments (simulated through the real
engine, with every round and result browsable), one live Mexicano night in
round 3, ranking points and sample audit logs. ⚠️ The seed wipes existing
app data first.

Sign in with the super admin email to see the **Club manager** and
**Super admin** panels.

## Project layout

```
src/lib/        engine.ts (pairing/standings), ranking.ts, models.ts, auth.ts …
src/app/        public pages, /manager, /superadmin, /api
src/components/ design system (ui.tsx), Logo, slice components
scripts/seed.ts demo data
docs/CONTRACT.md internal API & behavior spec
```

## Deploying to Vercel

The app is zero-config for Vercel (standard Next.js App Router, all
DB/auth-touching routes are `force-dynamic` so nothing hits MongoDB during
the build). Steps:

1. **Import the repo** in the Vercel dashboard (New Project → your GitHub
   repo). Framework preset "Next.js" is auto-detected; no build command
   overrides are needed.

2. **Add environment variables** (Project Settings → Environment Variables).
   Copy every key from [`.env.example`](.env.example) with your real values.
   Add them to **Production**, **Preview** *and* **Development** environments
   unless you intentionally want per-environment values (e.g. a separate
   staging Mongo database via a different `MONGODB_URI`/`MONGODB_DB`).
   - `NEXT_PUBLIC_*` vars are baked into the client bundle at build time —
     if you change them, redeploy.
   - Set `NEXT_PUBLIC_SITE_URL` to your final Vercel domain (e.g.
     `https://urpadel.vercel.app` or your custom domain) once you know it —
     it's only used for page metadata, so it's safe to redeploy later.

3. **MongoDB Atlas network access**: Vercel's serverless functions run from
   dynamic IPs, so under Atlas → Network Access, add `0.0.0.0/0` ("Allow
   access from anywhere") — or, for tighter security, use Vercel's
   [Secure Compute](https://vercel.com/docs/secure-compute) / a static
   outbound IP add-on and allow-list that instead.

4. **Clerk**: the bundled keys are **test-mode** keys tied to Clerk's
   development instance and its default allowed origins. For a real
   production domain, create a production Clerk instance (Clerk dashboard →
   switch to Production) and use its `pk_live_…` / `sk_live_…` keys instead,
   then add your Vercel domain under Clerk → Domains. Test keys will still
   work for a quick preview deploy, but expect Clerk to warn about it.

5. **Deploy.** Vercel builds with `npm run build` and serves every page as a
   serverless function (all pages are dynamic, so there's no static/ISR
   caching to worry about).

6. **Seed data (optional, one-time)**: the seed script targets whatever
   `MONGODB_URI` is in your environment, so to populate the *production*
   database, run it locally against those production credentials:
   ```bash
   MONGODB_URI="<production-uri>" MONGODB_DB="urpadel" npm run seed
   ```
   ⚠️ This wipes and replaces all data in that database — never run it
   against a database with real club data you want to keep.

No `vercel.json` is required. `next.config.ts` already marks `mongoose` as a
server-external package so it isn't bundled by webpack, and `package.json`
pins `"engines": { "node": "20.x" }` to match Vercel's default Node runtime.
