// Group stage → knockout. Teams are drawn into groups (round-robin each), then
// the top `advancePerGroup` from every group advance to a knockout seeded by
// group placement: group winners are spread across the bracket and can only
// meet a runner-up from their own group in the final. Non-power-of-two
// qualifier counts (e.g. 3 groups × top 2 = 6) resolve with byes for the top
// seeds.
import type { Entrant, StandingRow } from "@/lib/engine";
import type { GroupJSON, ScoringMode, TieJSON } from "@/lib/types";
import type { BuiltStructure } from "./types";
import { computeTable } from "./table";
import { linkUpperRounds } from "./knockout";
import { byeSide, entrantSide, groupSide, makeTie } from "./tie";
import { nextPow2, roundRobinRounds, shuffle, standardSeedOrder } from "./util";

export function groupLabel(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, …
}

/** Draw entrants into `groupCount` groups and build each group's round-robin. */
export function buildGroups(entrants: Entrant[], groupCount: number): BuiltStructure {
  const ids = shuffle(entrants.map((e) => e.id));
  const groups: GroupJSON[] = [];
  for (let g = 0; g < groupCount; g++) groups.push({ label: groupLabel(g), entrantIds: [] });
  ids.forEach((id, i) => groups[i % groupCount].entrantIds.push(id));

  const ties: TieJSON[] = [];
  for (const grp of groups) {
    roundRobinRounds(grp.entrantIds).forEach((pairs, r) => {
      pairs.forEach(([a, b], m) => {
        ties.push(
          makeTie(`grp-${grp.label}-r${r}-m${m}`, "group", r + 1, entrantSide(a), entrantSide(b), {
            label: `Group ${grp.label}`,
            group: grp.label,
          })
        );
      });
    });
  }
  return { groups, ties };
}

/** The table for one group, from its scored ties. */
export function groupTable(
  group: GroupJSON,
  ties: TieJSON[],
  entrants: Entrant[],
  scoring: ScoringMode
): StandingRow[] {
  const members = entrants.filter((e) => group.entrantIds.includes(e.id));
  const groupTies = ties.filter((t) => t.stage === "group" && t.group === group.label);
  return computeTable(members, groupTies, scoring);
}

/**
 * Build the knockout ties fed by group placement. Round-1 sides are
 * `group`-source references (e.g. "1st of Group A"); resolveTies fills them
 * once the groups finish. Supports advancePerGroup 1 or 2; byes cover any
 * shortfall to the next power of two.
 */
export function seedKnockoutFromGroups(
  groups: GroupJSON[],
  advancePerGroup: number,
  thirdPlace: boolean
): TieJSON[] {
  const G = groups.length;
  const Q = G * advancePerGroup;
  // seed number (1-indexed) → { group, place }: group winners are the top
  // seeds (group order), runners-up next (group order too).
  const seedRef = new Map<number, { group: string; place: number }>();
  for (let g = 0; g < G; g++) seedRef.set(g + 1, { group: groups[g].label, place: 1 });
  if (advancePerGroup >= 2) {
    for (let g = 0; g < G; g++) seedRef.set(G + 1 + g, { group: groups[g].label, place: 2 });
  }

  const bracketSize = nextPow2(Q);
  const order = standardSeedOrder(bracketSize); // seeds in slot order
  const ties: TieJSON[] = [];
  const round1Ids: string[] = [];
  for (let i = 0; i < order.length; i += 2) {
    const s1 = order[i];
    const s2 = order[i + 1];
    const ref1 = s1 <= Q ? seedRef.get(s1)! : null; // > Q ⇒ bye slot
    const ref2 = s2 <= Q ? seedRef.get(s2)! : null;
    const id = `ko-r1-m${i / 2}`;
    let tie: TieJSON;
    if (ref1 && ref2) {
      tie = makeTie(id, "knockout", 1, groupSide(ref1.group, ref1.place), groupSide(ref2.group, ref2.place));
    } else {
      // Exactly one real qualifier (Q > bracketSize/2 ⇒ never two byes): it
      // advances automatically. Put the real side on A.
      const real = (ref1 ?? ref2)!;
      tie = makeTie(id, "knockout", 1, groupSide(real.group, real.place), byeSide());
      tie.winner = "A";
    }
    ties.push(tie);
    round1Ids.push(id);
  }
  repairSameGroupRound1(ties);
  linkUpperRounds(round1Ids, ties, 1, thirdPlace);
  return ties;
}

function groupOfSide(side: TieJSON["sideA"]): string | null {
  const src = side.source;
  return src && src.type === "group" ? src.group : null;
}

/**
 * Eliminate any round-1 tie whose two sides come from the SAME group, by
 * swapping one side with a compatible side from another round-1 tie. Byes
 * (no group) never conflict. Standard seeding avoids this for even group
 * counts; the swap handles odd counts (e.g. the middle group with 3 groups).
 */
function repairSameGroupRound1(ties: TieJSON[]): void {
  // Only fully group-sourced ties are eligible — never touch a bye (its preset
  // winner would become a phantom result, or its bye slot would dangle).
  const r1 = ties.filter(
    (t) =>
      t.round === 1 &&
      t.stage === "knockout" &&
      groupOfSide(t.sideA) !== null &&
      groupOfSide(t.sideB) !== null
  );
  for (const c of r1) {
    const ga = groupOfSide(c.sideA);
    const gb = groupOfSide(c.sideB);
    if (!ga || ga !== gb) continue; // no conflict
    const partner = r1.find((p) => {
      if (p === c) return false;
      const pb = groupOfSide(p.sideB);
      const pa = groupOfSide(p.sideA);
      // After swapping B-sides: c=(c.A,p.B), p=(p.A,c.B). Neither may be same-group.
      return ga !== pb && pa !== gb;
    });
    if (partner) {
      const tmp = c.sideB;
      c.sideB = partner.sideB;
      partner.sideB = tmp;
    }
  }
}

/** Full groups→knockout structure at creation time. */
export function buildGroupsKnockout(
  entrants: Entrant[],
  groupCount: number,
  advancePerGroup: number,
  thirdPlace: boolean
): BuiltStructure {
  const { groups, ties } = buildGroups(entrants, groupCount);
  const knockout = seedKnockoutFromGroups(groups, advancePerGroup, thirdPlace);
  return { groups, ties: [...ties, ...knockout] };
}
