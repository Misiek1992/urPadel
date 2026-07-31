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
- `Tournament.createdByName`: the manager who created it, as a **display
  name** (Clerk `firstName`+`lastName`, falling back to `username`; see
  `getSessionName()` in `src/lib/auth.ts`), set at creation and never
  changed after. Public — shown on the tournament and results pages as
  "Started by {name}". Deliberately a name, not `requireManagerOf`'s email —
  every other actor-tracking field in this app (`AuditLog.actorEmail`, the
  `logAction` calls throughout) uses email since those views are
  manager/superadmin-only, but an email address rendered to a signed-out
  visitor is scrapable, which undercuts the same privacy goal as the surname
  truncation below. `null` if the Clerk user never set a name.
- **Public-page name truncation** (`src/lib/privacy.ts`): every route a
  signed-out visitor can reach truncates player surnames to their first
  letter ("Anna Kowalska" → "Anna K.") via `sanitizeEntrantsForPublic` /
  `sanitizeStandingsForPublic` / `sanitizeRankingForPublic` /
  `sanitizePlayersForPublic`, applied once at each page's/route's data-fetch
  boundary (not deep in shared components) — `computeStandings`/`entrantMap`/
  `sideNames` just render whatever they're given, so downstream components
  never need to know about truncation. Manager/superadmin routes call the
  same data functions directly and are unaffected. Covers: `/t/[id]`,
  `/t/[id]/results`, `/t/[id]/court/[court]`, `/club/[slug]`,
  `/club/[slug]/player/[playerId]` (including the subject's own name), all
  three `opengraph-image.tsx` routes, and the public GET routes
  (`/api/tournaments/[id]`, `/api/clubs/[id]/tournaments`,
  `/api/clubs/[id]/ranking`, `/api/clubs/[id]/players` — the last of these
  also drops `email`/`nameLower` entirely rather than truncating, since a
  public visitor has no legitimate use for either) and the public result
  endpoint's response. New pages/routes that render player names to a
  signed-out visitor must apply the matching `sanitize*ForPublic` call.
- `Tournament.scorePin`: optional 4-6 digit string, default `null`. `select:
  false` in the schema — absent from every query unless a route explicitly
  does `.select("+scorePin")` (only `result/route.ts` does, to check it).
  Never in `TournamentJSON`; after `Tournament.create()`/`.save()` the
  in-memory doc still carries it, so any response built from a just-written
  doc must go through `sanitizeTournament()` (src/lib/types.ts) first.
- `Club.playtomicClientId` / `playtomicTenantId` / `playtomicConnectedAt`:
  Playtomic Third-Party API identifiers, not secrets — read normally,
  present in `ClubJSON`. `Club.playtomicSecretEncrypted`: AES-256-GCM
  ciphertext (`src/lib/crypto.ts`, key from `CREDENTIALS_ENCRYPTION_KEY`),
  same `select: false` + `sanitizeClub()` treatment as `scorePin` above —
  only `playtomic/route.ts` (save) and `playtomic/tournaments/route.ts`
  (list) opt in with `.select("+playtomicSecretEncrypted")`, and it's never
  in `ClubJSON`.

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
- `awardTournamentPoints(tournament, {date?})` — batched (one player bulk-upsert
  + one `insertMany`), not a per-player loop
- `computeClubRanking(clubId): Promise<RankingRowJSON[]>` — wrapped in React
  `cache()`, so calling it twice in one request (metadata + body) hits the DB once

From `@/lib/club-stats`: `getClubStats(clubIds): Promise<Map<id, {players,tournaments,active}>>`
+ `statsFor(map, id)` — for club-listing surfaces (`/clubs`, home). Two grouped
aggregations total; never loop per-club count queries (the old N+1).

From `@/lib/auth`:
- `getViewer(): Promise<ViewerJSON>`, `getSessionEmail()`, `getSessionName()`, `isSuperAdminEmail(email)`
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
| `GET /api/clubs` | public | → `{ clubs: ClubJSON[] }` — **excludes `managerEmails`** (`-managerEmails` projection): public endpoint, manager addresses must not be exposed. The superadmin UI reads `managerEmails` via its own gated server-side props |
| `POST /api/clubs` | superadmin | `{name, slug?, city?, description?}` → `{club}` (slug auto from name if absent, lowercase kebab; 409 if taken) |
| `PATCH /api/clubs/[clubId]` | manager | `{name?, city?, description?}` → `{club}` |
| `DELETE /api/clubs/[clubId]` | superadmin | → `{ok:true}` (also deletes its players/tournaments/ranking entries) |
| `POST /api/clubs/[clubId]/managers` | superadmin | `{email}` → `{club}` (lowercase, dedupe, validate email) |
| `DELETE /api/clubs/[clubId]/managers?email=` | superadmin | → `{club}` |
| `PATCH /api/clubs/[clubId]/playtomic` | manager | `{clientId, secret?, tenantId}` → `{club}` — `secret` optional on update (reuses the stored one, decrypted, if omitted); verifies via a live Playtomic OAuth token exchange before saving anything (400 on failure, nothing persisted); response via `sanitizeClub` |
| `DELETE /api/clubs/[clubId]/playtomic` | manager | → `{club}` (clears all four `playtomic*` fields) |
| `GET /api/clubs/[clubId]/playtomic/tournaments?daysBack=&daysForward=` | manager | → `{tournaments: {activityId, name, date, players: {name, email?}[]}[]}` — Playtomic Bookings grouped by `activity_id`; 400 if not connected, 502 on Playtomic-side failure |
| `POST /api/clubs/[clubId]/playtomic/import` | manager | `{tournaments: {name, players: {name, email?}[]}[]}` (≤20 tournaments, ≤500 players total — the manager's checked subset, echoed back from the GET above) → `{tournaments: {name, playerNames}[], newPlayers}` — upserts `ClubPlayer` roster entries (backfills `email` on existing players missing one) |
| `GET /api/clubs/[clubId]/players` | public | → `{players}` sorted by name — sanitized via `sanitizePlayersForPublic` (no `email`/`nameLower`, surname truncated) |
| `POST /api/clubs/[clubId]/players` | manager | `{name, email?}` OR `{names: string[]}` (bulk import) → `{players}` (skip existing by nameLower) |
| `PATCH /api/clubs/[clubId]/players/[playerId]` | manager | `{name?, email?}` → `{player}` (keep nameLower in sync) |
| `DELETE /api/clubs/[clubId]/players/[playerId]` | manager | → `{ok:true}` |
| `GET /api/clubs/[clubId]/ranking` | public | → `{rows: RankingRowJSON[]}` (computeClubRanking) — `playerName` truncated via `sanitizeRankingForPublic` |
| `POST /api/clubs/[clubId]/ranking/adjust` | manager | `{playerName, points (int, can be negative), note?}` → `{ok:true}` (creates `kind:"adjustment"` entry, date now) |
| `PATCH /api/ranking-entries/[entryId]` | manager of entry's club | `{points?, note?}` → `{entry}` |
| `DELETE /api/ranking-entries/[entryId]` | manager of entry's club | → `{ok:true}` |
| `GET /api/clubs/[clubId]/tournaments` | public | → `{tournaments: TournamentJSON[]}` newest `playedAt` first — each tournament's `entrants` truncated via `sanitizeEntrantsForPublic` |
| `POST /api/clubs/[clubId]/tournaments` | manager | `{name, type, matchPoints, courts: string[], entrants: {name, players?}[], scorePin?}` → `{tournament}` — validate with `validateTournamentSetup` (team types: each entrant needs exactly 2 players; matchPoints int 4–128; courts ≤32 non-empty/trimmed/unique; entrants ≤128). Server assigns entrant ids via `makeEntrantId()`, generates round 1 with `generateNextRound`, status `active`, `playedAt` now, `createdByName` set from `getSessionName()`. `scorePin` optional, 4-6 digits or omitted; response is run through `sanitizeTournament` so it's never echoed back |
| `GET /api/tournaments/[tournamentId]` | public | → `{tournament: TournamentJSON, standings: StandingRow[]}` — `entrants`/`standings` names truncated via `sanitizeEntrantsForPublic` (only consumer today: `CourtLive`'s polling) |
| `DELETE /api/tournaments/[tournamentId]` | manager | → `{ok:true}` (any status; also delete its RankingEntry docs if pointsAwarded) |
| `POST /api/tournaments/[tournamentId]/rounds` | manager | `{final?: boolean}` → `{tournament}` — 400 if status ≠ active; 400 "Enter all results for round N first" if current round has null scores; 400 if current round `isFinal` ("Final round played — close the tournament"); 409 if another request already advanced the round since this one read it (client should refresh) |
| `POST /api/tournaments/[tournamentId]/result` | public | `{roundNumber, court, scoreA, scoreB, pin?}` → `{tournament}` — integers ≥ 0 summing to `matchPoints` (else 400). Public callers may only set a result for the CURRENT (last) round when that match's scores are still null; a signed-in club manager may edit any round's result (and never needs a PIN). 400 if tournament finished. If the tournament has `scorePin` set, non-manager callers must supply a matching `pin`: 403 `{error, code:"pin_required"}` if omitted, 403 `{error, code:"pin_invalid"}` if wrong — `HttpError`'s third constructor arg carries `code` through `apiError`. Rate-limited (20 req/min per IP+tournament). Written via an atomic positional `updateOne` (arrayFilters on round number + court, plus `scoreA:null` for non-managers) so two courts submitting simultaneously can't clobber each other; an idempotent resubmit of the same values is treated as success. Response's `entrants` truncated via `sanitizeEntrantsForPublic` (`publicTournament()` helper in this route) |
| `POST /api/tournaments/[tournamentId]/close` | manager | → `{tournament}` — atomically transitions `active`→`finished` (400 if already closed, including when raced concurrently) and flips `pointsAwarded` false→true; only the request that wins that flip runs `awardTournamentPoints(t)`, so concurrent closes can't double-award. Can be called in any round (unfinished matches simply don't count) |
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
`/club/[slug]/player/[playerId]` (ClubPlayer `_id`; entries resolved by
case-insensitive `playerName` match, same as `computeClubRanking`),
`/t/[tournamentId]`, `/t/[tournamentId]/court/[court]` (court label
URL-encoded), `/t/[tournamentId]/results`.

`/club/[slug]`, `/t/[tournamentId]` and `/t/[tournamentId]/results` each
export `generateMetadata` (title/description/OG/Twitter tags) and a sibling
`opengraph-image.tsx` (Next `ImageResponse`, nodejs runtime, brand chrome in
`src/lib/og.tsx`, fonts in `src/assets/fonts/` — Inter static TTF, needed for
Polish/Spanish diacritic glyph coverage that next/og's default font lacks).
`generateMetadata` and the page body share one DB read via the `cache()`-
wrapped loaders in `src/lib/loaders.ts` — reuse those instead of querying
`Tournament`/`Club` directly in these three files.

Manager (slice C): `/manager`, `/manager/players`, `/manager/ranking`,
`/manager/tournaments/new`, `/manager/tournaments/[tournamentId]`,
`/manager/settings` (Playtomic connection).
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
