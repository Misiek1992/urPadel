"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/superadmin", label: "Overview" },
  { href: "/superadmin/clubs", label: "Clubs" },
  { href: "/superadmin/admins", label: "Admins" },
  { href: "/superadmin/logs", label: "Activity log" },
] as const;

export function SuperAdminNav() {
  const pathname = usePathname();
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
