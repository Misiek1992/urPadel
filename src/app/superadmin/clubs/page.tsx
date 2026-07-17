import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, Tournament } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { SuperAdminDenied } from "@/components/superadmin/AccessGate";
import { ClubsManager } from "@/components/superadmin/ClubsManager";

export const dynamic = "force-dynamic";

export default async function SuperAdminClubsPage() {
  const viewer = await getViewer();
  if (!viewer.isSuperAdmin) {
    return <SuperAdminDenied email={viewer.email} />;
  }

  await dbConnect();
  const clubsRaw = await Club.find({}).sort({ name: 1 }).lean();
  const clubs = serialize<ClubJSON[]>(clubsRaw);

  const playersByClub: Record<string, number> = {};
  const tournamentsByClub: Record<string, number> = {};
  await Promise.all(
    clubs.map(async (club) => {
      const [players, tournaments] = await Promise.all([
        ClubPlayer.countDocuments({ clubId: club._id }),
        Tournament.countDocuments({ clubId: club._id }),
      ]);
      playersByClub[club._id] = players;
      tournamentsByClub[club._id] = tournaments;
    })
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">Clubs</h2>
        <p className="mt-1 text-sm text-slate-400">
          Create clubs and assign manager emails — managers get access to the
          club manager panel the moment they sign in with that email.
        </p>
      </div>
      <ClubsManager
        clubs={clubs}
        playersByClub={playersByClub}
        tournamentsByClub={tournamentsByClub}
      />
    </div>
  );
}
