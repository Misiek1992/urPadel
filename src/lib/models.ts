import mongoose, { Schema } from "mongoose";

const ClubSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    city: { type: String, trim: true },
    description: { type: String, trim: true },
    managerEmails: { type: [String], default: [] },
    // Playtomic Third-Party API credentials, for importing tournament
    // rosters. clientId/tenantId are identifiers, not secrets, and are read
    // normally. `secret` is encrypted (src/lib/crypto.ts) and, like
    // Tournament.scorePin below, `select: false` so it's excluded from every
    // query by default — only the routes that actually need it opt in with
    // `.select("+playtomicSecretEncrypted")`.
    playtomicClientId: { type: String, default: null },
    playtomicTenantId: { type: String, default: null },
    playtomicSecretEncrypted: { type: String, default: null, select: false },
    playtomicConnectedAt: { type: Date, default: null },
    // Optional per-club features, toggled by the superadmin. Off for every
    // club by default. Extensible: each feature is its own sub-object with its
    // own config (the first is the Accountant Assistant, which also carries
    // which OCR engine that club should use).
    features: {
      accountantAssistant: {
        enabled: { type: Boolean, default: false },
        ocrEngine: { type: String, enum: ["tesseract", "cloud"], default: "tesseract" },
      },
    },
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

// --- Competitive formats (knockout / groups+knockout / league) -------------
// A `Tie` is a single competitive match with a STABLE `id` (unlike the
// Americano/Mexicano Match, which is addressed by court). Sides may be a
// resolved entrant or a `source` reference (winner-of / group-place) filled in
// as results come in. Scoring is either "points" (a/b, higher wins) or "sets".
const TieSideSchema = new Schema(
  {
    entrantId: { type: String, default: null },
    // { type: "winner"|"loser"|"group", tieId?, group?, place? }
    source: { type: Schema.Types.Mixed, default: null },
  },
  { _id: false }
);
const TieScoreSchema = new Schema(
  {
    a: { type: Number, default: null },
    b: { type: Number, default: null },
    sets: {
      type: [{ a: { type: Number }, b: { type: Number }, _id: false }],
      default: undefined,
    },
  },
  { _id: false }
);
const TieSchema = new Schema(
  {
    id: { type: String, required: true },
    stage: { type: String, enum: ["league", "group", "knockout", "playin"], required: true },
    group: { type: String, default: null },
    round: { type: Number, required: true },
    label: { type: String, default: null },
    court: { type: String, default: null },
    sideA: { type: TieSideSchema, required: true },
    sideB: { type: TieSideSchema, required: true },
    score: { type: TieScoreSchema, default: () => ({}) },
    winner: { type: String, enum: ["A", "B", null], default: null },
  },
  { _id: false }
);
const GroupSchema = new Schema(
  {
    label: { type: String, required: true },
    entrantIds: { type: [String], default: [] },
  },
  { _id: false }
);

const TournamentSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "americano",
        "mexicano",
        "americano-team",
        "mexicano-team",
        "knockout-team",
        "groups-team",
        "league-team",
      ],
      required: true,
    },
    matchPoints: { type: Number, default: 24 },
    courts: { type: [String], default: [] },
    entrants: { type: [EntrantSchema], default: [] },
    rounds: { type: [RoundSchema], default: [] },
    // Competitive formats only (empty for Americano/Mexicano):
    scoring: { type: String, enum: ["points", "sets"], default: null },
    config: { type: Schema.Types.Mixed, default: null },
    groups: { type: [GroupSchema], default: [] },
    ties: { type: [TieSchema], default: [] },
    status: { type: String, enum: ["active", "finished"], default: "active" },
    pointsAwarded: { type: Boolean, default: false },
    playedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null },
    // Who started this tournament — shown publicly on the tournament page.
    // A display name, not an email: unlike everything else in this app
    // (which identifies actors by email, see AuditLog), this field is
    // rendered to signed-out visitors, so a scrapable email address would
    // undercut the same privacy goal as the surname truncation below.
    createdByName: { type: String, default: null },
    // Optional 4-6 digit PIN gating public (non-manager) score entry.
    // `select: false` so it's excluded from every query by default — routes
    // that actually need to check it opt in with `.select("+scorePin")`.
    // Stored plain: it's a low-stakes shared court PIN, not a credential.
    scorePin: { type: String, default: null, select: false },
  },
  { timestamps: true }
);
// Every club-scoped tournament list is `find({clubId}).sort({playedAt:-1})`
// (club page, manager dashboard, the tournaments API) or filtered further by
// status (the /clubs index's per-club active count) — cover both.
TournamentSchema.index({ clubId: 1, playedAt: -1 });
TournamentSchema.index({ clubId: 1, status: 1 });

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
// The manager-scoped activity log filters by clubId before sorting.
AuditLogSchema.index({ clubId: 1, createdAt: -1 });

// Documents uploaded to a club's Accountant Assistant (invoices, receipts…).
// The raw bytes live in `data` with `select: false` — like the encrypted
// Playtomic secret, they're never shipped in a list query; only the dedicated
// file-download route opts in with `.select("+data")`. Financial PII: every
// route touching these is manager-of-club AND feature-enabled gated.
const AccountantDocumentSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    uploadedByEmail: { type: String, default: null },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    ocrEngine: { type: String, enum: ["tesseract", "cloud"], required: true },
    status: {
      type: String,
      enum: ["uploaded", "processing", "parsed", "failed", "unsupported"],
      default: "uploaded",
    },
    extractedText: { type: String, default: "" },
    // Set later by per-document-type parsing (invoice/receipt/…); null until then.
    documentType: { type: String, default: null },
    parsed: { type: Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);
AccountantDocumentSchema.index({ clubId: 1, createdAt: -1 });

export const Club = mongoose.models.Club || mongoose.model("Club", ClubSchema);
export const ClubPlayer =
  mongoose.models.ClubPlayer || mongoose.model("ClubPlayer", ClubPlayerSchema);
export const RankingEntry =
  mongoose.models.RankingEntry || mongoose.model("RankingEntry", RankingEntrySchema);
export const Tournament =
  mongoose.models.Tournament || mongoose.model("Tournament", TournamentSchema);
export const AppUser = mongoose.models.AppUser || mongoose.model("AppUser", AppUserSchema);
export const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);
export const AccountantDocument =
  mongoose.models.AccountantDocument ||
  mongoose.model("AccountantDocument", AccountantDocumentSchema);
