"use client";

// Manager section tabs + club switcher. Every link preserves ?club=.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Select, cn } from "@/components/ui";

const TABS = [
  { href: "/manager", label: "Dashboard" },
  { href: "/manager/players", label: "Players" },
  { href: "/manager/ranking", label: "Ranking" },
  { href: "/manager/tournaments/new", label: "New tournament" },
] as const;

export function ManagerNav({
  clubs,
  activeClubId,
}: {
  clubs: { _id: string; name: string }[];
  activeClubId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <nav
        aria-label="Manager sections"
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1"
      >
        {TABS.map((tab) => {
          const active =
            tab.href === "/manager"
              ? pathname === "/manager"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}?club=${activeClubId}`}
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
      {clubs.length > 1 && (
        <Select
          value={activeClubId}
          onChange={(e) => router.push(`${pathname}?club=${e.target.value}`)}
          aria-label="Switch club"
          className="w-auto"
        >
          {clubs.map((club) => (
            <option key={club._id} value={club._id}>
              {club.name}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}
