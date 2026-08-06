// Single-elimination bracket builder. A random draw seeds round 1; non-power-
// of-two fields are resolved either with byes (top slots skip round 1) or a
// play-in round, per the creator's choice. Every later round's sides are
// `winner`-of references, wired at build time and filled by resolveTies as
// results come in.
import type { Entrant } from "@/lib/engine";
import type { TieJSON, TieSideJSON } from "@/lib/types";
import type { BuiltStructure } from "./types";
import { byeSide, entrantSide, interleave, loserSide, makeTie, winnerSide } from "./tie";
import { isPow2, knockoutRoundLabel, largestPow2LE, nextPow2, shuffle } from "./util";

export interface KnockoutOptions {
  byeMode?: "bye" | "playin";
  thirdPlace?: boolean;
}

function pairUp(ids: string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  return pairs;
}

/**
 * Given the ids of a round's ties (a power-of-two count), append every
 * subsequent round up to the final, plus an optional third-place playoff.
 * Round-1 ties must already be in `ties`. `startRound` is round 1's number.
 */
export function linkUpperRounds(
  round1TieIds: string[],
  ties: TieJSON[],
  startRound: number,
  thirdPlace: boolean
): void {
  let prev = round1TieIds;
  let round = startRound + 1;
  let semiFinals: string[] = [];
  while (prev.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const id = `ko-r${round}-m${i / 2}`;
      ties.push(makeTie(id, "knockout", round, winnerSide(prev[i]), winnerSide(prev[i + 1])));
      next.push(id);
    }
    if (next.length === 1) semiFinals = prev.slice();
    prev = next;
    round++;
  }

  // Label knockout rounds by size (Final / Semi-final / …).
  const counts = new Map<number, number>();
  for (const t of ties) {
    if (t.stage === "knockout") counts.set(t.round, (counts.get(t.round) ?? 0) + 1);
  }
  const finalRound = Math.max(...ties.filter((t) => t.stage === "knockout").map((t) => t.round));
  for (const t of ties) {
    if (t.stage === "knockout") t.label = knockoutRoundLabel(counts.get(t.round)!);
  }

  if (thirdPlace && semiFinals.length === 2) {
    ties.push(
      makeTie("ko-3rd", "knockout", finalRound, loserSide(semiFinals[0]), loserSide(semiFinals[1]), {
        label: "Third place",
      })
    );
  }
}

/** Build a knockout bracket from a flat entrant list (random draw). */
export function buildKnockout(
  entrants: Entrant[],
  opts: KnockoutOptions = {}
): BuiltStructure {
  const ids = shuffle(entrants.map((e) => e.id));
  const N = ids.length;
  const ties: TieJSON[] = [];
  if (N < 2) return { groups: [], ties };

  const byeMode = opts.byeMode ?? "bye";
  const round1TieIds: string[] = [];

  if (isPow2(N)) {
    // Clean bracket — pair the shuffled entrants directly.
    pairUp(ids).forEach(([a, b], i) => {
      const id = `ko-r1-m${i}`;
      ties.push(makeTie(id, "knockout", 1, entrantSide(a), entrantSide(b)));
      round1TieIds.push(id);
    });
  } else if (byeMode === "playin") {
    const M = largestPow2LE(N); // main-draw size
    const playInMatches = N - M;
    const prelimTeams = ids.slice(0, playInMatches * 2);
    const directTeams = ids.slice(playInMatches * 2);
    const prelimIds: string[] = [];
    for (let i = 0; i < playInMatches; i++) {
      const id = `ko-p${i}`;
      ties.push(
        makeTie(id, "playin", 0, entrantSide(prelimTeams[2 * i]), entrantSide(prelimTeams[2 * i + 1]), {
          label: "Play-in",
        })
      );
      prelimIds.push(id);
    }
    // Main draw round 1: interleave direct entrants with play-in winners.
    const slots: TieSideJSON[] = interleave(
      directTeams.map(entrantSide),
      prelimIds.map(winnerSide)
    );
    for (let i = 0; i < slots.length; i += 2) {
      const id = `ko-r1-m${i / 2}`;
      ties.push(makeTie(id, "knockout", 1, slots[i], slots[i + 1]));
      round1TieIds.push(id);
    }
  } else {
    // Byes: (bracketSize - N) entrants skip round 1.
    const bracketSize = nextPow2(N);
    const byeCount = bracketSize - N;
    const withBye = ids.slice(0, byeCount);
    const rest = ids.slice(byeCount);
    const byeMatches = withBye.map((id) => ({ a: entrantSide(id), b: byeSide(), bye: true }));
    const realMatches = pairUp(rest).map(([a, b]) => ({
      a: entrantSide(a),
      b: entrantSide(b),
      bye: false,
    }));
    interleave(byeMatches, realMatches).forEach((m, i) => {
      const id = `ko-r1-m${i}`;
      const t = makeTie(id, "knockout", 1, m.a, m.b);
      if (m.bye) t.winner = "A"; // auto-advance; resolveTies propagates it
      ties.push(t);
      round1TieIds.push(id);
    });
  }

  linkUpperRounds(round1TieIds, ties, 1, !!opts.thirdPlace);
  return { groups: [], ties };
}
