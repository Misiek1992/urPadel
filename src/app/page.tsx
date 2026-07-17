import Link from "next/link";
import { dbConnect } from "@/lib/db";
import { Club, ClubPlayer, Tournament } from "@/lib/models";
import { serialize, type ClubJSON } from "@/lib/types";
import { TOURNAMENT_TYPES } from "@/lib/engine";
import { pointsForPosition } from "@/lib/ranking";
import { PadelMark } from "@/components/Logo";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function CourtIllustration() {
  return (
    <svg
      viewBox="0 0 360 220"
      className="h-auto w-full max-w-md drop-shadow-[0_0_35px_rgba(217,249,84,0.15)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="court-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12213d" />
          <stop offset="1" stopColor="#0a1425" />
        </linearGradient>
      </defs>
      <rect x="10" y="10" width="340" height="200" rx="16" fill="url(#court-bg)" stroke="#d9f954" strokeWidth="2.5" />
      <line x1="180" y1="10" x2="180" y2="210" stroke="#d9f954" strokeWidth="2" strokeDasharray="7 6" opacity="0.9" />
      <line x1="95" y1="42" x2="95" y2="178" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <line x1="265" y1="42" x2="265" y2="178" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <line x1="95" y1="110" x2="265" y2="110" stroke="#4aa8ff" strokeWidth="1.5" opacity="0.6" />
      <circle cx="140" cy="75" r="9" fill="#d9f954" />
      <path d="M133.5 71.5a9 9 0 0 1 13 0" stroke="#0a1425" strokeWidth="1.4" fill="none" />
      <path d="M133.5 78.5a9 9 0 0 0 13 0" stroke="#0a1425" strokeWidth="1.4" fill="none" />
      <circle cx="228" cy="150" r="6" fill="#4aa8ff" opacity="0.9" />
    </svg>
  );
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Pick your format",
    text: "Americano, Mexicano or their team variants — with numbered or custom-named courts and your points per match.",
  },
  {
    step: "2",
    title: "Import players",
    text: "Paste or upload a Playtomic export, CSV or plain list. Or pick straight from your club roster.",
  },
  {
    step: "3",
    title: "Play & score at the court",
    text: "Every court gets its own live page — players enter the score the moment the match ends.",
  },
  {
    step: "4",
    title: "Rankings update themselves",
    text: "Close the tournament and club ranking points land automatically: 100 for the win, down to 1 for showing up.",
  },
];

export default async function LandingPage() {
  await dbConnect();
  const clubsRaw = await Club.find({}).sort({ name: 1 }).limit(6).lean();
  const clubs = serialize<ClubJSON[]>(clubsRaw);
  const clubStats = await Promise.all(
    clubs.map(async (club) => {
      const [players, tournaments] = await Promise.all([
        ClubPlayer.countDocuments({ clubId: club._id }),
        Tournament.countDocuments({ clubId: club._id }),
      ]);
      return { club, players, tournaments };
    })
  );

  return (
    <div className="space-y-20 pb-8">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-2">
        <div>
          <span className="badge badge-volt mb-5">
            Americano · Mexicano · Team formats
          </span>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            Run unforgettable{" "}
            <span className="text-volt-400">Americano</span> &{" "}
            <span className="text-volt-400">Mexicano</span> nights
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-400">
            urPadel organizes the whole evening: automatic pairings, a live page
            for every court, round-by-round results and a club ranking that
            keeps players coming back all year.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/clubs" className="btn btn-primary btn-lg">
              Explore clubs
            </Link>
            <Link href="/manager" className="btn btn-secondary btn-lg">
              Organize a tournament
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <CourtIllustration />
        </div>
      </section>

      {/* Formats */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <PadelMark size={26} />
          <h2 className="text-2xl font-extrabold text-white">
            Four formats, one flow
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {TOURNAMENT_TYPES.map((t) => (
            <div key={t.value} className="card card-pad">
              <h3 className="text-lg font-bold text-volt-300">{t.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {t.description}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Every rally point counts towards the individual (or team) score — a
          16–8 result gives the winners 16 points each and the losers 8. The
          highest total wins the night.
        </p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-6 text-2xl font-extrabold text-white">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="card card-pad">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-volt-400 text-base font-extrabold text-navy-950">
                {item.step}
              </span>
              <h3 className="mt-4 text-base font-bold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Ranking teaser */}
      <section className="card card-pad overflow-hidden">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold text-white">
              A club ranking players actually care about
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              Every finished tournament feeds the club ranking automatically:
              100 points for the winner, 90 for second, down to 10 for tenth —
              and 1 point just for playing. Points stay on the board for{" "}
              <span className="font-semibold text-volt-300">365 days</span>, so
              the ranking always reflects the last year of padel. Club managers
              can adjust points at any time.
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-center gap-2">
            {[2, 1, 3].map((pos) => (
              <div
                key={pos}
                className={`flex w-24 flex-col items-center justify-end rounded-t-2xl border border-white/10 bg-white/[0.05] ${
                  pos === 1 ? "h-36" : pos === 2 ? "h-28" : "h-24"
                }`}
              >
                <span className="text-2xl">{["🥇", "🥈", "🥉"][pos - 1]}</span>
                <span className="text-xl font-extrabold text-volt-300">
                  {pointsForPosition(pos)}
                </span>
                <span className="mb-3 text-[11px] uppercase tracking-wider text-slate-500">
                  points
                </span>
              </div>
            ))}
            <div className="flex h-16 w-24 flex-col items-center justify-end rounded-t-2xl border border-white/10 bg-white/[0.03]">
              <span className="text-xl font-extrabold text-slate-400">1</span>
              <span className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
                for playing
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Clubs */}
      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold text-white">Clubs on urPadel</h2>
          <Link href="/clubs" className="text-sm font-semibold text-volt-300 hover:text-volt-400">
            All clubs →
          </Link>
        </div>
        {clubStats.length === 0 ? (
          <EmptyState
            title="No clubs yet"
            hint="A super admin can create the first club in the admin panel."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clubStats.map(({ club, players, tournaments }) => (
              <Link
                key={club._id}
                href={`/club/${club.slug}`}
                className="card card-pad transition-colors hover:border-volt-400/40"
              >
                <h3 className="text-lg font-bold text-white">{club.name}</h3>
                {club.city && (
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-slate-500">
                    {club.city}
                  </p>
                )}
                {club.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-slate-400">
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
      </section>
    </div>
  );
}
