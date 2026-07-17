import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, Tournament } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clubs" };

export default async function ClubsPage() {
  await dbConnect();
  const clubsRaw = await Club.find({}).sort({ name: 1 }).lean();
  const clubs = serialize<ClubJSON[]>(clubsRaw);
  const stats = await Promise.all(
    clubs.map(async (club) => {
      const [players, tournaments, active] = await Promise.all([
        ClubPlayer.countDocuments({ clubId: club._id }),
        Tournament.countDocuments({ clubId: club._id }),
        Tournament.countDocuments({ clubId: club._id, status: "active" }),
      ]);
      return { club, players, tournaments, active };
    })
  );

  return (
    <div>
      <PageHeader
        title="Clubs"
        subtitle="Every club has its own tournaments, results and a rolling one-year ranking."
      />
      {stats.length === 0 ? (
        <EmptyState
          title="No clubs yet"
          hint="A super admin can create the first club in the admin panel."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(({ club, players, tournaments, active }) => (
            <Link
              key={club._id}
              href={`/club/${club.slug}`}
              className="card card-pad transition-colors hover:border-volt-400/40"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-white">{club.name}</h2>
                {active > 0 && <span className="badge badge-volt">Live now</span>}
              </div>
              {club.city && (
                <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">
                  {club.city}
                </p>
              )}
              {club.description && (
                <p className="mt-3 line-clamp-3 text-sm text-slate-400">
                  {club.description}
                </p>
              )}
              <p className="mt-4 text-xs text-slate-500">
                <span className="font-semibold text-volt-300">{players}</span>{" "}
                players ·{" "}
                <span className="font-semibold text-volt-300">{tournaments}</span>{" "}
                tournaments
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
