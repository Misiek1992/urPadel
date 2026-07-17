# urPadel — Implementation Contract

This is the authoritative spec. Every slice must follow it exactly. The core
libraries described here are ALREADY IMPLEMENTED — read them before coding.

## Product

urPadel lets padel clubs organize **Americano / Mexicano / Americano Team /
Mexicano Team** tournaments, enter results per court, and maintain a rolling
1-year **club ranking**. Roles:

- **Visitor** (no login): browses clubs, tournaments, live rounds, rankings;
  can submit a result for the current round from a court page.
- **Club manager** (email listed in `club.managerEmails`): manages the club's
  players, tournaments and ranking via the **/manager** panel.
- **Super admin** (`m.ignaczak.92@gmail.com` by default + emails in AppUser
  collection): manages clubs, assigns manager emails, manages superadmins,
  views the audit log via **/superadmin**. Superadmins implicitly manage every club.

Auth is **Clerk** (already wired: middleware, ClerkProvider, /sign-in,
/sign-up, header sign-in button). Storage is **MongoDB via Mongoose** (models
in `src/lib/models.ts`).

## Stack & conventions (MANDATORY)

- Next.js **15** App Router, TypeScript strict, Tailwind **v4**.
- **`params` and `searchParams` are Promises** in pages/layouts/route
  handlers: `const { slug } = await params;`
  Route handler signature: `export async function GET(req: NextRequest, { params }: { params: Promise<{ clubId: string }> })`.
- Every page that touches the DB or auth: `export const dynamic = "force-dynamic";`
- Server components read the DB directly via models (`await dbConnect()`
  first). Mutations go through API routes called from client components.
- Pass Mongoose docs to client components ONLY through `serialize<T>()` from
  `@/lib/types`.
- Client components: `"use client"` at top; after successful mutations call
  `router.refresh()` (from `next/navigation`) and/or refetch.
- API route pattern:

```ts
import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { apiError, requireManagerOf } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
  try {
    const { clubId } = await params;
    const email = await requireManagerOf(clubId);
    await dbConnect();
    const body = await req.json();
    // ... validate, mutate, logAction(...)
    return NextResponse.json({ ok: true /* , data */ });
  } catch (e) {
    return apiError(e);
  }
}
```

- Errors from APIs are `{ error: string }` with proper status. Client
  components must surface them (inline `<ErrorText>`), never swallow.
- No TODOs, no placeholder screens — everything fully implemented.

## Design system (MANDATORY)

Dark, sporty, modern: navy background, **volt** (lime) accents, ocean blue
secondary. Never introduce other accent colors; never use light backgrounds.

- Colors (Tailwind tokens): `navy-950/900/850/800/700/600`, `volt-300/400/500/600`,
  `ocean-400/500`, plus standard slate/white/red.
- CSS classes from `globals.css`: `.card`, `.card-pad`, `.btn`, `.btn-primary`,
  `.btn-secondary`, `.btn-ghost`, `.btn-danger`, `.btn-sm`, `.btn-lg`,
  `.input`, `.label`, `.table-wrap`, `.table-base`, `.badge`, `.badge-volt`,
  `.badge-blue`, `.badge-red`, `.badge-slate`, `.section-title`.
- Components from `@/components/ui` (all client-safe): `Button({variant,size})`,
  `Card`, `PageHeader({title,subtitle,actions})`, `Input`, `Textarea`,
  `Select`, `Badge({tone})`, `Spinner`, `ErrorText`, `EmptyState({title,hint,action})`,
  `StatCard({label,value,hint})`, `Modal({open,onClose,title,children,footer})`,
  `cn(...)`.
- Brand: `Logo` / `PadelMark` from `@/components/Logo`.
- Tables: `<div className="table-wrap"><table className="table-base">…`.
- Highlight rank 1–3 rows with volt/silver-ish/bronze-ish accents (use
  `text-volt-300`, `text-slate-300`, `text-amber-600/80` medal dots or badges).

## Data model (see src/lib/types.ts + src/lib/models.ts)

Models: `Club`, `ClubPlayer`, `RankingEntry`, `Tournament`, `AppUser`,
`AuditLog`. JSON shapes: `ClubJSON`, `ClubPlayerJSON`, `RankingEntryJSON`,
`TournamentJSON` (with `EntrantJSON`, `RoundJSON`, `MatchJSON`),
`RankingRowJSON`, `AuditLogJSON`, `ViewerJSON`.

Key semantics:

- `Tournament.entrants[]`: individual formats → one entrant per player
  (`players` empty). Team formats → one entrant per TEAM, `name: "Anna / Piotr"`,
  `players: ["Anna", "Piotr"]`.
- `Match.sideA/sideB`: entrant **ids** — 2 per side (individual), 1 per side (team).
- `Match.scoreA/scoreB`: rally points; `null` until entered; must sum to
  `tournament.matchPoints`.
- `Round.byes`: entrant ids resting that round.
- `Tournament.status`: `"active" | "finished"`. `playedAt` = tournament date.

## Core library reference (already implemented — import, don't reimplement)

From `@/lib/engine`:
- `TOURNAMENT_TYPES: {value,label,description}[]`, `MATCH_POINTS_OPTIONS = [16,21,24,32]`
- `isTeamType(type)`, `isMexicanoType(type)`, `typeLabel(type)`, `makeEntrantId()`
- `validateTournamentSetup(type, entrantCount, courtCount): string | null`
- `generateNextRound({type, entrants, courts, rounds, final?}): EngineRound` (throws Error with user-readable message)
- `computeStandings(entrants, rounds): StandingRow[]` — sorted; `StandingRow = {entrantId,name,players?,points,played,wins,draws,losses,diff}`
- `roundPointsByEntrant(round): Map<string, number | null>` — for the per-round results matrix

From `@/lib/ranking`:
- `pointsForPosition(position)`, `RANKING_WINDOW_DAYS`
- `awardTournamentPoints(tournament, {date?})`
- `computeClubRanking(clubId): Promise<RankingRowJSON[]>`

From `@/lib/auth`:
- `getViewer(): Promise<ViewerJSON>`, `getSessionEmail()`, `isSuperAdminEmail(email)`
- `requireSuperAdmin(): Promise<string>`, `requireManagerOf(clubId): Promise<string>` (throw `HttpError`)
- `apiError(e): NextResponse`, `DEFAULT_SUPERADMIN`

From `@/lib/audit`: `logAction({actorEmail, action, message, clubId?, tournamentId?, meta?})` — call for EVERY mutation.

From `@/lib/players-import`: `parsePlayersText(raw): string[]` — isomorphic;
use client-side for file uploads / pasted text (CSV, semicolon, tab, plain
lines; Playtomic exports; skips header rows, emails, numbers; dedupes).

## API contract

All routes under `src/app/api/`. Auth column: `public` (none), `manager`
(`requireManagerOf(clubId)`), `superadmin` (`requireSuperAdmin()`).

| Method & path | Auth | Body → Response |
|---|---|---|
| `GET /api/me` | public | → `ViewerJSON` |
| `GET /api/clubs` | public | → `{ clubs: ClubJSON[] }` |
| `POST /api/clubs` | superadmin | `{name, slug?, city?, description?}` → `{club}` (slug auto from name if absent, lowercase kebab; 409 if taken) |
| `PATCH /api/clubs/[clubId]` | manager | `{name?, city?, description?}` → `{club}` |
| `DELETE /api/clubs/[clubId]` | superadmin | → `{ok:true}` (also deletes its players/tournaments/ranking entries) |
| `POST /api/clubs/[clubId]/managers` | superadmin | `{email}` → `{club}` (lowercase, dedupe, validate email) |
| `DELETE /api/clubs/[clubId]/managers?email=` | superadmin | → `{club}` |
| `GET /api/clubs/[clubId]/players` | public | → `{players: ClubPlayerJSON[]}` sorted by name |
| `POST /api/clubs/[clubId]/players` | manager | `{name, email?}` OR `{names: string[]}` (bulk import) → `{players}` (skip existing by nameLower) |
| `PATCH /api/clubs/[clubId]/players/[playerId]` | manager | `{name?, email?}` → `{player}` (keep nameLower in sync) |
| `DELETE /api/clubs/[clubId]/players/[playerId]` | manager | → `{ok:true}` |
| `GET /api/clubs/[clubId]/ranking` | public | → `{rows: RankingRowJSON[]}` (computeClubRanking) |
| `POST /api/clubs/[clubId]/ranking/adjust` | manager | `{playerName, points (int, can be negative), note?}` → `{ok:true}` (creates `kind:"adjustment"` entry, date now) |
| `PATCH /api/ranking-entries/[entryId]` | manager of entry's club | `{points?, note?}` → `{entry}` |
| `DELETE /api/ranking-entries/[entryId]` | manager of entry's club | → `{ok:true}` |
| `GET /api/clubs/[clubId]/tournaments` | public | → `{tournaments: TournamentJSON[]}` newest `playedAt` first |
| `POST /api/clubs/[clubId]/tournaments` | manager | `{name, type, matchPoints, courts: string[], entrants: {name, players?}[]}` → `{tournament}` — validate with `validateTournamentSetup` (team types: each entrant needs exactly 2 players; matchPoints int 4–128; courts non-empty, trimmed, unique). Server assigns entrant ids via `makeEntrantId()`, generates round 1 with `generateNextRound`, status `active`, `playedAt` now |
| `GET /api/tournaments/[tournamentId]` | public | → `{tournament: TournamentJSON, standings: StandingRow[]}` |
| `DELETE /api/tournaments/[tournamentId]` | manager | → `{ok:true}` (any status; also delete its RankingEntry docs if pointsAwarded) |
| `POST /api/tournaments/[tournamentId]/rounds` | manager | `{final?: boolean}` → `{tournament}` — 400 if status ≠ active; 400 "Enter all results for round N first" if current round has null scores; 400 if current round `isFinal` ("Final round played — close the tournament") |
| `POST /api/tournaments/[tournamentId]/result` | public | `{roundNumber, court, scoreA, scoreB}` → `{tournament}` — integers ≥ 0 summing to `matchPoints` (else 400). Public callers may only set a result for the CURRENT (last) round when that match's scores are still null; a signed-in club manager may edit any round's result. 400 if tournament finished |
| `POST /api/tournaments/[tournamentId]/close` | manager | → `{tournament}` — sets status `finished`, `finishedAt` now; if `!pointsAwarded`: `awardTournamentPoints(t)` then set `pointsAwarded=true`. Can be called in any round (unfinished matches simply don't count) |
| `GET /api/superadmins` | superadmin | → `{emails: string[]}` (include DEFAULT_SUPERADMIN, mark it non-removable) |
| `POST /api/superadmins` | superadmin | `{email}` → `{emails}` |
| `DELETE /api/superadmins?email=` | superadmin | → `{emails}` (400 when removing DEFAULT_SUPERADMIN) |
| `GET /api/audit?clubId=&limit=` | superadmin (managers: only with clubId they manage) | → `{logs: AuditLogJSON[]}` newest first, default limit 200 |

Every mutation calls `logAction` with a concise action slug
(`club.create`, `club.managers.add`, `players.import`, `tournament.create`,
`tournament.round`, `tournament.result`, `tournament.close`,
`ranking.adjust`, …) and a human-readable message.

## Tournament flow rules

1. Creating a tournament immediately generates **round 1** (Americano:
   optimized random; Mexicano: lottery).
2. Results are entered per match (per court). Score pair must sum to
   `matchPoints`; UI enters one side and auto-fills the other (still editable).
3. When every match of the current round has a result, the manager chooses:
   - **Next round** — `generateNextRound` (Americano: minimize repeat
     partners/opponents; Mexicano: standings-seeded 1&2 vs 3&4, 5&6 vs 7&8…).
   - **Final round** — standings-seeded for ALL formats (1st&2nd vs 3rd&4th…;
     teams: 1st vs 2nd, 3rd vs 4th). Marked with `isFinal`.
   - **Close tournament** — allowed at ANY point, even mid-round.
4. Closing awards ranking points by final position: 1st→100, 2nd→90 …
   10th→10, 11th+→1 (participation). Team formats: both players get the
   team's points. Points live in `RankingEntry` and count for 365 days.
5. Byes: entrants that don't fit on courts rest; engine rotates rests fairly;
   show resting names each round with a "resting" badge.

## Route map (pages)

Public (slice B): `/` (landing), `/clubs`, `/club/[slug]`,
`/t/[tournamentId]`, `/t/[tournamentId]/court/[court]` (court label
URL-encoded), `/t/[tournamentId]/results`.

Manager (slice C): `/manager`, `/manager/players`, `/manager/ranking`,
`/manager/tournaments/new`, `/manager/tournaments/[tournamentId]`.
Club selection via `?club=<clubId>` query param (default: first of
`viewer.managedClubs`); every internal manager link must preserve it.
Components in `src/components/manager/`.

Superadmin (slice D): `/superadmin`, `/superadmin/clubs`,
`/superadmin/admins`, `/superadmin/logs`. Components in
`src/components/superadmin/`.

Pages that require a role must render a polite `EmptyState` (sign in / no
access) instead of crashing when the viewer lacks it.

Slice A owns everything under `src/app/api/`. Slice B owns
`src/components/public/`. No slice touches files outside its list.
