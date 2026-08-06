// Final ranking for a competitive tournament — REPLACES computeStandings for
// ranking-point award on these formats. Knockout: champion, runner-up, then
// losers round by round (semis before quarters, …). Groups: bracket order, then
// non-qualifiers by group standing. League: table order.
import type { TieJSON } from "@/lib/types";
import { groupTable } from "./groups";
import { leagueTable } from "./league";
import type { CompTournament } from "./types";

function other(side: "A" | "B"): "A" | "B" {
  return side === "A" ? "B" : "A";
}

function sideEntrant(tie: TieJSON, side: "A" | "B"): string | null | undefined {
  return side === "A" ? tie.sideA.entrantId : tie.sideB.entrantId;
}

function groupNonQualifiers(t: CompTournament, placed: string[]): string[] {
  const rows: { id: string; place: number; points: number; diff: number }[] = [];
  for (const g of t.groups) {
    groupTable(g, t.ties, t.entrants, t.scoring).forEach((row, idx) => {
      if (!placed.includes(row.entrantId)) {
        rows.push({ id: row.entrantId, place: idx + 1, points: row.points, diff: row.diff });
      }
    });
  }
  rows.sort((a, b) => a.place - b.place || b.points - a.points || b.diff - a.diff);
  return rows.map((r) => r.id);
}

export function finalPlacement(t: CompTournament): string[] {
  if (t.type === "league-team") {
    return leagueTable(t.entrants, t.ties, t.scoring).map((r) => r.entrantId);
  }

  const placed: string[] = [];
  const ko = t.ties.filter((x) => x.stage === "knockout" && x.id !== "ko-3rd");
  if (ko.length) {
    const finalRound = Math.max(...ko.map((x) => x.round));
    const finalTie = ko.find((x) => x.round === finalRound)!;
    if (finalTie.winner) {
      const champ = sideEntrant(finalTie, finalTie.winner);
      const runner = sideEntrant(finalTie, other(finalTie.winner));
      if (champ) placed.push(champ);
      if (runner) placed.push(runner);
    }

    const third = t.ties.find((x) => x.id === "ko-3rd");
    if (third && third.winner) {
      const w = sideEntrant(third, third.winner);
      const l = sideEntrant(third, other(third.winner));
      if (w && !placed.includes(w)) placed.push(w);
      if (l && !placed.includes(l)) placed.push(l);
    }

    // Losers of each earlier round: semis, then quarters, … then round 1.
    for (let r = finalRound - 1; r >= 1; r--) {
      for (const tie of ko.filter((x) => x.round === r)) {
        if (!tie.winner) continue;
        const l = sideEntrant(tie, other(tie.winner));
        if (l && !placed.includes(l)) placed.push(l);
      }
    }
    // Play-in losers rank last among knockout participants.
    for (const tie of t.ties.filter((x) => x.stage === "playin")) {
      if (!tie.winner) continue;
      const l = sideEntrant(tie, other(tie.winner));
      if (l && !placed.includes(l)) placed.push(l);
    }
  }

  if (t.type === "groups-team") {
    for (const id of groupNonQualifiers(t, placed)) {
      if (!placed.includes(id)) placed.push(id);
    }
  }

  // Safety: anyone still unplaced (e.g. incomplete tournament) appended.
  for (const e of t.entrants) if (!placed.includes(e.id)) placed.push(e.id);
  return placed;
}
