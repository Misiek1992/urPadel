import { NextRequest, NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError, requireSuperAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ClubJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
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

    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_RE.test(email))
      throw new HttpError(400, "A valid email address is required.");

    const existing = (club.managerEmails as string[]).map((m) => m.toLowerCase());
    if (!existing.includes(email)) {
      club.managerEmails.push(email);
      await club.save();
    }

    await logAction({
      actorEmail,
      action: "club.managers.add",
      clubId,
      message: `Added manager ${email} to club "${club.name}".`,
    });

    return NextResponse.json({ club: serialize<ClubJSON>(club) });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(
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

    const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
    if (!email) throw new HttpError(400, "Email query parameter is required.");

    club.managerEmails = (club.managerEmails as string[]).filter(
      (m) => m.toLowerCase() !== email
    );
    await club.save();

    await logAction({
      actorEmail,
      action: "club.managers.remove",
      clubId,
      message: `Removed manager ${email} from club "${club.name}".`,
    });

    return NextResponse.json({ club: serialize<ClubJSON>(club) });
  } catch (e) {
    return apiError(e);
  }
}
