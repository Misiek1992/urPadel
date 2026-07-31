import { NextRequest, NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  deletePlayerDataForEmail,
  maskEmail,
  verifyDeletionToken,
} from "@/lib/data-deletion";

export const dynamic = "force-dynamic";

const CONFIRM_LIMIT = 20;
const CONFIRM_WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`data-deletion-confirm:${clientIp(req)}`, CONFIRM_LIMIT, CONFIRM_WINDOW_MS)) {
      throw new HttpError(429, "Too many requests — please try again later.");
    }

    const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");
    const token = typeof body.token === "string" ? body.token : "";

    const email = verifyDeletionToken(token);
    if (!email) {
      throw new HttpError(400, "This link is invalid or has expired.", "invalid_token");
    }

    const deleted = await deletePlayerDataForEmail(email);

    // Audit the erasure without re-storing the full address (masked).
    await logAction({
      actorEmail: "self-service",
      action: "data.deletion",
      message: `Data deletion completed for ${maskEmail(email)} — removed ${
        deleted.players
      } player profile(s) and ${deleted.rankingEntries} ranking entr${
        deleted.rankingEntries === 1 ? "y" : "ies"
      }.`,
    });

    return NextResponse.json({ deleted });
  } catch (e) {
    return apiError(e);
  }
}
