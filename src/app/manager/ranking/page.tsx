import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer } from "@/lib/models";
import { serialize, type ClubPlayerJSON } from "@/lib/types";
import { computeClubRanking, RANKING_WINDOW_DAYS } from "@/lib/ranking";
import { PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { RankingManager } from "@/components/manager/RankingManager";

export const dynamic = "force-dynamic";

export default async function ManagerRankingPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} />;

  await dbConnect();
  const [rows, rosterRaw] = await Promise.all([
    computeClubRanking(activeClub._id),
    ClubPlayer.find({ clubId: activeClub._id }).sort({ nameLower: 1 }).lean(),
  ]);
  const roster = serialize<ClubPlayerJSON[]>(rosterRaw);

  return (
    <div>
      <PageHeader
        title="Club ranking"
        subtitle={`Points count towards the ranking for ${RANKING_WINDOW_DAYS} days. Wins earn 100, 2nd 90 … 10th 10, everyone else 1 — and you can edit any entry below.`}
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      <RankingManager clubId={activeClub._id} rows={rows} roster={roster} />
    </div>
  );
}
