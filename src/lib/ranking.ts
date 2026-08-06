// Club ranking: after every finished tournament, players earn ranking points
// by final position — 1st: 100, 2nd: 90, 3rd: 80 ... 10th: 10, everyone else
// gets 1 participation point. Points count towards the club ranking for one
// year (rolling window). Club managers can edit points and add adjustments.

import { cache } from "react";
import { dbConnect } from "./db";
import { ClubPlayer, RankingEntry } from "./models";
import {
  computeStandings,
  isCompetitiveType,
  type Entrant,
  type EngineRound,
  type TournamentType,
} from "./engine";
import { finalPlacement, resolveTies } from "./competitive";
import type {
  CompetitiveConfigJSON,
  GroupJSON,
  RankingEntryJSON,
  RankingRowJSON,
  ScoringMode,
  TieJSON,
} from "./types";
import { pointsForPosition, RANKING_WINDOW_DAYS } from "./ranking-points";

export { pointsForPosition, RANKING_WINDOW_DAYS };

interface TournamentLike {
  _id: unknown;
  clubId: unknown;
  name: string;
  type: TournamentType;
  entrants: Entrant[];
  rounds: EngineRound[];
  scoring?: ScoringMode | null;
  config?: CompetitiveConfigJSON | null;
  groups?: GroupJSON[];
  ties?: TieJSON[];
  pointsAwarded?: boolean;
  finishedAt?: Date | null;
}

/**
 * Final ranking order (best → worst) as entrant ids. Competitive formats
 * (knockout/groups/league) rank by bracket/table placement; Americano/Mexicano
 * rank by cumulative rally points.
 */
function finalOrder(tournament: TournamentLike): string[] {
  if (isCompetitiveType(tournament.type)) {
    const plain = <T,>(v: unknown): T => JSON.parse(JSON.stringify(v ?? null)) as T;
    const comp = {
      type: tournament.type,
      scoring: (tournament.scoring ?? "points") as ScoringMode,
      config: plain<CompetitiveConfigJSON>(tournament.config) ?? {},
      entrants: plain<Entrant[]>(tournament.entrants) ?? [],
      groups: plain<GroupJSON[]>(tournament.groups) ?? [],
      ties: plain<TieJSON[]>(tournament.ties) ?? [],
    };
    comp.ties = resolveTies(comp);
    return finalPlacement(comp);
  }
  return computeStandings(tournament.entrants, tournament.rounds).map((r) => r.entrantId);
}

/**
 * Awards ranking points for a finished tournament. For team formats both
 * players of a team receive the team's position points. Players are upserted
 * into the club roster by name (case-insensitive). Idempotence is the caller's
 * responsibility via tournament.pointsAwarded.
 */
export async function awardTournamentPoints(
  tournament: TournamentLike,
  opts?: { date?: Date }
): Promise<number> {
  await dbConnect();
  const orderedIds = finalOrder(tournament);
  const date = opts?.date ?? tournament.finishedAt ?? new Date();

  // One entry per player instance (both members of a team get the team's
  // position/points). Previously this looped with a findOneAndUpdate + create
  // PER PLAYER — 32 serial round-trips for a 16-player tournament, all at
  // close time. Now: one bulk player-upsert, one lookup, one insertMany.
  const awards: { name: string; nameLower: string; position: number; points: number }[] = [];
  for (let i = 0; i < orderedIds.length; i++) {
    const position = i + 1;
    const points = pointsForPosition(position);
    const entrant = tournament.entrants.find((e) => e.id === orderedIds[i]);
    const names =
      entrant?.players && entrant.players.length > 0
        ? entrant.players
        : [entrant?.name].filter((x): x is string => Boolean(x));
    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;
      awards.push({ name, nameLower: name.toLowerCase(), position, points });
    }
  }
  if (awards.length === 0) return 0;

  // Upsert every player once (dedupe by nameLower for the roster write).
  const uniqueByNameLower = new Map(awards.map((a) => [a.nameLower, a]));
  await ClubPlayer.bulkWrite(
    [...uniqueByNameLower.values()].map((a) => ({
      updateOne: {
        filter: { clubId: tournament.clubId, nameLower: a.nameLower },
        update: { $setOnInsert: { clubId: tournament.clubId, name: a.name, nameLower: a.nameLower } },
        upsert: true,
      },
    }))
  );

  // Resolve player ids + canonical (stored-casing) names in one query.
  const players = await ClubPlayer.find(
    { clubId: tournament.clubId, nameLower: { $in: [...uniqueByNameLower.keys()] } },
    "name nameLower"
  ).lean();
  const byNameLower = new Map(
    (players as unknown as { _id: unknown; name: string; nameLower: string }[]).map((p) => [
      p.nameLower,
      p,
    ])
  );

  await RankingEntry.insertMany(
    awards.map((a) => {
      const player = byNameLower.get(a.nameLower);
      return {
        clubId: tournament.clubId,
        playerId: player?._id,
        playerName: player?.name ?? a.name,
        tournamentId: tournament._id,
        tournamentName: tournament.name,
        points: a.points,
        position: a.position,
        kind: "tournament",
        date,
      };
    })
  );

  return awards.length;
}

/**
 * Club ranking over the rolling 1-year window, grouped by player.
 *
 * Wrapped in React `cache()`: the club page resolves the ranking in both its
 * `generateMetadata` and its body within one render pass, so without this it
 * ran the query (and the in-memory grouping) twice per request. `cache()`
 * dedupes within a single request only — no cross-request staleness.
 */
export const computeClubRanking = cache(async (clubId: string): Promise<RankingRowJSON[]> => {
  await dbConnect();
  const since = new Date(Date.now() - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const entries = await RankingEntry.find({ clubId, date: { $gte: since } })
    .sort({ date: -1 })
    .lean();

  const byPlayer = new Map<
    string,
    { playerName: string; playerId?: string; total: number; tournamentsPlayed: number; entries: RankingEntryJSON[] }
  >();
  for (const e of entries as any[]) {
    const key = String(e.playerName).trim().toLowerCase();
    let row = byPlayer.get(key);
    if (!row) {
      row = {
        playerName: e.playerName,
        playerId: e.playerId ? String(e.playerId) : undefined,
        total: 0,
        tournamentsPlayed: 0,
        entries: [],
      };
      byPlayer.set(key, row);
    }
    row.total += e.points;
    if (e.kind === "tournament") row.tournamentsPlayed += 1;
    row.entries.push({
      _id: String(e._id),
      clubId: String(e.clubId),
      playerId: e.playerId ? String(e.playerId) : undefined,
      playerName: e.playerName,
      tournamentId: e.tournamentId ? String(e.tournamentId) : undefined,
      tournamentName: e.tournamentName ?? undefined,
      points: e.points,
      position: e.position ?? undefined,
      kind: e.kind,
      note: e.note ?? undefined,
      date: new Date(e.date).toISOString(),
    });
  }

  return [...byPlayer.values()]
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.tournamentsPlayed - a.tournamentsPlayed ||
        a.playerName.localeCompare(b.playerName)
    )
    .map((row, i) => ({ position: i + 1, ...row }));
});
