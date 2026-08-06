// Shared helpers for the competitive engine (knockout / groups / league).
// Pure functions, mirroring engine.ts's style — no I/O, no Mongoose.
import type { Entrant } from "@/lib/engine";

/** Smallest power of two >= n (>=1). */
export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Largest power of two <= n (>=1). */
export function largestPow2LE(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

export function isPow2(n: number): boolean {
  return n >= 1 && (n & (n - 1)) === 0;
}

/** Fisher–Yates shuffle returning a NEW array (does not mutate input). */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Human label for a knockout round given how many matches it contains.
 * 1 match → Final, 2 → Semi-final, 4 → Quarter-final, 8 → Round of 16, …
 */
export function knockoutRoundLabel(matchesInRound: number): string {
  if (matchesInRound <= 1) return "Final";
  if (matchesInRound === 2) return "Semi-final";
  if (matchesInRound === 4) return "Quarter-final";
  return `Round of ${matchesInRound * 2}`;
}

/**
 * Standard single-elimination seed order for a bracket of `size` (a power of
 * two): returns the seed number (1-indexed) occupying each slot, so that
 * consecutive slot pairs (0,1),(2,3),… are the first-round matches and the top
 * two seeds can only meet in the final. e.g. size 4 → [1,4,2,3];
 * size 8 → [1,8,4,5,2,7,3,6].
 */
export function standardSeedOrder(size: number): number[] {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

/** Map of entrant id → display name, for table/label building. */
export function nameMap(entrants: Entrant[]): Map<string, string> {
  return new Map(entrants.map((e) => [e.id, e.name]));
}

/**
 * Round-robin fixture generation via the circle method. Returns an array of
 * rounds, each a list of [homeIndex, awayIndex] pairs into `ids`. A phantom
 * "bye" is added for odd counts (pairs containing it are dropped).
 */
export function roundRobinRounds(ids: string[]): [string, string][][] {
  const list = ids.slice();
  const bye = list.length % 2 === 1;
  if (bye) list.push("__BYE__");
  const n = list.length;
  const rounds: [string, string][][] = [];
  const arr = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate all but the first element
    arr.splice(1, 0, arr.pop() as string);
  }
  return rounds;
}
