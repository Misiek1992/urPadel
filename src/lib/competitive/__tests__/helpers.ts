import type { Entrant } from "@/lib/engine";
import type { ScoringMode, TieJSON } from "@/lib/types";
import { isPlayable } from "../index";
import { resolveTies } from "../resolve";
import type { CompTournament } from "../types";

export function teams(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    name: `Team ${i + 1}`,
    players: [`P${i + 1}a`, `P${i + 1}b`],
  }));
}

/** A score where side A wins, in the given mode. */
export function aWins(scoring: ScoringMode): TieJSON["score"] {
  return scoring === "sets" ? { sets: [{ a: 6, b: 2 }, { a: 6, b: 3 }] } : { a: 21, b: 10 };
}

/** A score where side B wins, in the given mode. */
export function bWins(scoring: ScoringMode): TieJSON["score"] {
  return scoring === "sets" ? { sets: [{ a: 2, b: 6 }, { a: 3, b: 6 }] } : { a: 10, b: 21 };
}

/**
 * Play a tournament to completion by repeatedly scoring every playable tie
 * (side A always wins) and re-resolving, until nothing is playable.
 */
export function playThrough(t: CompTournament, sideAWins = true): CompTournament {
  let ties = t.ties.map((x) => ({ ...x }));
  let guard = 0;
  while (guard++ < 2000) {
    const playable = ties.filter((x) => isPlayable(x, t.scoring));
    if (playable.length === 0) break;
    for (const p of playable) {
      const tie = ties.find((x) => x.id === p.id)!;
      tie.score = sideAWins ? aWins(t.scoring) : bWins(t.scoring);
    }
    ties = resolveTies({ ...t, ties });
  }
  return { ...t, ties };
}

export function tieById(ties: TieJSON[], id: string): TieJSON {
  const tie = ties.find((x) => x.id === id);
  if (!tie) throw new Error(`no tie ${id}`);
  return tie;
}
