import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui";
import { DataDeletionConfirm } from "@/components/public/DataDeletionConfirm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Confirm data deletion" };

export default async function DataDeletionConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = createT(await getLocale());
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("dataDeletion.confirmTitle")} />
      <div className="card card-pad">
        <DataDeletionConfirm token={token ?? ""} />
      </div>
    </div>
  );
}
