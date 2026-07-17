// Club ranking: after every finished tournament, players earn ranking points
// by final position — 1st: 100, 2nd: 90, 3rd: 80 ... 10th: 10, everyone else
// gets 1 participation point. Points count towards the club ranking for one
// year (rolling window). Club managers can edit points and add adjustments.

import { dbConnect } from "./db";
import { ClubPlayer, RankingEntry } from "./models";
import { computeStandings, type Entrant, type EngineRound } from "./engine";
import type { RankingEntryJSON, RankingRowJSON } from "./types";

export const RANKING_WINDOW_DAYS = 365;

export function pointsForPosition(position: number): number {
  if (position >= 1 && position <= 10) return 110 - position * 10;
  return 1;
}

interface TournamentLike {
  _id: unknown;
  clubId: unknown;
  name: string;
  entrants: Entrant[];
  rounds: EngineRound[];
  pointsAwarded?: boolean;
  finishedAt?: Date | null;
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
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const date = opts?.date ?? tournament.finishedAt ?? new Date();
  let created = 0;
  for (let i = 0; i < standings.length; i++) {
    const row = standings[i];
    const position = i + 1;
    const points = pointsForPosition(position);
    const entrant = tournament.entrants.find((e) => e.id === row.entrantId);
    const names =
      entrant?.players && entrant.players.length > 0
        ? entrant.players
        : [entrant?.name].filter((x): x is string => Boolean(x));
    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;
      const nameLower = name.toLowerCase();
      const player = await ClubPlayer.findOneAndUpdate(
        { clubId: tournament.clubId, nameLower },
        { $setOnInsert: { clubId: tournament.clubId, name, nameLower } },
        { new: true, upsert: true }
      );
      await RankingEntry.create({
        clubId: tournament.clubId,
        playerId: player._id,
        playerName: player.name,
        tournamentId: tournament._id,
        tournamentName: tournament.name,
        points,
        position,
        kind: "tournament",
        date,
      });
      created++;
    }
  }
  return created;
}

/** Club ranking over the rolling 1-year window, grouped by player. */
export async function computeClubRanking(clubId: string): Promise<RankingRowJSON[]> {
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
}
