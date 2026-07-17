import { dbConnect } from "./db";
import { AuditLog } from "./models";

/**
 * Records an action in the audit log (shown in the super admin panel).
 * Never throws — logging must not break the main operation.
 */
export async function logAction(entry: {
  actorEmail?: string | null;
  action: string;
  message: string;
  clubId?: string | null;
  tournamentId?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await dbConnect();
    await AuditLog.create({
      actorEmail: entry.actorEmail ?? "system",
      action: entry.action,
      message: entry.message,
      clubId: entry.clubId ?? undefined,
      tournamentId: entry.tournamentId ?? undefined,
      meta: entry.meta,
    });
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
