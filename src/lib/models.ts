import mongoose, { Schema } from "mongoose";

const ClubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, trim: true },
    description: { type: String, trim: true },
    managerEmails: { type: [String], default: [] },
  },
  { timestamps: true }
);

const ClubPlayerSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    name: { type: String, required: true, trim: true },
    nameLower: { type: String, required: true },
    email: { type: String, trim: true },
  },
  { timestamps: true }
);
ClubPlayerSchema.index({ clubId: 1, nameLower: 1 }, { unique: true });

const RankingEntrySchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    playerId: { type: Schema.Types.ObjectId, ref: "ClubPlayer" },
    playerName: { type: String, required: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament" },
    tournamentName: { type: String },
    points: { type: Number, required: true },
    position: { type: Number },
    kind: { type: String, enum: ["tournament", "adjustment"], default: "tournament" },
    note: { type: String },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
RankingEntrySchema.index({ clubId: 1, date: -1 });

const MatchSchema = new Schema(
  {
    court: { type: String, required: true },
    sideA: { type: [String], required: true },
    sideB: { type: [String], required: true },
    scoreA: { type: Number, default: null },
    scoreB: { type: Number, default: null },
  },
  { _id: false }
);

const RoundSchema = new Schema(
  {
    number: { type: Number, required: true },
    isFinal: { type: Boolean, default: false },
    matches: { type: [MatchSchema], default: [] },
    byes: { type: [String], default: [] },
  },
  { _id: false }
);

const EntrantSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    players: { type: [String], default: [] },
  },
  { _id: false }
);

const TournamentSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["americano", "mexicano", "americano-team", "mexicano-team"],
      required: true,
    },
    matchPoints: { type: Number, default: 24 },
    courts: { type: [String], default: [] },
    entrants: { type: [EntrantSchema], default: [] },
    rounds: { type: [RoundSchema], default: [] },
    status: { type: String, enum: ["active", "finished"], default: "active" },
    pointsAwarded: { type: Boolean, default: false },
    playedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const AppUserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["superadmin"], default: "superadmin" },
  },
  { timestamps: true }
);

const AuditLogSchema = new Schema(
  {
    actorEmail: { type: String, default: "system" },
    action: { type: String, required: true },
    message: { type: String, required: true },
    clubId: { type: Schema.Types.ObjectId, ref: "Club" },
    tournamentId: { type: Schema.Types.ObjectId, ref: "Tournament" },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);
AuditLogSchema.index({ createdAt: -1 });

export const Club = mongoose.models.Club || mongoose.model("Club", ClubSchema);
export const ClubPlayer =
  mongoose.models.ClubPlayer || mongoose.model("ClubPlayer", ClubPlayerSchema);
export const RankingEntry =
  mongoose.models.RankingEntry || mongoose.model("RankingEntry", RankingEntrySchema);
export const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", TournamentSchema);
export const AppUser = mongoose.models.AppUser || mongoose.model("AppUser", AppUserSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
