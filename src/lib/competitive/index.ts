// Public surface of the competitive engine. buildInitialStructure creates a
// tournament's ties at creation (auto-resolving byes and assigning courts);
// resolveTies advances it after each score; finalPlacement ranks it at close.
import { isCompetitiveType, type Entrant, type TournamentType } from "@/lib/engine";
import type {
  CompetitiveConfigJSON,
  ScoringMode,
  TieJSON,
  TournamentJSON,
} from "@/lib/types";
import { buildKnockout } from "./knockout";
import { buildGroupsKnockout } from "./groups";
import { buildLeague } from "./league";
import { resolveTies } from "./resolve";
import { scoreEntered } from "./scoring";
import { isPow2 } from "./util";
import type { BuiltStructure, CompTournament } from "./types";

export { resolveTies } from "./resolve";
export { finalPlacement } from "./placement";
export { validateScore, winnerOf, scoreEntered } from "./scoring";
export { groupTable } from "./groups";
export { leagueTable } from "./league";
export { computeTable } from "./table";
export type { CompTournament, BuiltStructure } from "./types";

/**
 * Re-resolve advancement + court assignment on a serialized tournament read
 * from the DB. No-op for non-competitive types. Every read path should call
 * this so the bracket/table always reflects the latest scores, self-healing
 * any transient persistence gaps.
 */
export function hydrateCompetitive(tournament: TournamentJSON): TournamentJSON {
  if (!isCompetitiveType(tournament.type)) return tournament;
  const comp: CompTournament = {
    type: tournament.type,
    scoring: (tournament.scoring ?? "points") as ScoringMode,
    config: tournament.config ?? {},
    entrants: tournament.entrants,
    groups: tournament.groups ?? [],
    ties: tournament.ties ?? [],
  };
  return { ...tournament, ties: assignCourts(resolveTies(comp), tournament.courts, comp.scoring) };
}

/** A tie can be played when both sides are known, it's unscored and undecided. */
export function isPlayable(tie: TieJSON, scoring: ScoringMode): boolean {
  return (
    !!tie.sideA.entrantId &&
    !!tie.sideB.entrantId &&
    tie.winner == null &&
    !scoreEntered(tie.score, scoring)
  );
}

/** Assign courts (stably) to playable ties that don't have one yet. */
export function assignCourts(ties: TieJSON[], courts: string[], scoring: ScoringMode): TieJSON[] {
  if (courts.length === 0) return ties;
  const out: TieJSON[] = JSON.parse(JSON.stringify(ties));
  let cursor = 0;
  for (const tie of out) {
    if (tie.court || !isPlayable(tie, scoring)) continue;
    tie.court = courts[cursor % courts.length];
    cursor++;
  }
  return out;
}

/** Build the initial ties for a competitive format, resolving byes + courts. */
export function buildInitialStructure(
  type: TournamentType,
  config: CompetitiveConfigJSON,
  entrants: Entrant[],
  courts: string[],
  scoring: ScoringMode
): BuiltStructure {
  let built: BuiltStructure;
  switch (type) {
    case "knockout-team":
      built = buildKnockout(entrants, {
        byeMode: config.byeMode ?? "bye",
        thirdPlace: !!config.thirdPlace,
      });
      break;
    case "groups-team":
      built = buildGroupsKnockout(
        entrants,
        config.groupCount ?? 2,
        config.advancePerGroup ?? 2,
        !!config.thirdPlace
      );
      break;
    case "league-team":
      built = buildLeague(entrants, !!config.leagueDouble);
      break;
    default:
      built = { groups: [], ties: [] };
  }
  const resolved = resolveTies({
    type,
    scoring,
    config,
    entrants,
    groups: built.groups,
    ties: built.ties,
  });
  return { groups: built.groups, ties: assignCourts(resolved, courts, scoring) };
}

/** True once the tournament's decisive tie(s) are settled. */
export function isComplete(t: CompTournament): boolean {
  if (t.type === "league-team") {
    const league = t.ties.filter((x) => x.stage === "league");
    return league.length > 0 && league.every((x) => x.winner != null);
  }
  const ko = t.ties.filter((x) => x.stage === "knockout" && x.id !== "ko-3rd");
  if (ko.length === 0) return false;
  const finalRound = Math.max(...ko.map((x) => x.round));
  const finalTie = ko.find((x) => x.round === finalRound)!;
  const third = t.ties.find((x) => x.id === "ko-3rd");
  const thirdDone = !third || third.winner != null;
  return finalTie.winner != null && thirdDone;
}

export type CompetitiveValidation = { ok: true } | { ok: false; error: string };

/** Validate scoring + config for a competitive format at creation time. */
export function validateCompetitiveSetup(
  type: TournamentType,
  scoring: ScoringMode,
  config: CompetitiveConfigJSON,
  teamCount: number
): CompetitiveValidation {
  if (scoring !== "points" && scoring !== "sets") {
    return { ok: false, error: "Choose a scoring mode." };
  }
  if (scoring === "sets") {
    const best = config.bestOfSets ?? 3;
    if (![1, 3, 5].includes(best)) return { ok: false, error: "Best-of must be 1, 3 or 5 sets." };
  }
  if (teamCount < 2) return { ok: false, error: "Need at least 2 teams." };

  if (type === "knockout-team") {
    if (config.byeMode && config.byeMode !== "bye" && config.byeMode !== "playin") {
      return { ok: false, error: "Invalid first-round handling." };
    }
    return { ok: true };
  }
  if (type === "league-team") {
    if (teamCount < 2) return { ok: false, error: "A league needs at least 2 teams." };
    return { ok: true };
  }
  if (type === "groups-team") {
    const groupCount = config.groupCount ?? 0;
    const advance = config.advancePerGroup ?? 0;
    if (groupCount < 2) return { ok: false, error: "Need at least 2 groups." };
    if (advance !== 1 && advance !== 2) {
      return { ok: false, error: "Advance 1 or 2 teams per group." };
    }
    if (teamCount < groupCount * 2) {
      return { ok: false, error: "Each group needs at least 2 teams." };
    }
    if (advance > 1 && teamCount < groupCount * advance) {
      return { ok: false, error: "Not enough teams to advance that many per group." };
    }
    const qualifiers = groupCount * advance;
    if (qualifiers < 2) return { ok: false, error: "Need at least 2 qualifiers." };
    // Bracket allows byes, so any qualifier count >= 2 works; warn only would be
    // possible — power-of-two is preferred but not required.
    void isPow2;
    return { ok: true };
  }
  return { ok: false, error: "Unknown competitive format." };
}
