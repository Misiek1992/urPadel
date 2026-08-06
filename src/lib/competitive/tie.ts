// Small constructors for ties and tie-sides, shared by the format builders.
import type { TieJSON, TieSideJSON, TieStage } from "@/lib/types";

export function entrantSide(entrantId: string): TieSideJSON {
  return { entrantId };
}

export function winnerSide(tieId: string): TieSideJSON {
  return { entrantId: null, source: { type: "winner", tieId } };
}

export function loserSide(tieId: string): TieSideJSON {
  return { entrantId: null, source: { type: "loser", tieId } };
}

export function groupSide(group: string, place: number): TieSideJSON {
  return { entrantId: null, source: { type: "group", group, place } };
}

export function byeSide(): TieSideJSON {
  return { entrantId: null, source: { type: "bye" } };
}

export function makeTie(
  id: string,
  stage: TieStage,
  round: number,
  sideA: TieSideJSON,
  sideB: TieSideJSON,
  opts: { label?: string; group?: string } = {}
): TieJSON {
  return {
    id,
    stage,
    group: opts.group ?? null,
    round,
    label: opts.label ?? null,
    court: null,
    sideA,
    sideB,
    score: {},
    winner: null,
  };
}

/** Interleave two lists: [a0,b0,a1,b1,…] then any remainder. */
export function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}
