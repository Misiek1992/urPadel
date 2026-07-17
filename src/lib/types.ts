// Shared plain-JSON shapes used across server components, client components and API routes.
// Mongoose documents must be passed through serialize() before crossing the
// server -> client component boundary.

export type TournamentType =
  | "americano"
  | "mexicano"
  | "americano-team"
  | "mexicano-team";

export type TournamentStatus = "active" | "finished";

export interface EntrantJSON {
  /** Stable short id, unique within the tournament */
  id: string;
  /** Display name. For teams: "Anna / Piotr" */
  name: string;
  /** For team formats: the two player names. Empty/absent for individual formats. */
  players?: string[];
}

export interface MatchJSON {
  /** Court label, e.g. "Court 1" or "Center Court" */
  court: string;
  /** Entrant ids. Individual formats: 2 ids per side. Team formats: 1 id per side. */
  sideA: string[];
  sideB: string[];
  scoreA: number | null;
  scoreB: number | null;
}

export interface RoundJSON {
  number: number;
  isFinal: boolean;
  matches: MatchJSON[];
  /** Entrant ids resting this round */
  byes: string[];
}

export interface TournamentJSON {
  _id: string;
  clubId: string;
  name: string;
  type: TournamentType;
  matchPoints: number;
  courts: string[];
  entrants: EntrantJSON[];
  rounds: RoundJSON[];
  status: TournamentStatus;
  pointsAwarded: boolean;
  playedAt: string;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClubJSON {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  description?: string;
  managerEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ClubPlayerJSON {
  _id: string;
  clubId: string;
  name: string;
  nameLower: string;
  email?: string;
  createdAt: string;
}

export type RankingEntryKind = "tournament" | "adjustment";

export interface RankingEntryJSON {
  _id: string;
  clubId: string;
  playerId?: string;
  playerName: string;
  tournamentId?: string;
  tournamentName?: string;
  points: number;
  position?: number;
  kind: RankingEntryKind;
  note?: string;
  date: string;
}

export interface RankingRowJSON {
  position: number;
  playerName: string;
  playerId?: string;
  total: number;
  tournamentsPlayed: number;
  entries: RankingEntryJSON[];
}

export interface AuditLogJSON {
  _id: string;
  actorEmail: string;
  action: string;
  message: string;
  clubId?: string;
  tournamentId?: string;
  createdAt: string;
}

export interface ViewerJSON {
  email: string | null;
  isSuperAdmin: boolean;
  managedClubs: { _id: string; name: string; slug: string }[];
}

/** Deep-converts Mongoose docs / ObjectIds / Dates into plain JSON-safe values. */
export function serialize<T = unknown>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
