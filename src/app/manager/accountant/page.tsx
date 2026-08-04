import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { AccountantDocument, Club } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { toAccountantJSON } from "@/lib/accountant";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { ManagerDenied, resolveActiveClub } from "@/components/manager/access";
import { ManagerNav } from "@/components/manager/ManagerNav";
import { AccountantAssistant } from "@/components/manager/AccountantAssistant";

export const dynamic = "force-dynamic";

const LIST_FIELDS =
  "clubId uploadedByEmail fileName mimeType size ocrEngine status extractedText documentType error createdAt updatedAt";

export default async function ManagerAccountantPage({
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
  const enabled = Boolean(club.features?.accountantAssistant?.enabled);

  return (
    <div>
      <PageHeader title={t("accountant.title")} subtitle={t("accountant.subtitle")} />
      <div className="-mt-2 mb-8">
        <ManagerNav clubs={viewer.managedClubs} activeClubId={activeClub._id} />
      </div>
      {enabled ? (
        <AccountantAssistant
          clubId={activeClub._id}
          engine={club.features?.accountantAssistant?.ocrEngine ?? "tesseract"}
          documents={(
            await AccountantDocument.find({ clubId: activeClub._id }, LIST_FIELDS)
              .sort({ createdAt: -1 })
              .lean()
          ).map((d) => toAccountantJSON(d as Record<string, unknown>))}
        />
      ) : (
        <EmptyState
          title={t("accountant.notEnabledTitle")}
          hint={t("accountant.notEnabledHint")}
        />
      )}
    </div>
  );
}
