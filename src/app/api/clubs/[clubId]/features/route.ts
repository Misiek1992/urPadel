import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError, requireSuperAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { sanitizeClub, serialize, type ClubJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

// Allowlist of toggleable features and their valid config. Extend this as new
// per-club features are added.
const FEATURES = {
  accountantAssistant: { engines: ["tesseract", "cloud"] as const },
} as const;
type FeatureKey = keyof typeof FEATURES;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireSuperAdmin();
    await dbConnect();

    const club = await Club.findById(clubId);
    if (!club) throw new HttpError(404, "Club not found.");

    const body = (await req.json().catch(() => null)) as {
      feature?: unknown;
      enabled?: unknown;
      ocrEngine?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const feature = body.feature as FeatureKey;
    if (typeof feature !== "string" || !(feature in FEATURES))
      throw new HttpError(400, "Unknown feature.");
    if (typeof body.enabled !== "boolean")
      throw new HttpError(400, "`enabled` must be a boolean.");

    const set: Record<string, unknown> = {
      [`features.${feature}.enabled`]: body.enabled,
    };
    if (feature === "accountantAssistant" && body.ocrEngine !== undefined) {
      if (
        typeof body.ocrEngine !== "string" ||
        !FEATURES.accountantAssistant.engines.includes(body.ocrEngine as never)
      )
        throw new HttpError(400, "Invalid OCR engine.");
      set["features.accountantAssistant.ocrEngine"] = body.ocrEngine;
    }

    await Club.updateOne({ _id: clubId }, { $set: set });

    await logAction({
      actorEmail,
      action: "club.feature.toggle",
      clubId,
      message: `${body.enabled ? "Enabled" : "Disabled"} feature "${feature}" for club "${club.name}".`,
      meta: { feature, enabled: body.enabled, ocrEngine: body.ocrEngine },
    });

    const fresh = await Club.findById(clubId).lean();
    return NextResponse.json({ club: sanitizeClub(serialize<ClubJSON>(fresh)) });
  } catch (e) {
    return apiError(e);
  }
}
