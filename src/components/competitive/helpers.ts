// Server-safe display helpers for competitive formats (bracket/group/league).
import type { EntrantJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { Translator } from "@/lib/i18n";

export function tiesById(ties: TieJSON[]): Record<string, TieJSON> {
  const map: Record<string, TieJSON> = {};
  for (const tie of ties) map[tie.id] = tie;
  return map;
}

/** A short label for a feeding tie, used inside "Winner of …". */
function feederLabel(tie: TieJSON | undefined, t: Translator): string {
  return tie?.label ?? t("competitive.tbd");
}

/** Human label for one side of a tie: resolved name, or its pending source. */
export function sideLabel(
  side: TieJSON["sideA"],
  byId: Record<string, TieJSON>,
  map: Record<string, EntrantJSON>,
  t: Translator
): string {
  if (side.entrantId) return map[side.entrantId]?.name ?? side.entrantId;
  const src = side.source;
  if (!src) return t("competitive.tbd");
  if (src.type === "bye") return t("competitive.bye");
  if (src.type === "winner")
    return t("competitive.winnerOf", { label: feederLabel(byId[src.tieId], t) });
  if (src.type === "loser")
    return t("competitive.loserOf", { label: feederLabel(byId[src.tieId], t) });
  if (src.type === "group")
    return t("competitive.groupPlaceShort", { place: src.place, group: src.group });
  return t("competitive.tbd");
}

/** True if a side is a bye placeholder (no opponent). */
export function isByeSide(side: TieJSON["sideA"]): boolean {
  return !side.entrantId && side.source?.type === "bye";
}

/** The rendered score of a tie, or null if unscored. */
export function scoreText(tie: TieJSON, scoring: ScoringMode): string | null {
  if (scoring === "sets") {
    const sets = tie.score.sets;
    if (!sets || sets.length === 0) return null;
    return sets.map((s) => `${s.a}-${s.b}`).join("  ");
  }
  if (tie.score.a == null || tie.score.b == null) return null;
  return `${tie.score.a} : ${tie.score.b}`;
}

export type TieState = "decided" | "playable" | "pending";

export function tieState(tie: TieJSON, scoring: ScoringMode): TieState {
  if (tie.winner != null) return "decided";
  const bothResolved = !!tie.sideA.entrantId && !!tie.sideB.entrantId;
  if (bothResolved) return "playable";
  return "pending";
}
