// Builds a standings table (StandingRow[]) from a set of scored ties — shared
// by league tables and per-group tables. No draws exist in competitive play, so
// table points are 3 per win. Ordering: points → difference → wins → name.
import type { Entrant, StandingRow } from "@/lib/engine";
import type { ScoringMode, TieJSON } from "@/lib/types";
import { scoreEntered, sideTotals, winnerOf } from "./scoring";

export const WIN_POINTS = 3;

/**
 * Compute the table for `entrants` from the subset of `ties` that are fully
 * resolved (both sides have an entrant) and scored. Ties involving entrants
 * outside the set are ignored.
 */
export function computeTable(
  entrants: Entrant[],
  ties: TieJSON[],
  scoring: ScoringMode
): StandingRow[] {
  const inTable = new Set(entrants.map((e) => e.id));
  const rows = new Map<string, StandingRow>();
  for (const e of entrants) {
    rows.set(e.id, {
      entrantId: e.id,
      name: e.name,
      players: e.players,
      points: 0,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      diff: 0,
    });
  }

  for (const tie of ties) {
    const aId = tie.sideA.entrantId;
    const bId = tie.sideB.entrantId;
    if (!aId || !bId || !inTable.has(aId) || !inTable.has(bId)) continue;
    if (!scoreEntered(tie.score, scoring)) continue;
    const winner = winnerOf(tie.score, scoring);
    if (!winner) continue;
    const totals = sideTotals(tie.score, scoring);
    const rowA = rows.get(aId)!;
    const rowB = rows.get(bId)!;
    rowA.played++;
    rowB.played++;
    const diffA =
      scoring === "sets"
        ? totals.a.setsFor - totals.a.setsAgainst
        : totals.a.pointsFor - totals.a.pointsAgainst;
    rowA.diff += diffA;
    rowB.diff -= diffA;
    if (winner === "A") {
      rowA.wins++;
      rowB.losses++;
      rowA.points += WIN_POINTS;
    } else {
      rowB.wins++;
      rowA.losses++;
      rowB.points += WIN_POINTS;
    }
  }

  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.diff - x.diff ||
      y.wins - x.wins ||
      x.name.localeCompare(y.name)
  );
}
