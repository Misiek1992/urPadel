// Scoring for competitive ties. Two modes, chosen per tournament:
//   "points" — one number per side, higher wins (e.g. 21–17).
//   "sets"   — games per set (e.g. 6–4, 4–6, 7–5), winner by sets won.
// Draws are never allowed: a knockout must resolve, and the league table is
// win/loss based, so validateScore rejects any tied result.
import type { CompetitiveConfigJSON, ScoringMode, TieScoreJSON } from "@/lib/types";

export type Side = "A" | "B";

/** True once a usable result has been entered for the given mode. */
export function scoreEntered(score: TieScoreJSON, scoring: ScoringMode): boolean {
  if (scoring === "sets") return (score.sets?.length ?? 0) > 0;
  return score.a != null && score.b != null;
}

/** Sets won by each side (sets mode only). */
export function setsWon(score: TieScoreJSON): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const s of score.sets ?? []) {
    if (s.a > s.b) a++;
    else if (s.b > s.a) b++;
  }
  return { a, b };
}

/** The winning side, or null if undecided / drawn. */
export function winnerOf(score: TieScoreJSON, scoring: ScoringMode): Side | null {
  if (!scoreEntered(score, scoring)) return null;
  if (scoring === "sets") {
    const { a, b } = setsWon(score);
    if (a === b) return null;
    return a > b ? "A" : "B";
  }
  const a = score.a as number;
  const b = score.b as number;
  if (a === b) return null;
  return a > b ? "A" : "B";
}

/** Per-side aggregate used to build league/group tables. */
export interface SideTotals {
  /** points mode: raw points; sets mode: games won */
  pointsFor: number;
  pointsAgainst: number;
  setsFor: number;
  setsAgainst: number;
}

export function sideTotals(score: TieScoreJSON, scoring: ScoringMode): { a: SideTotals; b: SideTotals } {
  if (scoring === "sets") {
    let ga = 0;
    let gb = 0;
    for (const s of score.sets ?? []) {
      ga += s.a;
      gb += s.b;
    }
    const { a: sa, b: sb } = setsWon(score);
    return {
      a: { pointsFor: ga, pointsAgainst: gb, setsFor: sa, setsAgainst: sb },
      b: { pointsFor: gb, pointsAgainst: ga, setsFor: sb, setsAgainst: sa },
    };
  }
  const a = (score.a as number) ?? 0;
  const b = (score.b as number) ?? 0;
  return {
    a: { pointsFor: a, pointsAgainst: b, setsFor: 0, setsAgainst: 0 },
    b: { pointsFor: b, pointsAgainst: a, setsFor: 0, setsAgainst: 0 },
  };
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

/** Validate a submitted score for the tournament's scoring mode. */
export function validateScore(
  score: TieScoreJSON,
  scoring: ScoringMode,
  config?: CompetitiveConfigJSON | null
): ValidationResult {
  if (scoring === "sets") {
    const sets = score.sets ?? [];
    if (sets.length === 0) return { ok: false, error: "Enter at least one set." };
    const bestOf = config?.bestOfSets ?? 3;
    if (sets.length > bestOf) return { ok: false, error: `Best of ${bestOf} — too many sets entered.` };
    for (const s of sets) {
      if (!Number.isInteger(s.a) || !Number.isInteger(s.b) || s.a < 0 || s.b < 0) {
        return { ok: false, error: "Set games must be whole numbers of 0 or more." };
      }
      if (s.a === s.b) return { ok: false, error: "A set can't end level." };
    }
    if (winnerOf(score, scoring) == null) {
      return { ok: false, error: "The match must have an overall winner." };
    }
    return { ok: true };
  }
  const a = score.a;
  const b = score.b;
  if (!Number.isInteger(a) || !Number.isInteger(b) || (a as number) < 0 || (b as number) < 0) {
    return { ok: false, error: "Scores must be whole numbers of 0 or more." };
  }
  if (a === b) return { ok: false, error: "The match must have a winner — no draws." };
  return { ok: true };
}
