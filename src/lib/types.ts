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
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OcrEngine = "tesseract" | "cloud";

/** Per-club feature toggles + their config. Extensible: one key per feature. */
export interface ClubFeaturesJSON {
  accountantAssistant?: {
    enabled: boolean;
    ocrEngine: OcrEngine;
  };
}

export interface ClubJSON {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  description?: string;
  managerEmails: string[];
  // playtomicSecretEncrypted is deliberately absent — never sent to a client.
  playtomicClientId?: string | null;
  playtomicTenantId?: string | null;
  playtomicConnectedAt?: string | null;
  features?: ClubFeaturesJSON;
  createdAt: string;
  updatedAt: string;
}

export type AccountantDocumentStatus =
  | "uploaded"
  | "processing"
  | "parsed"
  | "failed"
  | "unsupported";

/** A stored accountant document. Never carries the raw `data` bytes. */
export interface AccountantDocumentJSON {
  _id: string;
  clubId: string;
  uploadedByEmail?: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  ocrEngine: OcrEngine;
  status: AccountantDocumentStatus;
  extractedText: string;
  documentType?: string | null;
  error?: string | null;
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
  managedClubs: {
    _id: string;
    name: string;
    slug: string;
    // Just the enabled flags the manager nav needs to decide which
    // feature tabs to show.
    features: { accountantAssistant: boolean };
  }[];
}

/** Deep-converts Mongoose docs / ObjectIds / Dates into plain JSON-safe values. */
export function serialize<T = unknown>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Strips `scorePin` before a tournament reaches any client. The field is
 * `select: false` in the schema so it's already absent from ordinary reads —
 * this only matters right after `Tournament.create()`/`.save()`, where the
 * in-memory document still carries whatever was just set.
 */
export function sanitizeTournament<T extends object>(tournament: T): T {
  const obj = tournament as T & { scorePin?: unknown };
  delete obj.scorePin;
  return obj;
}

/**
 * Strips `playtomicSecretEncrypted` before a club reaches any client. Same
 * reasoning as `sanitizeTournament` above — `select: false` already excludes
 * it from ordinary reads, this matters right after a write.
 */
export function sanitizeClub<T extends object>(club: T): T {
  const obj = club as T & { playtomicSecretEncrypted?: unknown };
  delete obj.playtomicSecretEncrypted;
  return obj;
}
