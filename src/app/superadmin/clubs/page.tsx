import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, Tournament } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { SuperAdminDenied } from "@/components/superadmin/AccessGate";
import { ClubsManager } from "@/components/superadmin/ClubsManager";

export const dynamic = "force-dynamic";

export default async function SuperAdminClubsPage() {
  const viewer = await getViewer();
  const t = createT(await getLocale());
  if (!viewer.isSuperAdmin) {
    return <SuperAdminDenied email={viewer.email} t={t} />;
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
        <h2 className="section-title">{t("superadminClubs.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("superadminClubs.subtitle")}</p>
      </div>
      <ClubsManager
        clubs={clubs}
        playersByClub={playersByClub}
        tournamentsByClub={tournamentsByClub}
      />
    </div>
  );
}
