// Reduces personal-info exposure on pages anyone can reach without signing
// in: a player's surname is shown as just its first letter (e.g. "Anna
// Kowalska" → "Anna K."). Manager/superadmin views are unaffected — they
// call the normal (non-sanitized) data directly and never touch these
// helpers, since managers legitimately need full names to run their club.
import type { ClubPlayerJSON, EntrantJSON, RankingRowJSON } from "./types";
import type { StandingRow } from "./engine";

/** "Anna Kowalska" -> "Anna K.". Single-word names pass through unchanged. */
export function truncateSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const firstNames = parts.slice(0, -1).join(" ");
  const surnameInitial = parts[parts.length - 1][0];
  return `${firstNames} ${surnameInitial}.`;
}

/**
 * Same as `truncateSurname`, but also handles team display names, which
 * default to "PlayerA / PlayerB" (see TournamentWizard) — each side is
 * truncated independently. A club's custom team nickname (rare, opt-in)
 * isn't a real name and may read slightly oddly truncated; that's an
 * acceptable trade-off for correctly anonymizing the common default case.
 */
export function truncatePublicName(name: string): string {
  if (name.includes(" / ")) {
    return name.split(" / ").map(truncateSurname).join(" / ");
  }
  return truncateSurname(name);
}

export function sanitizeEntrantsForPublic(entrants: EntrantJSON[]): EntrantJSON[] {
  return entrants.map((e) => ({
    ...e,
    name: truncatePublicName(e.name),
    players: e.players?.map(truncateSurname),
  }));
}

export function sanitizeStandingsForPublic(standings: StandingRow[]): StandingRow[] {
  return standings.map((row) => ({
    ...row,
    name: truncatePublicName(row.name),
    players: row.players?.map(truncateSurname),
  }));
}

export function sanitizeRankingForPublic(rows: RankingRowJSON[]): RankingRowJSON[] {
  return rows.map((row) => ({
    ...row,
    playerName: truncateSurname(row.playerName),
  }));
}

/**
 * For the public roster endpoint: drops `email` and `nameLower` (the latter
 * is just the un-truncated name lowercased, which would defeat the point)
 * entirely rather than truncating them — a public visitor has no legitimate
 * use for either.
 */
export function sanitizePlayersForPublic(
  players: ClubPlayerJSON[]
): { _id: string; name: string; createdAt: string }[] {
  return players.map((p) => ({
    _id: p._id,
    name: truncateSurname(p.name),
    createdAt: p.createdAt,
  }));
}
