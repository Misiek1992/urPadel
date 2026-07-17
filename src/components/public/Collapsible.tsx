"use client";

// Small collapsible card used for listing past rounds without flooding the page.

import { useState, type ReactNode } from "react";
import { cn } from "@/components/ui";

export function Collapsible({
  title,
  meta,
  defaultOpen = false,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span className="text-sm font-bold text-white">{title}</span>
        <span className="flex shrink-0 items-center gap-3">
          {meta}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={cn("text-slate-400 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && <div className="border-t border-white/10 p-4 sm:p-5">{children}</div>}
    </div>
  );
}
