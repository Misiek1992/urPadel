// The advancement engine. Pure and idempotent: given a tournament whose ties
// may have new scores, fill every resolvable source slot (winner-of / loser-of /
// group-place) with a concrete entrant, set the winner on any newly-decided
// tie, and repeat to a fixpoint. Safe to re-run after every score.
import type { Entrant } from "@/lib/engine";
import type { TieJSON } from "@/lib/types";
import { computeTable } from "./table";
import { scoreEntered, winnerOf } from "./scoring";
import type { CompTournament } from "./types";

function clone(ties: TieJSON[]): TieJSON[] {
  return JSON.parse(JSON.stringify(ties)) as TieJSON[];
}

function sideEntrantId(tie: TieJSON, side: "A" | "B"): string | null | undefined {
  return side === "A" ? tie.sideA.entrantId : tie.sideB.entrantId;
}

/** Group qualifier at 1-indexed `place`, or null until the group is complete. */
function groupQualifier(
  t: CompTournament,
  ties: TieJSON[],
  groupLabel: string,
  place: number
): string | null {
  const group = t.groups.find((g) => g.label === groupLabel);
  if (!group) return null;
  const groupTies = ties.filter((x) => x.stage === "group" && x.group === groupLabel);
  if (groupTies.length === 0) return null;
  if (!groupTies.every((x) => scoreEntered(x.score, t.scoring))) return null;
  const members = t.entrants.filter((e: Entrant) => group.entrantIds.includes(e.id));
  const table = computeTable(members, groupTies, t.scoring);
  return table[place - 1]?.entrantId ?? null;
}

export function resolveTies(t: CompTournament): TieJSON[] {
  const ties = clone(t.ties);
  const byId = new Map(ties.map((x) => [x.id, x]));

  // Decide any tie that has a score but no winner yet.
  for (const tie of ties) {
    if (tie.winner == null && scoreEntered(tie.score, t.scoring)) {
      tie.winner = winnerOf(tie.score, t.scoring);
    }
  }

  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10000) {
    changed = false;
    for (const tie of ties) {
      for (const key of ["sideA", "sideB"] as const) {
        const side = tie[key];
        if (side.entrantId || !side.source) continue;
        const src = side.source;
        let resolved: string | null | undefined;
        if (src.type === "winner" || src.type === "loser") {
          const feeder = byId.get(src.tieId);
          if (feeder && feeder.winner) {
            const wantSide =
              src.type === "winner"
                ? feeder.winner
                : feeder.winner === "A"
                  ? "B"
                  : "A";
            resolved = sideEntrantId(feeder, wantSide);
          }
        } else if (src.type === "group") {
          resolved = groupQualifier(t, ties, src.group, src.place);
        }
        if (resolved) {
          side.entrantId = resolved;
          changed = true;
        }
      }
    }
  }

  return ties;
}
