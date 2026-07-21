// Request-scoped data loaders shared between a page's `generateMetadata` and
// its default export — React's `cache()` dedupes identical calls within one
// render pass, so the tournament/club doc is only fetched once per request
// even though both functions need it.
import { cache } from "react";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "./db";
import { Club, Tournament } from "./models";
import { serialize, type ClubJSON, type TournamentJSON } from "./types";

export const getTournamentWithClub = cache(
  async (
    tournamentId: string
  ): Promise<{ tournament: TournamentJSON; club: ClubJSON | null } | null> => {
    if (!isValidObjectId(tournamentId)) return null;
    await dbConnect();
    const doc = await Tournament.findById(tournamentId).lean();
    if (!doc) return null;
    const tournament = serialize<TournamentJSON>(doc);
    const clubRaw = await Club.findById(tournament.clubId).lean();
    const club = clubRaw ? serialize<ClubJSON>(clubRaw) : null;
    return { tournament, club };
  }
);

export const getClubBySlug = cache(async (slug: string): Promise<ClubJSON | null> => {
  await dbConnect();
  const doc = await Club.findOne({ slug }).lean();
  return doc ? serialize<ClubJSON>(doc) : null;
});
