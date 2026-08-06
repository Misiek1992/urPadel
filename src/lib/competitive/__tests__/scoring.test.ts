import { describe, expect, it } from "vitest";
import { scoreEntered, setsWon, sideTotals, validateScore, winnerOf } from "../scoring";
import { computeTable } from "../table";
import { teams } from "./helpers";
import type { TieJSON } from "@/lib/types";

describe("winnerOf — points mode", () => {
  it("higher score wins", () => {
    expect(winnerOf({ a: 21, b: 17 }, "points")).toBe("A");
    expect(winnerOf({ a: 12, b: 21 }, "points")).toBe("B");
  });
  it("equal or unentered is null", () => {
    expect(winnerOf({ a: 21, b: 21 }, "points")).toBeNull();
    expect(winnerOf({ a: null, b: null }, "points")).toBeNull();
    expect(winnerOf({ a: 5 }, "points")).toBeNull();
  });
});

describe("winnerOf — sets mode", () => {
  it("counts sets won", () => {
    expect(winnerOf({ sets: [{ a: 6, b: 4 }, { a: 6, b: 3 }] }, "sets")).toBe("A");
    expect(winnerOf({ sets: [{ a: 4, b: 6 }, { a: 6, b: 3 }, { a: 5, b: 7 }] }, "sets")).toBe("B");
  });
  it("level sets → null", () => {
    expect(winnerOf({ sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }] }, "sets")).toBeNull();
    expect(setsWon({ sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }] })).toEqual({ a: 1, b: 1 });
  });
});

describe("validateScore", () => {
  it("points: rejects draws and negatives, accepts a winner", () => {
    expect(validateScore({ a: 21, b: 10 }, "points").ok).toBe(true);
    expect(validateScore({ a: 21, b: 21 }, "points").ok).toBe(false);
    expect(validateScore({ a: -1, b: 3 }, "points").ok).toBe(false);
    expect(validateScore({ a: 2.5, b: 3 }, "points").ok).toBe(false);
  });
  it("sets: requires a decided match within best-of", () => {
    expect(validateScore({ sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }] }, "sets", { bestOfSets: 3 }).ok).toBe(true);
    expect(validateScore({ sets: [] }, "sets").ok).toBe(false);
    expect(validateScore({ sets: [{ a: 6, b: 6 }] }, "sets").ok).toBe(false); // level set
    expect(validateScore({ sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }] }, "sets").ok).toBe(false); // 1-1 no winner
    expect(
      validateScore({ sets: [{ a: 6, b: 0 }, { a: 6, b: 0 }, { a: 6, b: 0 }, { a: 6, b: 0 }] }, "sets", {
        bestOfSets: 3,
      }).ok
    ).toBe(false); // too many sets
  });
});

describe("sideTotals", () => {
  it("points mode maps raw points", () => {
    expect(sideTotals({ a: 21, b: 10 }, "points").a).toMatchObject({ pointsFor: 21, pointsAgainst: 10 });
  });
  it("sets mode sums games and sets", () => {
    const t = sideTotals({ sets: [{ a: 6, b: 4 }, { a: 5, b: 7 }, { a: 6, b: 2 }] }, "sets");
    expect(t.a).toMatchObject({ pointsFor: 17, pointsAgainst: 13, setsFor: 2, setsAgainst: 1 });
  });
});

describe("computeTable ordering", () => {
  it("ranks by points then difference (points mode)", () => {
    const es = teams(3); // t1 t2 t3
    const ties: TieJSON[] = [
      mkTie("m1", "t1", "t2", { a: 21, b: 10 }), // t1 beats t2
      mkTie("m2", "t1", "t3", { a: 21, b: 19 }), // t1 beats t3
      mkTie("m3", "t2", "t3", { a: 21, b: 5 }), // t2 beats t3
    ];
    const table = computeTable(es, ties, "points");
    expect(table.map((r) => r.entrantId)).toEqual(["t1", "t2", "t3"]);
    expect(table[0]).toMatchObject({ wins: 2, points: 6 });
    // t2: 1 win (+11 vs t3, -11 vs t1) => diff 0; t3: 0 wins
    expect(table[1].entrantId).toBe("t2");
  });

  it("ignores unscored ties", () => {
    const es = teams(2);
    const table = computeTable(es, [mkTie("m", "t1", "t2", {})], "points");
    expect(table.every((r) => r.played === 0)).toBe(true);
  });
});

function mkTie(id: string, a: string, b: string, score: TieJSON["score"]): TieJSON {
  return {
    id,
    stage: "league",
    group: null,
    round: 1,
    label: null,
    court: null,
    sideA: { entrantId: a },
    sideB: { entrantId: b },
    score,
    winner: null,
  };
}

describe("scoreEntered", () => {
  it("true only when a usable result exists", () => {
    expect(scoreEntered({ a: 1, b: 2 }, "points")).toBe(true);
    expect(scoreEntered({ a: 1 }, "points")).toBe(false);
    expect(scoreEntered({ sets: [{ a: 6, b: 4 }] }, "sets")).toBe(true);
    expect(scoreEntered({ sets: [] }, "sets")).toBe(false);
  });
});
