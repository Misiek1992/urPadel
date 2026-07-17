import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer } from "@/lib/models";
import { serialize, type ClubPlayerJSON } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { TournamentWizard } from "@/components/manager/TournamentWizard";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} />;

  await dbConnect();
  const rosterRaw = await ClubPlayer.find({ clubId: activeClub._id })
    .sort({ nameLower: 1 })
    .lean();
  const roster = serialize<ClubPlayerJSON[]>(rosterRaw);

  return (
    <div>
      <PageHeader
        title="New tournament"
        subtitle={`Set up an Americano or Mexicano night for ${activeClub.name}.`}
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      <TournamentWizard clubId={activeClub._id} roster={roster} />
    </div>
  );
}
