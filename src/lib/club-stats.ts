// Per-club counts (roster size, tournament totals, active tournaments) for the
// club-listing surfaces (/clubs, home page). Computed with two grouped
// aggregations regardless of how many clubs exist — the previous approach ran
// 2-3 count queries *per club* in a loop, which scaled linearly with the club
// count and became the app's first real query-volume cliff.
import { dbConnect } from "./db";
import { ClubPlayer, Tournament } from "./models";

export interface ClubStats {
  players: number;
  tournaments: number;
  active: number;
}

const EMPTY: ClubStats = { players: 0, tournaments: 0, active: 0 };

/**
 * Returns a `Map<clubIdString, ClubStats>` for the given club ids. Missing
 * clubs (no players/tournaments yet) resolve to zeroes via `statsFor`.
 */
export async function getClubStats(clubIds: string[]): Promise<Map<string, ClubStats>> {
  const map = new Map<string, ClubStats>();
  if (clubIds.length === 0) return map;
  await dbConnect();

  const [playerCounts, tournamentCounts] = await Promise.all([
    ClubPlayer.aggregate<{ _id: unknown; count: number }>([
      { $match: { clubId: { $in: clubIds.map((id) => toObjectId(id)) } } },
      { $group: { _id: "$clubId", count: { $sum: 1 } } },
    ]),
    Tournament.aggregate<{ _id: unknown; total: number; active: number }>([
      { $match: { clubId: { $in: clubIds.map((id) => toObjectId(id)) } } },
      {
        $group: {
          _id: "$clubId",
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  for (const id of clubIds) map.set(id, { ...EMPTY });
  for (const row of playerCounts) {
    const stats = map.get(String(row._id));
    if (stats) stats.players = row.count;
  }
  for (const row of tournamentCounts) {
    const stats = map.get(String(row._id));
    if (stats) {
      stats.tournaments = row.total;
      stats.active = row.active;
    }
  }
  return map;
}

/** Convenience lookup with a zero fallback, so callers never handle `undefined`. */
export function statsFor(map: Map<string, ClubStats>, clubId: string): ClubStats {
  return map.get(clubId) ?? EMPTY;
}

// Aggregation `$match` needs real ObjectIds, not the serialized hex strings the
// pages carry. Import lazily-typed to avoid pulling mongoose types into callers.
import { Types } from "mongoose";
function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
