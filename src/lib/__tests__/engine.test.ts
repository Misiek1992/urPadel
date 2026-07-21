import { describe, expect, it } from "vitest";
import {
  computeStandings,
  generateNextRound,
  makeEntrantId,
  validateTournamentSetup,
  type Entrant,
  type EngineRound,
} from "../engine";

function players(n: number): Entrant[] {
  return Array.from({ length: n }, (_, i) => ({ id: makeEntrantId(), name: `P${i + 1}` }));
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

describe("generateNextRound — americano partner rotation", () => {
  it("achieves a perfect (or near-perfect) whist rotation for 8 players over 7 rounds", () => {
    const ps = players(8);
    const rounds: EngineRound[] = [];
    for (let r = 0; r < 7; r++) {
      const round = generateNextRound({
        type: "americano",
        entrants: ps,
        courts: ["C1", "C2"],
        rounds,
      });
      for (const m of round.matches) {
        m.scoreA = 12;
        m.scoreB = 12;
      }
      rounds.push(round);
    }
    const partnerCounts = new Map<string, number>();
    for (const r of rounds) {
      for (const m of r.matches) {
        partnerCounts.set(
          pairKey(m.sideA[0], m.sideA[1]),
          (partnerCounts.get(pairKey(m.sideA[0], m.sideA[1])) ?? 0) + 1
        );
        partnerCounts.set(
          pairKey(m.sideB[0], m.sideB[1]),
          (partnerCounts.get(pairKey(m.sideB[0], m.sideB[1])) ?? 0) + 1
        );
      }
    }
    // 8 players have C(8,2) = 28 possible partner pairs; 7 rounds × 2 matches
    // × 2 sides = 28 partner-slots, so a perfect rotation hits all 28.
    expect(partnerCounts.size).toBeGreaterThanOrEqual(26);
  });
});

describe("generateNextRound — bye fairness", () => {
  it("spreads rests evenly across 9 rounds for 18 players on 4 courts", () => {
    const ps = players(18);
    const rounds: EngineRound[] = [];
    for (let r = 0; r < 9; r++) {
      const round = generateNextRound({
        type: "americano",
        entrants: ps,
        courts: ["C1", "C2", "C3", "C4"],
        rounds,
      });
      for (const m of round.matches) {
        m.scoreA = 12;
        m.scoreB = 12;
      }
      rounds.push(round);
    }
    const byeCounts = new Map<string, number>();
    for (const r of rounds) for (const id of r.byes) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
    const values = ps.map((p) => byeCounts.get(p.id) ?? 0);
    expect(Math.min(...values)).toBe(1);
    expect(Math.max(...values)).toBe(1);
  });

  it("spreads rests evenly when courts are the limiting factor (12 players, 2 courts)", () => {
    const ps = players(12);
    const rounds: EngineRound[] = [];
    for (let r = 0; r < 3; r++) {
      const round = generateNextRound({
        type: "americano",
        entrants: ps,
        courts: ["C1", "C2"],
        rounds,
      });
      expect(round.matches).toHaveLength(2);
      expect(round.byes).toHaveLength(4);
      for (const m of round.matches) {
        m.scoreA = 10;
        m.scoreB = 14;
      }
      rounds.push(round);
    }
    const byeCounts = new Map<string, number>();
    for (const r of rounds) for (const id of r.byes) byeCounts.set(id, (byeCounts.get(id) ?? 0) + 1);
    expect(Math.max(...ps.map((p) => byeCounts.get(p.id) ?? 0))).toBe(1);
  });
});

describe("generateNextRound — mexicano seeding", () => {
  it("pairs 1st & 2nd vs 3rd & 4th on court 1 after round 1", () => {
    const ps = players(8);
    const rounds: EngineRound[] = [];
    const r1 = generateNextRound({ type: "mexicano", entrants: ps, courts: ["C1", "C2"], rounds });
    let s = 0;
    for (const m of r1.matches) {
      m.scoreA = 21 - s;
      m.scoreB = s;
      s += 3;
    }
    rounds.push(r1);
    const standings = computeStandings(ps, rounds);
    const r2 = generateNextRound({ type: "mexicano", entrants: ps, courts: ["C1", "C2"], rounds });
    const expectC1 = [
      standings[0].entrantId,
      standings[1].entrantId,
      standings[2].entrantId,
      standings[3].entrantId,
    ];
    const gotC1 = [...r2.matches[0].sideA, ...r2.matches[0].sideB];
    expect(gotC1).toEqual(expectC1);
  });
});

describe("generateNextRound — final round seeding", () => {
  it("seeds the final round from standings for individual formats", () => {
    const ps = players(12);
    const rounds: EngineRound[] = [];
    for (let r = 0; r < 3; r++) {
      const round = generateNextRound({
        type: "americano",
        entrants: ps,
        courts: ["C1", "C2", "C3"],
        rounds,
      });
      let x = 1;
      for (const m of round.matches) {
        m.scoreA = 24 - x;
        m.scoreB = x;
        x += 2;
      }
      rounds.push(round);
    }
    const standings = computeStandings(ps, rounds);
    const final = generateNextRound({
      type: "americano",
      entrants: ps,
      courts: ["C1", "C2", "C3"],
      rounds,
      final: true,
    });
    expect(final.isFinal).toBe(true);
    const gotC1 = [...final.matches[0].sideA, ...final.matches[0].sideB];
    expect(gotC1).toEqual(standings.slice(0, 4).map((r) => r.entrantId));
  });

  it("seeds the final round 1v2, 3v4 for team formats", () => {
    const teams: Entrant[] = Array.from({ length: 6 }, (_, i) => ({
      id: makeEntrantId(),
      name: `T${i + 1}`,
      players: [`A${i}`, `B${i}`],
    }));
    const rounds: EngineRound[] = [];
    for (let r = 0; r < 2; r++) {
      const round = generateNextRound({
        type: "mexicano-team",
        entrants: teams,
        courts: ["C1", "C2", "C3"],
        rounds,
      });
      let x = 1;
      for (const m of round.matches) {
        m.scoreA = 32 - x;
        m.scoreB = x;
        x += 3;
      }
      rounds.push(round);
    }
    const standings = computeStandings(teams, rounds);
    const final = generateNextRound({
      type: "mexicano-team",
      entrants: teams,
      courts: ["C1", "C2", "C3"],
      rounds,
      final: true,
    });
    expect(final.matches[0].sideA[0]).toBe(standings[0].entrantId);
    expect(final.matches[0].sideB[0]).toBe(standings[1].entrantId);
    expect(final.matches[1].sideA[0]).toBe(standings[2].entrantId);
    expect(final.matches[1].sideB[0]).toBe(standings[3].entrantId);
  });
});

describe("validateTournamentSetup", () => {
  it("requires at least 4 players for individual formats", () => {
    expect(validateTournamentSetup("americano", 3, 1)).toMatch(/at least 4/i);
    expect(validateTournamentSetup("americano", 4, 1)).toBeNull();
  });

  it("requires at least 2 teams for team formats", () => {
    expect(validateTournamentSetup("americano-team", 1, 1)).toMatch(/at least 2 teams/i);
    expect(validateTournamentSetup("americano-team", 2, 1)).toBeNull();
  });

  it("requires at least one court", () => {
    expect(validateTournamentSetup("americano", 8, 0)).toMatch(/court/i);
  });
});
