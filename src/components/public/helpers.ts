// Server-safe display helpers shared by the public pages.

import type { EntrantJSON, MatchJSON, TournamentJSON } from "@/lib/types";

export function entrantMap(
  entrants: EntrantJSON[]
): Record<string, EntrantJSON> {
  const map: Record<string, EntrantJSON> = {};
  for (const e of entrants) map[e.id] = e;
  return map;
}

/** Display names for one side of a match (individual: 2 players; team: pair). */
export function sideNames(
  ids: string[],
  map: Record<string, EntrantJSON>
): string[] {
  const names: string[] = [];
  for (const id of ids) {
    const entrant = map[id];
    if (!entrant) continue;
    if (entrant.players && entrant.players.length > 0) {
      names.push(...entrant.players);
    } else {
      names.push(entrant.name);
    }
  }
  return names;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function currentRound(tournament: TournamentJSON) {
  return tournament.rounds[tournament.rounds.length - 1] ?? null;
}

export function matchComplete(match: MatchJSON): boolean {
  return match.scoreA != null && match.scoreB != null;
}
