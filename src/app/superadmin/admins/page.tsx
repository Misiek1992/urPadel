import { DEFAULT_SUPERADMIN, getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { AppUser } from "@/lib/models";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { SuperAdminDenied } from "@/components/superadmin/AccessGate";
import { AdminsManager } from "@/components/superadmin/AdminsManager";

export const dynamic = "force-dynamic";

export default async function SuperAdminAdminsPage() {
  const viewer = await getViewer();
  const t = createT(await getLocale());
  if (!viewer.isSuperAdmin) {
    return <SuperAdminDenied email={viewer.email} t={t} />;
  }

  await dbConnect();
  const users = await AppUser.find({ role: "superadmin" }, "email").lean();
  const emails = new Set<string>([DEFAULT_SUPERADMIN]);
  for (const u of users as unknown as { email: string }[])
    emails.add(u.email.toLowerCase());

  return (
    <AdminsManager
      emails={[...emails]}
      defaultEmail={DEFAULT_SUPERADMIN}
      viewerEmail={viewer.email}
    />
  );
}
