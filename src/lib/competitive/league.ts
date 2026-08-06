// Round-robin league: every team plays every other once (single) or twice
// (double, home & away). The table is ranked by match points → difference.
import type { Entrant, StandingRow } from "@/lib/engine";
import type { ScoringMode, TieJSON } from "@/lib/types";
import type { BuiltStructure } from "./types";
import { computeTable } from "./table";
import { entrantSide, makeTie } from "./tie";
import { roundRobinRounds, shuffle } from "./util";

export function buildLeague(entrants: Entrant[], leagueDouble: boolean): BuiltStructure {
  const ids = shuffle(entrants.map((e) => e.id));
  const rounds = roundRobinRounds(ids);
  const ties: TieJSON[] = [];
  let round = 1;
  rounds.forEach((pairs) => {
    pairs.forEach(([a, b], m) => {
      ties.push(makeTie(`lg-r${round}-m${m}`, "league", round, entrantSide(a), entrantSide(b)));
    });
    round++;
  });
  if (leagueDouble) {
    rounds.forEach((pairs) => {
      pairs.forEach(([a, b], m) => {
        // Reverse home/away for the second leg.
        ties.push(makeTie(`lg-r${round}-m${m}`, "league", round, entrantSide(b), entrantSide(a)));
      });
      round++;
    });
  }
  return { groups: [], ties };
}

export function leagueTable(
  entrants: Entrant[],
  ties: TieJSON[],
  scoring: ScoringMode
): StandingRow[] {
  return computeTable(
    entrants,
    ties.filter((t) => t.stage === "league"),
    scoring
  );
}
