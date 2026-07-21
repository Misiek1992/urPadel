import { ImageResponse } from "next/og";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { computeClubRanking } from "@/lib/ranking";
import { ClubOgImage, OG_SIZE, loadOgFonts } from "@/lib/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "urPadel club";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fonts = await loadOgFonts();

  await dbConnect();
  const clubRaw = await Club.findOne({ slug }).lean();
  if (!clubRaw) {
    return new ImageResponse(
      <ClubOgImage name="Club not found" city={null} ranking={[]} />,
      { ...OG_SIZE, fonts, emoji: "twemoji" }
    );
  }
  const club = serialize<ClubJSON>(clubRaw);
  const ranking = await computeClubRanking(club._id);

  return new ImageResponse(
    (
      <ClubOgImage
        name={club.name}
        city={club.city ?? null}
        ranking={ranking.slice(0, 3).map((r) => ({
          position: r.position,
          playerName: r.playerName,
          total: r.total,
        }))}
      />
    ),
    { ...OG_SIZE, fonts, emoji: "twemoji" }
  );
}
