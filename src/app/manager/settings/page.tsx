import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { PlaytomicSettings } from "@/components/manager/PlaytomicSettings";

export const dynamic = "force-dynamic";

export default async function ManagerSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const viewer = await getViewer();
  const t = createT(await getLocale());
  const { club: clubParam } = await searchParams;
  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} t={t} />;

  await dbConnect();
  const clubDoc = await Club.findById(activeClub._id).lean();
  const club = serialize<ClubJSON>(clubDoc);

  return (
    <div>
      <PageHeader title={t("managerNav.settings")} />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      <PlaytomicSettings clubId={activeClub._id} club={club} />
    </div>
  );
}
