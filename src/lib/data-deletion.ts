// Self-service data deletion (GDPR erasure).
//
// Flow: a visitor enters their email → we email a signed, time-limited
// confirmation link → they click it and press "confirm" → the confirm POST
// verifies the token and runs the deletion. The token IS the authorization:
// only the owner of the mailbox can receive it, so the deletion endpoint
// needs no session. Tokens are stateless (HMAC-signed, no DB record) and
// idempotent to redeem, so there's nothing to persist or clean up.
//
// Scope (per product decision): removes the person's ClubPlayer profile(s)
// (with their stored email) and their ranking-point history across every
// club. It deliberately does NOT touch finished tournaments' recorded match
// scores (shared multi-player records — deleting them would rewrite other
// players' standings), nor Club.managerEmails / AppUser (access data — a
// public form must not be able to revoke a manager's access or orphan a club).
import { dbConnect } from "./db";
import { ClubPlayer, RankingEntry } from "./models";
import { hmac, verifyHmac } from "./crypto";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Exact-match (case-insensitive) regex for a stored value. */
function exact(value: string): RegExp {
  return new RegExp(`^${escapeRegExp(value)}$`, "i");
}

/** Signs a `email:expiry:sig` token (base64url) proving a deletion request. */
export function signDeletionToken(email: string, now: number = Date.now()): string {
  const emailLower = email.trim().toLowerCase();
  const exp = now + TOKEN_TTL_MS;
  const payload = `${emailLower}:${exp}`;
  const sig = hmac(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/** Returns the email if `token` is a valid, unexpired deletion token, else null. */
export function verifyDeletionToken(token: string, now: number = Date.now()): string | null {
  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    return null;
  }
  // payload = "email:exp"; email addresses don't contain ':', so a 3-part split is safe.
  const parts = decoded.split(":");
  if (parts.length !== 3) return null;
  const [email, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!email || !Number.isFinite(exp) || now > exp) return null;
  if (!verifyHmac(`${email}:${exp}`, sig)) return null;
  return email;
}

export interface DeletionResult {
  players: number;
  rankingEntries: number;
}

/**
 * Deletes the player profile(s) carrying `email` and their ranking entries,
 * across all clubs. Idempotent: re-running for an already-cleared email is a
 * no-op returning zeroes.
 */
export async function deletePlayerDataForEmail(email: string): Promise<DeletionResult> {
  await dbConnect();
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return { players: 0, rankingEntries: 0 };

  const players = (await ClubPlayer.find({ email: exact(emailLower) }).lean()) as unknown as {
    _id: unknown;
    clubId: unknown;
    name: string;
  }[];
  if (players.length === 0) return { players: 0, rankingEntries: 0 };

  let rankingEntries = 0;
  for (const p of players) {
    // Entries link by playerId (awards) or by playerName (older/adjustment
    // entries). Names are unique per club (unique clubId+nameLower index), so
    // matching by name within the same club can only hit this same person.
    const res = await RankingEntry.deleteMany({
      clubId: p.clubId,
      $or: [{ playerId: p._id }, { playerName: exact(p.name) }],
    });
    rankingEntries += res.deletedCount ?? 0;
  }
  await ClubPlayer.deleteMany({ _id: { $in: players.map((p) => p._id) } });

  return { players: players.length, rankingEntries };
}

/** Whether any player data is stored under `email` (used to avoid emailing strangers). */
export async function hasPlayerDataForEmail(email: string): Promise<boolean> {
  await dbConnect();
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return false;
  return Boolean(await ClubPlayer.exists({ email: exact(emailLower) }));
}

/** "a***@example.com" — for audit logs, so we don't re-store the full address. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
