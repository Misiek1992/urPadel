"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { useT } from "@/components/i18n/LocaleProvider";

export function SuperAdminNav() {
  const pathname = usePathname();
  const t = useT();

  const TABS = [
    { href: "/superadmin", label: t("superadminNav.overview") },
    { href: "/superadmin/clubs", label: t("superadminNav.clubs") },
    { href: "/superadmin/admins", label: t("superadminNav.admins") },
    { href: "/superadmin/logs", label: t("superadminNav.logs") },
  ] as const;

  return (
    <nav
      aria-label="Super admin sections"
      className="mt-4 flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === "/superadmin"
            ? pathname === "/superadmin"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
              active
                ? "bg-volt-400 text-navy-950"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
