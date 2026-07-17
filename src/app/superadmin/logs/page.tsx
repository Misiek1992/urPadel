import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { AuditLog, Club } from "@/lib/models";
import { serialize, type AuditLogJSON } from "@/lib/types";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { SuperAdminDenied } from "@/components/superadmin/AccessGate";
import { LogsTable } from "@/components/superadmin/LogsTable";

export const dynamic = "force-dynamic";

export default async function SuperAdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const viewer = await getViewer();
  const t = createT(await getLocale());
  if (!viewer.isSuperAdmin) {
    return <SuperAdminDenied email={viewer.email} t={t} />;
  }

  const { limit: limitParam } = await searchParams;
  const limitRaw = Number(limitParam ?? 200);
  const limit = Math.min(
    Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 200, 1),
    500
  );

  await dbConnect();
  const [logsRaw, clubsRaw] = await Promise.all([
    AuditLog.find({}).sort({ createdAt: -1 }).limit(limit).lean(),
    Club.find({}, "name").lean(),
  ]);
  const logs = serialize<AuditLogJSON[]>(logsRaw);
  const clubNames: Record<string, string> = {};
  for (const club of clubsRaw as unknown as { _id: unknown; name: string }[]) {
    clubNames[String(club._id)] = club.name;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="section-title">{t("superadminLogs.title")}</h2>
        <p className="mt-1 text-sm text-slate-400">{t("superadminLogs.subtitle")}</p>
      </div>
      <LogsTable logs={logs} clubNames={clubNames} limit={limit} />
    </div>
  );
}
