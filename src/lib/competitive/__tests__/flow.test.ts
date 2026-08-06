import { describe, expect, it } from "vitest";
import type { ScoringMode } from "@/lib/types";
import { buildKnockout } from "../knockout";
import { buildGroupsKnockout } from "../groups";
import { buildLeague } from "../league";
import {
  buildInitialStructure,
  finalPlacement,
  isComplete,
  isPlayable,
  leagueTable,
  resolveTies,
} from "../index";
import type { CompTournament } from "../types";
import { aWins, playThrough, teams, tieById } from "./helpers";

function comp(partial: Partial<CompTournament> & Pick<CompTournament, "type" | "ties">): CompTournament {
  return {
    scoring: "points",
    config: {},
    entrants: [],
    groups: [],
    ...partial,
  };
}

describe("resolveTies — winner advancement", () => {
  it("propagates a round-1 winner into the round-2 slot", () => {
    const es = teams(4);
    const { ties } = buildKnockout(es); // 2 round-1 + 1 final
    const t = comp({ type: "knockout-team", entrants: es, ties });
    const r1 = ties.filter((x) => x.round === 1);
    // Score both round-1 ties: side A wins each
    r1[0].score = aWins("points");
    r1[1].score = aWins("points");
    const resolved = resolveTies({ ...t, ties });
    const final = resolved.find((x) => x.round === 2)!;
    expect(final.sideA.entrantId).toBe(r1[0].sideA.entrantId);
    expect(final.sideB.entrantId).toBe(r1[1].sideA.entrantId);
  });

  it("byes auto-advance on build (buildInitialStructure resolves them)", () => {
    const es = teams(5);
    const { ties } = buildInitialStructure("knockout-team", { byeMode: "bye" }, es, ["C1"], "points");
    // The 3 bye winners should already populate round-2 slots
    const r2 = ties.filter((x) => x.stage === "knockout" && x.round === 2);
    const resolvedSlots = r2.flatMap((t) => [t.sideA.entrantId, t.sideB.entrantId]).filter(Boolean);
    expect(resolvedSlots.length).toBeGreaterThanOrEqual(3);
  });
});

describe("full knockout playthrough", () => {
  for (const scoring of ["points", "sets"] as ScoringMode[]) {
    it(`8-team bracket completes and ranks a single champion (${scoring})`, () => {
      const es = teams(8);
      const { ties } = buildInitialStructure("knockout-team", { byeMode: "bye", thirdPlace: true }, es, ["C1", "C2"], scoring);
      const played = playThrough({ type: "knockout-team", scoring, config: {}, entrants: es, groups: [], ties });
      expect(isComplete(played)).toBe(true);
      const placement = finalPlacement(played);
      expect(placement).toHaveLength(8);
      expect(new Set(placement).size).toBe(8);
      // champion = winner of the final tie
      const ko = played.ties.filter((x) => x.stage === "knockout" && x.id !== "ko-3rd");
      const final = ko.find((x) => x.round === Math.max(...ko.map((k) => k.round)))!;
      const champ = final.winner === "A" ? final.sideA.entrantId : final.sideB.entrantId;
      expect(placement[0]).toBe(champ);
    });
  }

  it("play-in bracket (7 teams) completes", () => {
    const es = teams(7);
    const { ties } = buildInitialStructure("knockout-team", { byeMode: "playin" }, es, ["C1"], "points");
    const played = playThrough({ type: "knockout-team", scoring: "points", config: {}, entrants: es, groups: [], ties });
    expect(isComplete(played)).toBe(true);
    expect(finalPlacement(played)).toHaveLength(7);
  });
});

describe("groups → knockout playthrough", () => {
  it("seeds the knockout only after the group stage completes", () => {
    const es = teams(8);
    const { groups, ties } = buildGroupsKnockout(es, 2, 2, false);
    const t = comp({ type: "groups-team", entrants: es, groups, ties });

    // Before any group result, knockout round-1 slots are unresolved.
    const koR1Before = ties.filter((x) => x.stage === "knockout" && x.round === 1);
    expect(koR1Before.every((x) => !x.sideA.entrantId && !x.sideB.entrantId)).toBe(true);

    const played = playThrough(t);
    expect(isComplete(played)).toBe(true);
    // Knockout round-1 slots are now real entrants, drawn from group qualifiers.
    const koR1After = played.ties.filter((x) => x.stage === "knockout" && x.round === 1);
    for (const tie of koR1After) {
      expect(tie.sideA.entrantId).toBeTruthy();
      expect(tie.sideB.entrantId).toBeTruthy();
    }
    expect(finalPlacement(played)).toHaveLength(8);
  });

  it("12 teams / 3 groups completes with byes in the bracket", () => {
    const es = teams(12);
    const { groups, ties } = buildGroupsKnockout(es, 3, 2, false);
    const played = playThrough(comp({ type: "groups-team", entrants: es, groups, ties }));
    expect(isComplete(played)).toBe(true);
    expect(finalPlacement(played)).toHaveLength(12);
  });
});

describe("league playthrough", () => {
  it("6-team single league completes and the table orders all teams", () => {
    const es = teams(6);
    const { ties } = buildLeague(es, false);
    const t = comp({ type: "league-team", entrants: es, ties });
    const played = playThrough(t);
    expect(isComplete(played)).toBe(true);
    const table = leagueTable(es, played.ties, "points");
    expect(table).toHaveLength(6);
    // table is sorted by points descending
    for (let i = 1; i < table.length; i++) {
      expect(table[i - 1].points).toBeGreaterThanOrEqual(table[i].points);
    }
    expect(finalPlacement(played)).toEqual(table.map((r) => r.entrantId));
  });

  it("double league has each team play twice as many games", () => {
    const es = teams(4);
    const single = playThrough(comp({ type: "league-team", entrants: es, ties: buildLeague(es, false).ties }));
    const dbl = playThrough(comp({ type: "league-team", entrants: es, ties: buildLeague(es, true).ties }));
    expect(leagueTable(es, single.ties, "points")[0].played).toBe(3);
    expect(leagueTable(es, dbl.ties, "points")[0].played).toBe(6);
  });
});

describe("idempotency + court assignment", () => {
  it("resolveTies is idempotent", () => {
    const es = teams(8);
    const { ties } = buildInitialStructure("knockout-team", { byeMode: "bye" }, es, ["C1"], "points");
    const once = resolveTies(comp({ type: "knockout-team", entrants: es, ties }));
    const twice = resolveTies(comp({ type: "knockout-team", entrants: es, ties: once }));
    expect(twice).toEqual(once);
  });

  it("assigns courts to initially-playable ties", () => {
    const es = teams(8);
    const { ties } = buildInitialStructure("knockout-team", {}, es, ["Court 1", "Court 2"], "points");
    const r1 = ties.filter((x) => x.round === 1 && isPlayable(x, "points"));
    expect(r1.every((t) => t.court)).toBe(true);
    const used = new Set(r1.map((t) => t.court));
    expect(used.size).toBeGreaterThan(0);
  });
});

describe("isComplete gating", () => {
  it("false until the final is decided", () => {
    const es = teams(4);
    const { ties } = buildInitialStructure("knockout-team", {}, es, ["C1"], "points");
    const t = comp({ type: "knockout-team", entrants: es, ties });
    expect(isComplete(t)).toBe(false);
    const finalTie = tieById(ties, "ko-r2-m0");
    expect(finalTie).toBeTruthy();
  });
});
