// Tournament engine for Americano / Mexicano (individual and team formats).
//
// Individual formats: an "entrant" is a single player; every match has 2 entrants per side.
// Team formats: an "entrant" is a fixed pair; every match has 1 entrant per side.
//
// Scoring model (both formats): matches are played to a fixed number of total
// rally points (matchPoints, e.g. 21/24/32). A result like 16-8 gives every
// entrant on side A 16 points and every entrant on side B 8 points.
//
// Pairing rules implemented here (per club spec):
// - Americano: partners/opponents rotate; each new round is optimised to
//   minimise repeated partners first, then repeated opponents.
// - Mexicano: round 1 is random; every later round is seeded from the live
//   standings — 1st & 2nd vs 3rd & 4th on court 1, 5th & 6th vs 7th & 8th on
//   court 2, and so on.
// - Final round (any format): seeded from the live standings the same way.
// - Team variants: same logic with teams as units (Mexicano Team: 1st vs 2nd,
//   3rd vs 4th, ...).
// - Byes: when players don't fit on the available courts, the entrants with
//   the fewest byes so far rest (ties broken randomly), so rests rotate fairly.

export type TournamentType =
  | "americano"
  | "mexicano"
  | "americano-team"
  | "mexicano-team";

export interface Entrant {
  id: string;
  name: string;
  players?: string[];
}

export interface EngineMatch {
  court: string;
  sideA: string[];
  sideB: string[];
  scoreA: number | null;
  scoreB: number | null;
}

export interface EngineRound {
  number: number;
  isFinal: boolean;
  matches: EngineMatch[];
  byes: string[];
}

export interface StandingRow {
  entrantId: string;
  name: string;
  players?: string[];
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  diff: number;
}

export const TOURNAMENT_TYPES: {
  value: TournamentType;
  label: string;
  description: string;
}[] = [
  {
    value: "americano",
    label: "Americano",
    description:
      "Individual play — partners rotate every round so you play with and against everyone. Every rally point counts towards your personal score.",
  },
  {
    value: "mexicano",
    label: "Mexicano",
    description:
      "Individual play — round 1 is random, then every round is re-seeded from the live leaderboard: 1st & 2nd vs 3rd & 4th on court 1, and so on.",
  },
  {
    value: "americano-team",
    label: "Americano Team",
    description:
      "Fixed pairs — your team keeps its score across rounds and the schedule minimises repeat opponents.",
  },
  {
    value: "mexicano-team",
    label: "Mexicano Team",
    description:
      "Fixed pairs — teams are re-matched every round by the live standings: 1st vs 2nd, 3rd vs 4th, and so on.",
  },
];

export const MATCH_POINTS_OPTIONS = [16, 21, 24, 32];

export function isTeamType(type: TournamentType): boolean {
  return type === "americano-team" || type === "mexicano-team";
}

export function isMexicanoType(type: TournamentType): boolean {
  return type === "mexicano" || type === "mexicano-team";
}

export function typeLabel(type: TournamentType): string {
  return TOURNAMENT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function makeEntrantId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Returns an error message if the setup is invalid, otherwise null. */
export function validateTournamentSetup(
  type: TournamentType,
  entrantCount: number,
  courtCount: number
): string | null {
  if (courtCount < 1) return "At least one court is required.";
  if (isTeamType(type)) {
    if (entrantCount < 2) return "Team formats need at least 2 teams (4 players).";
  } else {
    if (entrantCount < 4) return "Individual formats need at least 4 players.";
  }
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function inc(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

function cnt(map: Map<string, number>, a: string, b: string): number {
  return map.get(pairKey(a, b)) ?? 0;
}

interface Tally {
  partners: Map<string, number>;
  opponents: Map<string, number>;
  byes: Map<string, number>;
}

function tallyHistory(rounds: EngineRound[]): Tally {
  const partners = new Map<string, number>();
  const opponents = new Map<string, number>();
  const byes = new Map<string, number>();
  for (const round of rounds) {
    for (const id of round.byes) inc(byes, id);
    for (const m of round.matches) {
      if (m.sideA.length === 2) inc(partners, pairKey(m.sideA[0], m.sideA[1]));
      if (m.sideB.length === 2) inc(partners, pairKey(m.sideB[0], m.sideB[1]));
      for (const a of m.sideA) for (const b of m.sideB) inc(opponents, pairKey(a, b));
    }
  }
  return { partners, opponents, byes };
}

/** Live standings: total rally points, then wins, then point difference, then name. */
export function computeStandings(
  entrants: Entrant[],
  rounds: EngineRound[]
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const e of entrants) {
    rows.set(e.id, {
      entrantId: e.id,
      name: e.name,
      players: e.players && e.players.length ? e.players : undefined,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      diff: 0,
    });
  }
  const apply = (ids: string[], own: number, other: number) => {
    for (const id of ids) {
      const row = rows.get(id);
      if (!row) continue;
      row.points += own;
      row.diff += own - other;
      row.played += 1;
      if (own > other) row.wins += 1;
      else if (own < other) row.losses += 1;
      else row.draws += 1;
    }
  };
  for (const round of rounds) {
    for (const m of round.matches) {
      if (m.scoreA == null || m.scoreB == null) continue;
      apply(m.sideA, m.scoreA, m.scoreB);
      apply(m.sideB, m.scoreB, m.scoreA);
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.diff - a.diff ||
      a.name.localeCompare(b.name)
  );
}

/** Points scored by each entrant in a given round (null = bye / not played). */
export function roundPointsByEntrant(round: EngineRound): Map<string, number | null> {
  const map = new Map<string, number | null>();
  for (const id of round.byes) map.set(id, null);
  for (const m of round.matches) {
    for (const id of m.sideA) map.set(id, m.scoreA);
    for (const id of m.sideB) map.set(id, m.scoreB);
  }
  return map;
}

const PARTNER_REPEAT_WEIGHT = 100;
const OPPONENT_REPEAT_WEIGHT = 10;

function scheduleCost(
  order: string[],
  matchCount: number,
  perMatch: number,
  team: boolean,
  partners: Map<string, number>,
  opponents: Map<string, number>
): number {
  let cost = 0;
  for (let m = 0; m < matchCount; m++) {
    const g = order.slice(m * perMatch, (m + 1) * perMatch);
    if (team) {
      const c = cnt(opponents, g[0], g[1]);
      cost += OPPONENT_REPEAT_WEIGHT * c * c;
    } else {
      const [a, b, c, d] = g;
      const p1 = cnt(partners, a, b);
      const p2 = cnt(partners, c, d);
      cost += PARTNER_REPEAT_WEIGHT * (p1 * p1 + p2 * p2);
      for (const [x, y] of [
        [a, c],
        [a, d],
        [b, c],
        [b, d],
      ] as const) {
        const o = cnt(opponents, x, y);
        cost += OPPONENT_REPEAT_WEIGHT * o * o;
      }
    }
  }
  return cost;
}

/**
 * Hill-climbing optimiser with random restarts: orders the playing entrants so
 * that consecutive groups form matches with the fewest repeated partners and
 * opponents. Group sizes are tiny (<= 32 entrants), so this is fast.
 */
function optimizeOrder(
  ids: string[],
  matchCount: number,
  perMatch: number,
  team: boolean,
  partners: Map<string, number>,
  opponents: Map<string, number>
): string[] {
  let best: string[] = shuffle(ids);
  let bestCost = scheduleCost(best, matchCount, perMatch, team, partners, opponents);
  for (let restart = 0; restart < 8 && bestCost > 0; restart++) {
    const order = restart === 0 ? [...best] : shuffle(ids);
    let cost = scheduleCost(order, matchCount, perMatch, team, partners, opponents);
    let improved = true;
    while (improved && cost > 0) {
      improved = false;
      for (let i = 0; i < order.length - 1; i++) {
        for (let j = i + 1; j < order.length; j++) {
          [order[i], order[j]] = [order[j], order[i]];
          const c = scheduleCost(order, matchCount, perMatch, team, partners, opponents);
          if (c < cost) {
            cost = c;
            improved = true;
          } else {
            [order[i], order[j]] = [order[j], order[i]];
          }
        }
      }
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = [...order];
    }
  }
  return best;
}

function buildMatches(
  orderedIds: string[],
  matchCount: number,
  perMatch: number,
  team: boolean,
  courts: string[]
): EngineMatch[] {
  const matches: EngineMatch[] = [];
  for (let m = 0; m < matchCount; m++) {
    const g = orderedIds.slice(m * perMatch, (m + 1) * perMatch);
    matches.push({
      court: courts[m] ?? `Court ${m + 1}`,
      sideA: team ? [g[0]] : [g[0], g[1]],
      sideB: team ? [g[1]] : [g[2], g[3]],
      scoreA: null,
      scoreB: null,
    });
  }
  return matches;
}

export function generateNextRound(opts: {
  type: TournamentType;
  entrants: Entrant[];
  courts: string[];
  rounds: EngineRound[];
  final?: boolean;
}): EngineRound {
  const { type, entrants, courts, rounds, final = false } = opts;
  const team = isTeamType(type);
  const perMatch = team ? 2 : 4;
  const n = entrants.length;

  const setupError = validateTournamentSetup(type, n, courts.length);
  if (setupError) throw new Error(setupError);
  if (!team && n < 4) throw new Error("Need at least 4 players for a round.");

  const matchCount = Math.min(courts.length, Math.floor(n / perMatch));
  if (matchCount < 1) throw new Error("Not enough entrants for a single match.");
  const playingCount = matchCount * perMatch;

  const { partners, opponents, byes } = tallyHistory(rounds);

  // Rest the entrants with the fewest byes so far (random among ties) so that
  // byes rotate fairly through the field.
  const restCount = n - playingCount;
  const byOldestRest = shuffle(entrants).sort(
    (a, b) => (byes.get(a.id) ?? 0) - (byes.get(b.id) ?? 0)
  );
  const resting = byOldestRest.slice(0, restCount);
  const restingIds = new Set(resting.map((e) => e.id));
  const playing = entrants.filter((e) => !restingIds.has(e.id));

  const seeded = final || (isMexicanoType(type) && rounds.length > 0);

  let orderedIds: string[];
  if (seeded) {
    orderedIds = computeStandings(entrants, rounds)
      .filter((r) => !restingIds.has(r.entrantId))
      .map((r) => r.entrantId);
  } else if (isMexicanoType(type)) {
    // Mexicano round 1: lottery.
    orderedIds = shuffle(playing.map((e) => e.id));
  } else {
    orderedIds = optimizeOrder(
      playing.map((e) => e.id),
      matchCount,
      perMatch,
      team,
      partners,
      opponents
    );
  }

  return {
    number: rounds.length + 1,
    isFinal: final,
    matches: buildMatches(orderedIds, matchCount, perMatch, team, courts),
    byes: resting.map((e) => e.id),
  };
}
