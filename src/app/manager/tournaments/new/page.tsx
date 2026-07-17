import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { ClubPlayer } from "@/lib/models";
import { serialize, type ClubPlayerJSON } from "@/lib/types";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { Badge, Card, PageHeader } from "@/components/ui";
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
  const t = createT(await getLocale());
  const { club: clubParam } = await searchParams;
  if (viewer.managedClubs.length === 0) return <ManagerDenied viewer={viewer} t={t} />;

  // With more than one club to choose from, require an explicit pick before
  // jumping into the wizard — silently defaulting to "the first club" is how
  // tournaments end up created for the wrong club.
  const hasValidParam = viewer.managedClubs.some((c) => c._id === clubParam);
  if (!hasValidParam && viewer.managedClubs.length > 1) {
    return (
      <div>
        <PageHeader
          title={t("clubChooser.title")}
          subtitle={t("clubChooser.subtitle")}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {viewer.managedClubs.map((club) => (
            <Link
              key={club._id}
              href={`/manager/tournaments/new?club=${club._id}`}
              className="card card-pad transition-colors hover:border-volt-400/40"
            >
              <h3 className="text-lg font-bold text-white">{club.name}</h3>
              <p className="mt-1 text-xs text-slate-500">/{club.slug}</p>
              <p className="mt-4 text-xs font-semibold text-volt-300">
                {t("clubChooser.cta")}
              </p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const activeClub = resolveActiveClub(viewer, clubParam);
  if (!activeClub) return <ManagerDenied viewer={viewer} t={t} />;

  await dbConnect();
  const rosterRaw = await ClubPlayer.find({ clubId: activeClub._id })
    .sort({ nameLower: 1 })
    .lean();
  const roster = serialize<ClubPlayerJSON[]>(rosterRaw);

  return (
    <div>
      <PageHeader
        title={t("clubChooser.title")}
        subtitle={t("wizard.pageSubtitle")}
        actions={
          <span className="flex items-center gap-2 text-sm">
            <span className="text-slate-400">{t("wizard.organizingFor")}</span>
            <Badge tone="volt">{activeClub.name}</Badge>
            {viewer.managedClubs.length > 1 && (
              <Link
                href="/manager/tournaments/new"
                className="text-xs font-semibold text-slate-400 hover:text-volt-300"
              >
                {t("common.change")}
              </Link>
            )}
          </span>
        }
      />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      <TournamentWizard clubId={activeClub._id} roster={roster} />
    </div>
  );
}
