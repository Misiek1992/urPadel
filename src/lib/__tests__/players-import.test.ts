import { describe, expect, it } from "vitest";
import { parsePlayersText } from "../players-import";

describe("parsePlayersText", () => {
  it("parses one name per line", () => {
    expect(parsePlayersText("Adam Kowalski\nMaria Nowak\n")).toEqual([
      "Adam Kowalski",
      "Maria Nowak",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parsePlayersText("")).toEqual([]);
    expect(parsePlayersText("   \n\n  ")).toEqual([]);
  });

  it("detects a header row and extracts the name column (comma CSV)", () => {
    const csv = "Name,Email\nAdam Kowalski,adam@example.com\nMaria Nowak,maria@example.com";
    expect(parsePlayersText(csv)).toEqual(["Adam Kowalski", "Maria Nowak"]);
  });

  it("handles semicolon-delimited CSV", () => {
    const csv = "Player;Phone\nAdam Kowalski;123\nMaria Nowak;456";
    expect(parsePlayersText(csv)).toEqual(["Adam Kowalski", "Maria Nowak"]);
  });

  it("handles tab-delimited exports", () => {
    const tsv = "Full Name\tClub\nAdam Kowalski\tPadel Arena\nMaria Nowak\tPadel Arena";
    expect(parsePlayersText(tsv)).toEqual(["Adam Kowalski", "Maria Nowak"]);
  });

  it("recognizes Polish header variants", () => {
    const csv = "Imię i nazwisko\nAdam Kowalski\nMaria Nowak";
    expect(parsePlayersText(csv)).toEqual(["Adam Kowalski", "Maria Nowak"]);
  });

  it("treats a single-column list with no recognizable header as data (no header row dropped)", () => {
    expect(parsePlayersText("Adam Kowalski\nMaria Nowak")).toEqual([
      "Adam Kowalski",
      "Maria Nowak",
    ]);
  });

  it("dedupes case-insensitively, keeping the first occurrence", () => {
    expect(parsePlayersText("Adam Kowalski\nadam kowalski\nADAM KOWALSKI")).toEqual([
      "Adam Kowalski",
    ]);
  });

  it("skips bare email and numeric-only cells", () => {
    const csv = "Name\nadam@example.com\n42\nMaria Nowak";
    expect(parsePlayersText(csv)).toEqual(["Maria Nowak"]);
  });

  it("strips a UTF-8 BOM from the start of the file", () => {
    expect(parsePlayersText("﻿Adam Kowalski\nMaria Nowak")).toEqual([
      "Adam Kowalski",
      "Maria Nowak",
    ]);
  });

  it("trims quoted CSV cells", () => {
    const csv = 'Name,Note\n"Adam Kowalski","Ranked #1"\n"Maria Nowak","Ranked #2"';
    expect(parsePlayersText(csv)).toEqual(["Adam Kowalski", "Maria Nowak"]);
  });
});
