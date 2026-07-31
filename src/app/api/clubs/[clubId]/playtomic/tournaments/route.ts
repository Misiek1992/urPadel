import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError, requireManagerOf } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { fetchPlaytomicTournaments, PlaytomicError } from "@/lib/playtomic";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS_BACK = 7;
const DEFAULT_DAYS_FORWARD = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  try {
    const { clubId } = await params;
    if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
    await requireManagerOf(clubId);
    await dbConnect();

    const club = await Club.findById(clubId).select("+playtomicSecretEncrypted").lean();
    if (!club) throw new HttpError(404, "Club not found.");
    const c = club as unknown as {
      playtomicClientId?: string | null;
      playtomicTenantId?: string | null;
      playtomicSecretEncrypted?: string | null;
    };
    if (!c.playtomicClientId || !c.playtomicTenantId || !c.playtomicSecretEncrypted) {
      throw new HttpError(400, "Playtomic isn't connected for this club.");
    }

    const daysBack = Number(req.nextUrl.searchParams.get("daysBack")) || DEFAULT_DAYS_BACK;
    const daysForward =
      Number(req.nextUrl.searchParams.get("daysForward")) || DEFAULT_DAYS_FORWARD;

    let tournaments;
    try {
      tournaments = await fetchPlaytomicTournaments(
        {
          clientId: c.playtomicClientId,
          tenantId: c.playtomicTenantId,
          secret: decrypt(c.playtomicSecretEncrypted),
        },
        { daysBack, daysForward }
      );
    } catch (e) {
      if (e instanceof PlaytomicError) {
        return NextResponse.json({ error: e.message }, { status: 502 });
      }
      throw e;
    }

    return NextResponse.json({ tournaments });
  } catch (e) {
    return apiError(e);
  }
}
