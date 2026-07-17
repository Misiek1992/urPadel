import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Tournament } from "@/lib/models";
import { serialize, type TournamentJSON } from "@/lib/types";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { ManagerDenied } from "@/components/manager/access";
import { PresentView } from "@/components/manager/PresentView";

export const dynamic = "force-dynamic";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const viewer = await getViewer();
  const t = createT(await getLocale());
  const { tournamentId } = await params;
  if (!isValidObjectId(tournamentId)) notFound();

  await dbConnect();
  const doc = await Tournament.findById(tournamentId).lean();
  if (!doc) notFound();
  const tournament = serialize<TournamentJSON>(doc);

  const owningClub = viewer.managedClubs.find((c) => c._id === tournament.clubId);
  if (!owningClub) {
    return (
      <div className="py-12">
        <ManagerDenied viewer={viewer} t={t} />
      </div>
    );
  }

  return <PresentView tournament={tournament} clubId={owningClub._id} />;
}
