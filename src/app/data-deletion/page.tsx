import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { PageHeader } from "@/components/ui";
import { DataDeletionForm } from "@/components/public/DataDeletionForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Delete my data" };

export default async function DataDeletionPage() {
  const t = createT(await getLocale());
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("dataDeletion.title")} subtitle={t("dataDeletion.subtitle")} />
      <div className="card card-pad space-y-5">
        <p className="text-sm leading-relaxed text-slate-300">{t("dataDeletion.intro")}</p>
        <ul className="space-y-1.5 text-sm text-slate-400">
          <li>• {t("dataDeletion.scopeRemoved")}</li>
          <li>• {t("dataDeletion.scopeKept")}</li>
        </ul>
        <div className="border-t border-white/10 pt-5">
          <DataDeletionForm />
        </div>
      </div>
    </div>
  );
}
