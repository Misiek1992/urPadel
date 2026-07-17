import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import {
  AuditLog,
  Club,
  ClubPlayer,
  RankingEntry,
  Tournament,
} from "@/lib/models";
import { RANKING_WINDOW_DAYS } from "@/lib/ranking";
import { serialize, type AuditLogJSON } from "@/lib/types";
import { StatCard } from "@/components/ui";
import { ActionBadge } from "@/components/superadmin/ActionBadge";
import { SuperAdminDenied } from "@/components/superadmin/AccessGate";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  const viewer = await getViewer();
  if (!viewer.isSuperAdmin) {
    return <SuperAdminDenied email={viewer.email} />;
  }

  await dbConnect();
  const since = new Date(Date.now() - RANKING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [
    clubCount,
    activeTournaments,
    finishedTournaments,
    playerCount,
    rankingEntryCount,
    recentLogsRaw,
  ] = await Promise.all([
    Club.countDocuments({}),
    Tournament.countDocuments({ status: "active" }),
    Tournament.countDocuments({ status: "finished" }),
    ClubPlayer.countDocuments({}),
    RankingEntry.countDocuments({ date: { $gte: since } }),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const recentLogs = serialize<AuditLogJSON[]>(recentLogsRaw);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="section-title">Overview</h2>
          <p className="mt-1 text-sm text-slate-400">
            Everything across urPadel at a glance.
          </p>
        </div>
        <Link href="/superadmin/clubs" className="btn btn-primary btn-sm">
          Create a club
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Clubs" value={clubCount} hint="on the platform" />
        <StatCard
          label="Tournaments"
          value={activeTournaments + finishedTournaments}
          hint={`${activeTournaments} active · ${finishedTournaments} finished`}
        />
        <StatCard
          label="Roster players"
          value={playerCount}
          hint="across all clubs"
        />
        <StatCard
          label="Ranking entries"
          value={rankingEntryCount}
          hint={`last ${RANKING_WINDOW_DAYS} days`}
        />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Recent activity</h3>
          <Link
            href="/superadmin/logs"
            className="text-sm font-semibold text-volt-300 hover:text-volt-400"
          >
            View full log →
          </Link>
        </div>
        <div className="card divide-y divide-white/5">
          {recentLogs.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-400">
              No activity recorded yet — every mutation across the app will show
              up here.
            </p>
          ) : (
            recentLogs.map((log) => (
              <div
                key={log._id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3"
              >
                <span className="w-40 shrink-0 text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString("en-GB")}
                </span>
                <span className="text-xs font-medium text-slate-300">
                  {log.actorEmail}
                </span>
                <ActionBadge action={log.action} />
                <span
                  className="min-w-0 flex-1 truncate text-sm text-slate-300"
                  title={log.message}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
