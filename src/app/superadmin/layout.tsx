import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SuperAdminNav } from "@/components/superadmin/SuperAdminNav";
import { createT } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

export const metadata: Metadata = {
  title: "Super admin",
};

export default async function SuperAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const t = createT(await getLocale());
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {t("superadminLayout.title")}
        </h1>
        <SuperAdminNav />
      </div>
      {children}
    </div>
  );
}
