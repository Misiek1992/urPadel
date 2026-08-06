import { describe, expect, it } from "vitest";
import { buildKnockout } from "../knockout";
import { buildGroups, buildGroupsKnockout, seedKnockoutFromGroups } from "../groups";
import { buildLeague } from "../league";
import { teams } from "./helpers";
import type { TieJSON } from "@/lib/types";

function knockoutTies(ties: TieJSON[]) {
  return ties.filter((t) => t.stage === "knockout" && t.id !== "ko-3rd");
}
function round(ties: TieJSON[], r: number) {
  return knockoutTies(ties).filter((t) => t.round === r);
}
function finalRound(ties: TieJSON[]) {
  return Math.max(...knockoutTies(ties).map((t) => t.round));
}

describe("buildKnockout — power of two", () => {
  it("8 teams → 4+2+1 = 7 ties, all entrant-seeded in round 1", () => {
    const { ties } = buildKnockout(teams(8));
    expect(knockoutTies(ties)).toHaveLength(7);
    expect(round(ties, 1)).toHaveLength(4);
    expect(round(ties, 2)).toHaveLength(2);
    expect(round(ties, 3)).toHaveLength(1);
    // round 1 sides are concrete entrants; later rounds are winner-refs
    for (const t of round(ties, 1)) {
      expect(t.sideA.entrantId).toBeTruthy();
      expect(t.sideB.entrantId).toBeTruthy();
    }
    for (const t of round(ties, 2)) {
      expect(t.sideA.source).toMatchObject({ type: "winner" });
      expect(t.sideB.source).toMatchObject({ type: "winner" });
    }
    // every team appears exactly once in round 1
    const ids = round(ties, 1).flatMap((t) => [t.sideA.entrantId, t.sideB.entrantId]);
    expect(new Set(ids).size).toBe(8);
  });

  it("16 teams → 8+4+2+1 = 15 ties", () => {
    const { ties } = buildKnockout(teams(16));
    expect(knockoutTies(ties)).toHaveLength(15);
    expect(round(ties, 1)).toHaveLength(8);
    expect(finalRound(ties)).toBe(4);
  });

  it("final round has exactly one tie", () => {
    const { ties } = buildKnockout(teams(8));
    expect(round(ties, finalRound(ties))).toHaveLength(1);
  });
});

describe("buildKnockout — byes", () => {
  it("5 teams → bracket of 8: 4 round-1 matches, 3 byes pre-decided", () => {
    const { ties } = buildKnockout(teams(5), { byeMode: "bye" });
    expect(round(ties, 1)).toHaveLength(4);
    const byes = round(ties, 1).filter((t) => t.sideB.source && (t.sideB.source as { type: string }).type === "bye");
    expect(byes).toHaveLength(3);
    for (const b of byes) {
      expect(b.winner).toBe("A"); // auto-advanced
      expect(b.sideA.entrantId).toBeTruthy();
    }
    // every real entrant appears once in round 1
    const ids = round(ties, 1).flatMap((t) => [t.sideA.entrantId, t.sideB.entrantId]).filter(Boolean);
    expect(new Set(ids).size).toBe(5);
  });

  it("6 teams → 2 byes; 7 teams → 1 bye", () => {
    const six = buildKnockout(teams(6), { byeMode: "bye" }).ties;
    const seven = buildKnockout(teams(7), { byeMode: "bye" }).ties;
    const byesOf = (ts: TieJSON[]) =>
      round(ts, 1).filter((t) => (t.sideB.source as { type?: string } | undefined)?.type === "bye").length;
    expect(byesOf(six)).toBe(2);
    expect(byesOf(seven)).toBe(1);
    expect(round(six, 1)).toHaveLength(4);
    expect(round(seven, 1)).toHaveLength(4);
  });
});

describe("buildKnockout — play-in", () => {
  it("7 teams → main draw of 4 (3 play-in matches, 1 direct)", () => {
    const { ties } = buildKnockout(teams(7), { byeMode: "playin" });
    const prelim = ties.filter((t) => t.stage === "playin");
    expect(prelim).toHaveLength(3);
    expect(round(ties, 1)).toHaveLength(2); // M/2 = 2
    // each play-in tie has two concrete entrants
    for (const p of prelim) {
      expect(p.sideA.entrantId).toBeTruthy();
      expect(p.sideB.entrantId).toBeTruthy();
    }
    // 14 slots total across prelim(6) + main round1(4 slots, some winner-refs)
    const prelimTeams = prelim.flatMap((t) => [t.sideA.entrantId, t.sideB.entrantId]);
    expect(new Set(prelimTeams).size).toBe(6);
  });

  it("6 teams play-in → main draw of 4 (2 play-in, 2 direct)", () => {
    const { ties } = buildKnockout(teams(6), { byeMode: "playin" });
    expect(ties.filter((t) => t.stage === "playin")).toHaveLength(2);
    expect(round(ties, 1)).toHaveLength(2);
  });
});

describe("buildKnockout — third place", () => {
  it("adds a third-place tie sourced from the two semifinal losers", () => {
    const { ties } = buildKnockout(teams(4), { thirdPlace: true });
    const third = ties.find((t) => t.id === "ko-3rd");
    expect(third).toBeTruthy();
    expect(third!.label).toBe("Third place");
    expect(third!.sideA.source).toMatchObject({ type: "loser" });
    expect(third!.sideB.source).toMatchObject({ type: "loser" });
  });

  it("labels rounds Final / Semi-final / Quarter-final", () => {
    const { ties } = buildKnockout(teams(8));
    const labels = new Set(knockoutTies(ties).map((t) => t.label));
    expect(labels.has("Final")).toBe(true);
    expect(labels.has("Semi-final")).toBe(true);
    expect(labels.has("Quarter-final")).toBe(true);
  });
});

describe("buildGroups", () => {
  it("12 teams / 3 groups → 4 per group, 6 round-robin ties each", () => {
    const { groups, ties } = buildGroups(teams(12), 3);
    expect(groups).toHaveLength(3);
    for (const g of groups) expect(g.entrantIds).toHaveLength(4);
    const groupTies = ties.filter((t) => t.stage === "group");
    expect(groupTies).toHaveLength(18); // 3 * C(4,2)
    // every entrant assigned to exactly one group
    const assigned = groups.flatMap((g) => g.entrantIds);
    expect(new Set(assigned).size).toBe(12);
  });
});

describe("seedKnockoutFromGroups", () => {
  it("2 groups × top 2 → 2 semis + final (all group-sourced)", () => {
    const { groups } = buildGroups(teams(8), 2);
    const ko = seedKnockoutFromGroups(groups, 2, false);
    expect(ko.filter((t) => t.round === 1)).toHaveLength(2);
    expect(finalRound(ko)).toBe(2);
    for (const t of ko.filter((x) => x.round === 1)) {
      expect(t.sideA.source).toMatchObject({ type: "group" });
      expect(t.sideB.source).toMatchObject({ type: "group" });
    }
    // A group winner never faces the runner-up of the SAME group in round 1
    for (const t of ko.filter((x) => x.round === 1)) {
      const sa = t.sideA.source as { group: string; place: number };
      const sb = t.sideB.source as { group: string; place: number };
      expect(sa.group === sb.group).toBe(false);
    }
  });

  it("3 groups × top 2 = 6 qualifiers → bracket of 8 with 2 byes", () => {
    const { groups } = buildGroups(teams(12), 3);
    const ko = seedKnockoutFromGroups(groups, 2, false);
    const r1 = ko.filter((t) => t.round === 1);
    expect(r1).toHaveLength(4); // bracket of 8
    const byes = r1.filter((t) => (t.sideB.source as { type?: string } | undefined)?.type === "bye");
    expect(byes).toHaveLength(2);
    for (const b of byes) expect(b.winner).toBe("A");
  });
});

describe("buildGroupsKnockout", () => {
  it("combines group ties and a seeded bracket", () => {
    const { groups, ties } = buildGroupsKnockout(teams(8), 2, 2, false);
    expect(groups).toHaveLength(2);
    expect(ties.filter((t) => t.stage === "group")).toHaveLength(12); // 2 * C(4,2)
    expect(ties.filter((t) => t.stage === "knockout")).toHaveLength(3); // 2 semis + final
  });
});

describe("buildLeague", () => {
  it("6 teams single round-robin → 15 ties", () => {
    const { ties } = buildLeague(teams(6), false);
    expect(ties.filter((t) => t.stage === "league")).toHaveLength(15);
    // every pair appears exactly once (unordered)
    const pairs = new Set(
      ties.map((t) => [t.sideA.entrantId, t.sideB.entrantId].sort().join("-"))
    );
    expect(pairs.size).toBe(15);
  });

  it("6 teams double round-robin → 30 ties", () => {
    const { ties } = buildLeague(teams(6), true);
    expect(ties.filter((t) => t.stage === "league")).toHaveLength(30);
  });

  it("odd count drops the phantom bye (5 teams → 10 ties)", () => {
    const { ties } = buildLeague(teams(5), false);
    expect(ties).toHaveLength(10); // C(5,2)
    for (const t of ties) {
      expect(t.sideA.entrantId).toBeTruthy();
      expect(t.sideB.entrantId).toBeTruthy();
    }
  });
});
