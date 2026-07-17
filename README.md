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

Configuration lives in `.env.local` (Clerk keys, `MONGODB_URI`,
`SUPERADMIN_EMAIL`).

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
