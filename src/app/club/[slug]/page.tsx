import Link from "next/link";
import { notFound } from "next/navigation";
import { dbConnect } from "@/lib/db";
import { Club, Tournament } from "@/lib/models";
import { serialize, type ClubJSON, type TournamentJSON } from "@/lib/types";
import { computeStandings, typeLabel } from "@/lib/engine";
import { computeClubRanking } from "@/lib/ranking";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/components/public/helpers";
import { medalFor } from "@/components/public/StandingsTable";

export const dynamic = "force-dynamic";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await dbConnect();
  const clubRaw = await Club.findOne({ slug }).lean();
  if (!clubRaw) notFound();
  const club = serialize<ClubJSON>(clubRaw);

  const tournamentsRaw = await Tournament.find({ clubId: club._id })
    .sort({ playedAt: -1 })
    .lean();
  const tournaments = serialize<TournamentJSON[]>(tournamentsRaw);
  const active = tournaments.filter((t) => t.status === "active");
  const finished = tournaments.filter((t) => t.status === "finished");
  const ranking = await computeClubRanking(club._id);

  return (
    <div className="space-y-10">
      <PageHeader
        title={club.name}
        subtitle={
          <>
            {club.city && (
              <span className="mr-2 text-xs font-semibold uppercase tracking-wider text-volt-300">
                {club.city}
              </span>
            )}
            {club.description}
          </>
        }
      />

      {active.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Happening now</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {active.map((t) => (
              <Link
                key={t._id}
                href={`/t/${t._id}`}
                className="card card-pad transition-colors hover:border-volt-400/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-white">{t.name}</h3>
                  <span className="badge badge-volt animate-pulse">Live now</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  <Badge tone="blue">{typeLabel(t.type)}</Badge>
                  <span className="ml-2">
                    Round {t.rounds.length} · {t.entrants.length} entrants ·{" "}
                    {t.courts.length} courts
                  </span>
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-4">Tournaments</h2>
        {finished.length === 0 ? (
          <EmptyState
            title="No finished tournaments yet"
            hint="Results and every round will be browsable here once a tournament is closed."
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Tournament</th>
                  <th>Format</th>
                  <th>Winner</th>
                  <th className="text-right">Rounds</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {finished.map((t) => {
                  const winner = computeStandings(t.entrants, t.rounds)[0];
                  return (
                    <tr key={t._id}>
                      <td className="whitespace-nowrap text-xs text-slate-400">
                        {formatDate(t.playedAt)}
                      </td>
                      <td className="font-semibold text-white">
                        <Link href={`/t/${t._id}`} className="hover:text-volt-300">
                          {t.name}
                        </Link>
                      </td>
                      <td>
                        <Badge tone="blue">{typeLabel(t.type)}</Badge>
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="mr-1">🏆</span>
                        <span className="font-semibold text-volt-300">
                          {winner?.name ?? "—"}
                        </span>
                      </td>
                      <td className="text-right text-slate-400">{t.rounds.length}</td>
                      <td className="text-right">
                        <Link
                          href={`/t/${t._id}/results`}
                          className="text-xs font-semibold text-volt-300 hover:text-volt-400"
                        >
                          Results →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Club ranking</h2>
          <p className="text-xs text-slate-500">
            Rolling 12 months · 100 pts for a win, down to 1 for playing
          </p>
        </div>
        {ranking.length === 0 ? (
          <EmptyState
            title="No ranking points yet"
            hint="The ranking fills up automatically as tournaments are closed."
          />
        ) : (
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Player</th>
                  <th className="text-right">Points</th>
                  <th className="text-right">Tournaments</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row) => {
                  const medal = medalFor(row.position);
                  return (
                    <tr
                      key={row.playerName}
                      className={cn(row.position <= 3 && "bg-volt-400/[0.04]")}
                    >
                      <td
                        className={cn(
                          "font-bold",
                          row.position === 1
                            ? "text-volt-300"
                            : row.position === 2
                              ? "text-slate-300"
                              : row.position === 3
                                ? "text-amber-600"
                                : "text-slate-500"
                        )}
                      >
                        {medal ?? row.position}
                      </td>
                      <td className="font-semibold text-white">{row.playerName}</td>
                      <td className="text-right text-base font-extrabold text-volt-300">
                        {row.total}
                      </td>
                      <td className="text-right text-slate-400">
                        {row.tournamentsPlayed}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
