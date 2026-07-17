import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer } from "@/lib/models";
import { serialize, type ClubPlayerJSON } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { PlayersManager } from "@/components/manager/PlayersManager";

export const dynamic = "force-dynamic";

export default async function ManagerPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} />;

  await dbConnect();
  const playersRaw = await ClubPlayer.find({ clubId: activeClub._id })
    .sort({ nameLower: 1 })
    .lean();
  const players = serialize<ClubPlayerJSON[]>(playersRaw);

  return (
    <div>
      <PageHeader
        title="Players"
        subtitle={`The ${activeClub.name} roster — used for the ranking and as a quick-pick list when creating tournaments.`}
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      <PlayersManager clubId={activeClub._id} players={players} />
    </div>
  );
}
