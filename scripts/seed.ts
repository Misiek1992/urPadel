// Seeds the demo club "Padel Arena Warsaw" with 18 players, three finished
// tournaments (full rounds + results, simulated through the real engine) and
// one live tournament, plus ranking points and audit entries.
//
// Run with: npm run seed

import { config } from "dotenv";
config({ path: ".env.local" });

import mongoose from "mongoose";
import { dbConnect } from "../src/lib/db";
import {
  AppUser,
  AuditLog,
  Club,
  ClubPlayer,
  RankingEntry,
  Tournament,
} from "../src/lib/models";
import {
  generateNextRound,
  computeStandings,
  makeEntrantId,
  isTeamType,
  type Entrant,
  type EngineRound,
  type TournamentType,
} from "../src/lib/engine";
import { awardTournamentPoints } from "../src/lib/ranking";

const SUPERADMIN = (process.env.SUPERADMIN_EMAIL || "m.ignaczak.92@gmail.com").toLowerCase();

const PLAYER_NAMES = [
  "Adam Kowalski",
  "Maria Nowak",
  "Carlos Díaz",
  "Sofia Russo",
  "Jakub Wiśniewski",
  "Elena García",
  "Tomás Silva",
  "Anna Lewandowska",
  "Marco Rossi",
  "Julia Zielińska",
  "Lucas Fernández",
  "Emma Johansson",
  "Piotr Mazur",
  "Laura Costa",
  "Hugo Martín",
  "Natalia Kamińska",
  "Oliver Smith",
  "Zofia Dąbrowska",
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function randomScore(matchPoints: number): [number, number] {
  // Slightly favor decisive results over exact ties.
  const a = Math.floor(Math.random() * (matchPoints + 1));
  return [a, matchPoints - a];
}

function makeEntrants(type: TournamentType, playerNames: string[]): Entrant[] {
  if (isTeamType(type)) {
    const entrants: Entrant[] = [];
    for (let i = 0; i < playerNames.length - 1; i += 2) {
      const players = [playerNames[i], playerNames[i + 1]];
      entrants.push({
        id: makeEntrantId(),
        name: `${players[0].split(" ")[0]} / ${players[1].split(" ")[0]}`,
        players,
      });
    }
    return entrants;
  }
  return playerNames.map((name) => ({ id: makeEntrantId(), name }));
}

interface SimSpec {
  name: string;
  type: TournamentType;
  playerNames: string[];
  courts: string[];
  matchPoints: number;
  regularRounds: number;
  withFinal: boolean;
  finishedDaysAgo: number;
}

async function simulateFinishedTournament(clubId: mongoose.Types.ObjectId, spec: SimSpec) {
  const entrants = makeEntrants(spec.type, spec.playerNames);
  const rounds: EngineRound[] = [];
  for (let r = 0; r < spec.regularRounds; r++) {
    const round = generateNextRound({
      type: spec.type,
      entrants,
      courts: spec.courts,
      rounds,
      final: false,
    });
    for (const m of round.matches) {
      const [a, b] = randomScore(spec.matchPoints);
      m.scoreA = a;
      m.scoreB = b;
    }
    rounds.push(round);
  }
  if (spec.withFinal) {
    const final = generateNextRound({
      type: spec.type,
      entrants,
      courts: spec.courts,
      rounds,
      final: true,
    });
    for (const m of final.matches) {
      const [a, b] = randomScore(spec.matchPoints);
      m.scoreA = a;
      m.scoreB = b;
    }
    rounds.push(final);
  }

  const date = daysAgo(spec.finishedDaysAgo);
  const tournament = await Tournament.create({
    clubId,
    name: spec.name,
    type: spec.type,
    matchPoints: spec.matchPoints,
    courts: spec.courts,
    entrants,
    rounds,
    status: "finished",
    pointsAwarded: false,
    playedAt: date,
    finishedAt: date,
  });
  await awardTournamentPoints(tournament as any, { date });
  tournament.pointsAwarded = true;
  await tournament.save();

  const winner = computeStandings(entrants, rounds)[0];
  console.log(`  ✔ ${spec.name} (${spec.type}) — winner: ${winner.name} (${winner.points} pts)`);
  return tournament;
}

async function main() {
  await dbConnect();
  console.log(`Connected to MongoDB (db: ${process.env.MONGODB_DB || "urpadel"})`);

  await Promise.all([
    Club.deleteMany({}),
    ClubPlayer.deleteMany({}),
    RankingEntry.deleteMany({}),
    Tournament.deleteMany({}),
    AppUser.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  console.log("Cleared existing data");

  await AppUser.create({ email: SUPERADMIN, role: "superadmin" });

  const club = await Club.create({
    name: "Padel Arena Warsaw",
    slug: "padel-arena-warsaw",
    city: "Warsaw",
    description:
      "Warsaw's home of social padel. Weekly Americano and Mexicano nights on four indoor courts — everyone welcome, from first-timers to league players.",
    managerEmails: [SUPERADMIN],
  });
  console.log(`Created club: ${club.name}`);

  await ClubPlayer.insertMany(
    PLAYER_NAMES.map((name) => ({
      clubId: club._id,
      name,
      nameLower: name.toLowerCase(),
    }))
  );
  console.log(`Created ${PLAYER_NAMES.length} players`);

  console.log("Simulating finished tournaments:");
  const t1 = await simulateFinishedTournament(club._id, {
    name: "Friday Night Americano #12",
    type: "americano",
    playerNames: PLAYER_NAMES.slice(0, 16),
    courts: ["Court 1", "Court 2", "Court 3", "Court 4"],
    matchPoints: 24,
    regularRounds: 6,
    withFinal: true,
    finishedDaysAgo: 75,
  });
  const t2 = await simulateFinishedTournament(club._id, {
    name: "Sunday Mexicano Open",
    type: "mexicano",
    playerNames: PLAYER_NAMES.slice(3, 15),
    courts: ["Court 1", "Court 2", "Court 3"],
    matchPoints: 21,
    regularRounds: 6,
    withFinal: true,
    finishedDaysAgo: 40,
  });
  const t3 = await simulateFinishedTournament(club._id, {
    name: "Americano Team Cup",
    type: "americano-team",
    playerNames: PLAYER_NAMES.slice(2, 18),
    courts: ["Center Court", "Panorama", "Riverside", "Sunset"],
    matchPoints: 32,
    regularRounds: 5,
    withFinal: true,
    finishedDaysAgo: 12,
  });

  // Live tournament: two completed rounds, third round waiting for results.
  const liveType: TournamentType = "mexicano";
  const livePlayers = PLAYER_NAMES.slice(0, 8);
  const liveEntrants = makeEntrants(liveType, livePlayers);
  const liveCourts = ["Court 1", "Court 2"];
  const liveRounds: EngineRound[] = [];
  for (let r = 0; r < 2; r++) {
    const round = generateNextRound({
      type: liveType,
      entrants: liveEntrants,
      courts: liveCourts,
      rounds: liveRounds,
    });
    for (const m of round.matches) {
      const [a, b] = randomScore(21);
      m.scoreA = a;
      m.scoreB = b;
    }
    liveRounds.push(round);
  }
  liveRounds.push(
    generateNextRound({
      type: liveType,
      entrants: liveEntrants,
      courts: liveCourts,
      rounds: liveRounds,
    })
  );
  const live = await Tournament.create({
    clubId: club._id,
    name: "Wednesday Mexicano Night",
    type: liveType,
    matchPoints: 21,
    courts: liveCourts,
    entrants: liveEntrants,
    rounds: liveRounds,
    status: "active",
    playedAt: new Date(),
  });
  console.log(`  ✔ ${live.name} (live, round 3 in progress)`);

  // Manual ranking adjustments to demo manager point editing.
  await RankingEntry.create({
    clubId: club._id,
    playerName: "Maria Nowak",
    points: 25,
    kind: "adjustment",
    note: "Club challenge winner — monthly bonus",
    date: daysAgo(20),
  });
  await RankingEntry.create({
    clubId: club._id,
    playerName: "Carlos Díaz",
    points: -10,
    kind: "adjustment",
    note: "Correction of misreported result",
    date: daysAgo(8),
  });

  const auditRows = [
    { action: "club.create", message: `Created club "${club.name}"`, clubId: club._id },
    { action: "players.import", message: `Imported ${PLAYER_NAMES.length} players from CSV`, clubId: club._id },
    { action: "tournament.create", message: `Created tournament "${t1.name}"`, clubId: club._id, tournamentId: t1._id },
    { action: "tournament.close", message: `Closed "${t1.name}" and awarded ranking points`, clubId: club._id, tournamentId: t1._id },
    { action: "tournament.close", message: `Closed "${t2.name}" and awarded ranking points`, clubId: club._id, tournamentId: t2._id },
    { action: "tournament.close", message: `Closed "${t3.name}" and awarded ranking points`, clubId: club._id, tournamentId: t3._id },
    { action: "ranking.adjust", message: "Adjusted ranking points for Maria Nowak (+25)", clubId: club._id },
    { action: "tournament.create", message: `Created tournament "${live.name}"`, clubId: club._id, tournamentId: live._id },
  ];
  for (const row of auditRows) {
    await AuditLog.create({ actorEmail: SUPERADMIN, ...row });
  }

  const entryCount = await RankingEntry.countDocuments({ clubId: club._id });
  console.log(`Ranking entries: ${entryCount}`);
  console.log("\nDone. Demo data:");
  console.log(`  Club page:        /club/${club.slug}`);
  console.log(`  Live tournament:  /t/${live._id}`);
  console.log(`  Superadmin/manager: ${SUPERADMIN}`);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
