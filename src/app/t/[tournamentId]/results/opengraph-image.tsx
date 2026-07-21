import { ImageResponse } from "next/og";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { serialize, type ClubJSON, type TournamentJSON } from "@/lib/types";
import { computeStandings } from "@/lib/engine";
import { formatLabel } from "@/lib/i18n/formats";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { formatDate } from "@/components/public/helpers";
import { OG_SIZE, TournamentOgImage, loadOgFonts } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "urPadel tournament results";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const fonts = await loadOgFonts();
  const t = createT(await getLocale());

  if (!isValidObjectId(tournamentId)) {
    return new ImageResponse(
      <TournamentOgImage
        name="Tournament not found"
        clubName={null}
        formatLabel=""
        statusLabel=""
        isActive={false}
        podium={[]}
      />,
      { ...OG_SIZE, fonts, emoji: "twemoji" }
    );
  }

  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) {
    return new ImageResponse(
      <TournamentOgImage
        name="Tournament not found"
        clubName={null}
        formatLabel=""
        statusLabel=""
        isActive={false}
        podium={[]}
      />,
      { ...OG_SIZE, fonts, emoji: "twemoji" }
    );
  }
  const tournament = serialize<TournamentJSON>(doc);
  const clubRaw = await Club.findById(tournament.clubId).lean();
  const club = clubRaw ? serialize<ClubJSON>(clubRaw) : null;
  const isActive = tournament.status === "active";
  const standings = computeStandings(tournament.entrants, tournament.rounds);
  const podium = standings.slice(0, 3).map((row) => ({ name: row.name, points: row.points }));

  return new ImageResponse(
    (
      <TournamentOgImage
        name={`${tournament.name} — ${t("resultsPage.titleSuffix")}`}
        clubName={club?.name ?? null}
        formatLabel={formatLabel(t, tournament.type)}
        statusLabel={
          isActive
            ? t("resultsPage.live")
            : t("resultsPage.finished", {
                date: formatDate(tournament.finishedAt ?? tournament.playedAt),
              })
        }
        isActive={isActive}
        podium={podium}
      />
    ),
    { ...OG_SIZE, fonts, emoji: "twemoji" }
  );
}
