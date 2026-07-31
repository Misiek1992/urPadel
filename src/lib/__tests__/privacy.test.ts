import { describe, expect, it } from "vitest";
import {
  sanitizeEntrantsForPublic,
  sanitizeRankingForPublic,
  sanitizeStandingsForPublic,
  truncatePublicName,
  truncateSurname,
} from "../privacy";

describe("truncateSurname", () => {
  it("truncates a two-part name to first name + surname initial", () => {
    expect(truncateSurname("Anna Kowalska")).toBe("Anna K.");
  });

  it("leaves a single-word name untouched", () => {
    expect(truncateSurname("Cher")).toBe("Cher");
  });

  it("keeps multi-word first names intact, truncating only the last word", () => {
    expect(truncateSurname("Anna Maria Kowalska")).toBe("Anna Maria K.");
  });

  it("handles accented surnames", () => {
    expect(truncateSurname("Jakub Wiśniewski")).toBe("Jakub W.");
  });

  it("collapses extra whitespace", () => {
    expect(truncateSurname("  Anna   Kowalska  ")).toBe("Anna K.");
  });
});

describe("truncatePublicName", () => {
  it("truncates each side of a default team name", () => {
    expect(truncatePublicName("Anna Kowalska / Piotr Nowak")).toBe("Anna K. / Piotr N.");
  });

  it("truncates a plain individual name the same as truncateSurname", () => {
    expect(truncatePublicName("Anna Kowalska")).toBe("Anna K.");
  });
});

describe("sanitizeEntrantsForPublic", () => {
  it("truncates both name and players[] for a team entrant", () => {
    const [sanitized] = sanitizeEntrantsForPublic([
      { id: "e1", name: "Anna Kowalska / Piotr Nowak", players: ["Anna Kowalska", "Piotr Nowak"] },
    ]);
    expect(sanitized.name).toBe("Anna K. / Piotr N.");
    expect(sanitized.players).toEqual(["Anna K.", "Piotr N."]);
  });

  it("truncates name for an individual entrant with no players", () => {
    const [sanitized] = sanitizeEntrantsForPublic([{ id: "e1", name: "Anna Kowalska" }]);
    expect(sanitized.name).toBe("Anna K.");
    expect(sanitized.players).toBeUndefined();
  });

  it("does not mutate the original array", () => {
    const original = [{ id: "e1", name: "Anna Kowalska" }];
    sanitizeEntrantsForPublic(original);
    expect(original[0].name).toBe("Anna Kowalska");
  });
});

describe("sanitizeStandingsForPublic", () => {
  it("truncates name and players on a standings row", () => {
    const [row] = sanitizeStandingsForPublic([
      {
        entrantId: "e1",
        name: "Anna Kowalska",
        points: 10,
        played: 1,
        wins: 1,
        draws: 0,
        losses: 0,
        diff: 5,
      },
    ]);
    expect(row.name).toBe("Anna K.");
  });
});

describe("sanitizeRankingForPublic", () => {
  it("truncates playerName on ranking rows", () => {
    const [row] = sanitizeRankingForPublic([
      {
        position: 1,
        playerName: "Anna Kowalska",
        total: 100,
        tournamentsPlayed: 5,
        entries: [],
      },
    ]);
    expect(row.playerName).toBe("Anna K.");
  });
});
