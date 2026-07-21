import { describe, expect, it } from "vitest";
import { pointsForPosition, RANKING_WINDOW_DAYS } from "../ranking-points";

describe("pointsForPosition", () => {
  it("awards 100 points for 1st place", () => {
    expect(pointsForPosition(1)).toBe(100);
  });

  it("awards 90 points for 2nd place", () => {
    expect(pointsForPosition(2)).toBe(90);
  });

  it("awards 10 points for 10th place", () => {
    expect(pointsForPosition(10)).toBe(10);
  });

  it("decreases by 10 points per position from 1st to 10th", () => {
    for (let pos = 1; pos <= 10; pos++) {
      expect(pointsForPosition(pos)).toBe(110 - pos * 10);
    }
  });

  it("awards 1 participation point for 11th and beyond", () => {
    expect(pointsForPosition(11)).toBe(1);
    expect(pointsForPosition(50)).toBe(1);
    expect(pointsForPosition(1000)).toBe(1);
  });

  it("awards 1 participation point for position 0 or negative (defensive)", () => {
    expect(pointsForPosition(0)).toBe(1);
    expect(pointsForPosition(-1)).toBe(1);
  });
});

describe("RANKING_WINDOW_DAYS", () => {
  it("is one year", () => {
    expect(RANKING_WINDOW_DAYS).toBe(365);
  });
});
