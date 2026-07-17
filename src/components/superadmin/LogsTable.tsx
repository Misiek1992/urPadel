"use client";

import { useMemo, useState } from "react";
import { Input, Select } from "@/components/ui";
import type { AuditLogJSON } from "@/lib/types";
import { ActionBadge } from "./ActionBadge";

export function LogsTable({
  logs,
  clubNames,
  limit,
}: {
  logs: AuditLogJSON[];
  clubNames: Record<string, string>;
  limit: number;
}) {
  const [query, setQuery] = useState("");
  const [prefix, setPrefix] = useState("all");

  const prefixes = useMemo(() => {
    const set = new Set<string>();
    for (const log of logs) set.add(log.action.split(".")[0]);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (
        prefix !== "all" &&
        log.action !== prefix &&
        !log.action.startsWith(`${prefix}.`)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        log.actorEmail.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.message.toLowerCase().includes(q)
      );
    });
  }, [logs, query, prefix]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by actor, action or message…"
          aria-label="Filter log entries"
          className="min-w-0 flex-1 sm:max-w-sm"
        />
        <Select
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          aria-label="Filter by action prefix"
          className="w-auto"
        >
          <option value="all">All actions</option>
          {prefixes.map((p) => (
            <option key={p} value={p}>
              {p}.*
            </option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-slate-500">
          Showing {filtered.length} of {logs.length} entries
        </span>
      </div>

      <div className="table-wrap">
        <table className="table-base">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Message</th>
              <th>Club</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  {logs.length === 0
                    ? "No activity recorded yet — entries appear as soon as anything changes in the app."
                    : "No entries match your filter."}
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log._id}>
                  <td
                    className="whitespace-nowrap text-xs text-slate-400"
                    suppressHydrationWarning
                  >
                    {new Date(log.createdAt).toLocaleString("en-GB")}
                  </td>
                  <td className="whitespace-nowrap text-xs text-slate-300">
                    {log.actorEmail}
                  </td>
                  <td className="whitespace-nowrap">
                    <ActionBadge action={log.action} />
                  </td>
                  <td className="min-w-64 text-sm text-slate-200">{log.message}</td>
                  <td className="whitespace-nowrap text-xs text-slate-300">
                    {(log.clubId && clubNames[log.clubId]) || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">
        Loaded the latest {logs.length} entries (limit {limit}). Adjust with{" "}
        <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-slate-400">
          ?limit=
        </code>{" "}
        in the URL.
      </p>
    </div>
  );
}
