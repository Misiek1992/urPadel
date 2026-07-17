import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { AuditLog } from "@/lib/models";
import {
  apiError,
  getSessionEmail,
  HttpError,
  isSuperAdminEmail,
  requireManagerOf,
} from "@/lib/auth";
import { serialize, type AuditLogJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const email = await getSessionEmail();
    if (!email) throw new HttpError(401, "Sign in required.");
    await dbConnect();

    const clubId = req.nextUrl.searchParams.get("clubId") ?? "";
    const isSuperAdmin = await isSuperAdminEmail(email);
    if (!isSuperAdmin) {
      if (!clubId)
        throw new HttpError(403, "Super admin access required.");
      if (!isValidObjectId(clubId)) throw new HttpError(404, "Club not found.");
      await requireManagerOf(clubId);
    } else if (clubId && !isValidObjectId(clubId)) {
      throw new HttpError(404, "Club not found.");
    }

    const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? 200);
    const limit = Math.min(
      Math.max(Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 200, 1),
      500
    );

    const filter = clubId ? { clubId } : {};
    const logs = await AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ logs: serialize<AuditLogJSON[]>(logs) });
  } catch (e) {
    return apiError(e);
  }
}
