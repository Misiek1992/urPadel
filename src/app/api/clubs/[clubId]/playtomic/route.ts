import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { decrypt, encrypt } from "@/lib/crypto";
import { getPlaytomicToken, PlaytomicError } from "@/lib/playtomic";
import { sanitizeClub, serialize, type ClubJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const club = await Club.findById(clubId).select("+playtomicSecretEncrypted");
    if (!club) throw new HttpError(404, "Club not found.");

    const body = (await req.json().catch(() => null)) as {
      clientId?: unknown;
      secret?: unknown;
      tenantId?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    if (!clientId) throw new HttpError(400, "Client ID is required.");
    if (!tenantId) throw new HttpError(400, "Tenant ID is required.");

    // Secret is optional on update: leave it blank to keep the one already
    // on file (e.g. when only fixing a typo'd tenant ID).
    const providedSecret = typeof body.secret === "string" ? body.secret.trim() : "";
    let secret: string;
    if (providedSecret) {
      secret = providedSecret;
    } else if (club.playtomicSecretEncrypted) {
      secret = decrypt(club.playtomicSecretEncrypted as string);
    } else {
      throw new HttpError(400, "Secret is required to connect.");
    }

    try {
      await getPlaytomicToken(clientId, secret);
    } catch (e) {
      if (e instanceof PlaytomicError) throw new HttpError(400, e.message);
      throw e;
    }

    await Club.updateOne(
      { _id: clubId },
      {
        $set: {
          playtomicClientId: clientId,
          playtomicTenantId: tenantId,
          playtomicSecretEncrypted: encrypt(secret),
          playtomicConnectedAt: new Date(),
        },
      }
    );

    await logAction({
      actorEmail,
      action: "club.playtomic.connect",
      clubId,
      message: `Connected Playtomic for "${club.name}" (client ${clientId}).`,
    });

    const fresh = await Club.findById(clubId).lean();
    return NextResponse.json({
      club: sanitizeClub(serialize<ClubJSON>(fresh)),
    });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    const actorEmail = await requireManagerOf(clubId);
    await dbConnect();

    const club = await Club.findById(clubId).lean();
    if (!club) throw new HttpError(404, "Club not found.");

    await Club.updateOne(
      { _id: clubId },
      {
        $set: {
          playtomicClientId: null,
          playtomicTenantId: null,
          playtomicSecretEncrypted: null,
          playtomicConnectedAt: null,
        },
      }
    );

    await logAction({
      actorEmail,
      action: "club.playtomic.disconnect",
      clubId,
      message: `Disconnected Playtomic for "${(club as unknown as { name: string }).name}".`,
    });

    const fresh = await Club.findById(clubId).lean();
    return NextResponse.json({
      club: sanitizeClub(serialize<ClubJSON>(fresh)),
    });
  } catch (e) {
    return apiError(e);
  }
}
