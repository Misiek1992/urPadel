import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { AppUser } from "@/lib/models";
import {
  apiError,
  DEFAULT_SUPERADMIN,
  HttpError,
  requireSuperAdmin,
} from "@/lib/auth";
import { logAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function listEmails(): Promise<string[]> {
  const users = await AppUser.find({ role: "superadmin" }, "email").lean();
  const emails = new Set<string>([DEFAULT_SUPERADMIN]);
  for (const u of users as unknown as { email: string }[])
    emails.add(u.email.toLowerCase());
  return [...emails];
}

export async function GET() {
  try {
    await requireSuperAdmin();
    await dbConnect();
    return NextResponse.json({ emails: await listEmails() });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actorEmail = await requireSuperAdmin();
    await dbConnect();

    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    const email =
      body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !EMAIL_RE.test(email))
      throw new HttpError(400, "A valid email address is required.");

    if (email !== DEFAULT_SUPERADMIN) {
      await AppUser.updateOne(
        { email },
        { $setOnInsert: { email, role: "superadmin" } },
        { upsert: true }
      );
    }

    await logAction({
      actorEmail,
      action: "superadmins.add",
      message: `Granted super admin access to ${email}.`,
    });

    return NextResponse.json({ emails: await listEmails() });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actorEmail = await requireSuperAdmin();
    await dbConnect();

    const email = (req.nextUrl.searchParams.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!email) throw new HttpError(400, "Email query parameter is required.");
    if (email === DEFAULT_SUPERADMIN)
      throw new HttpError(400, "The default super admin cannot be removed.");

    await AppUser.deleteOne({ email, role: "superadmin" });

    await logAction({
      actorEmail,
      action: "superadmins.remove",
      message: `Revoked super admin access for ${email}.`,
    });

    return NextResponse.json({ emails: await listEmails() });
  } catch (e) {
    return apiError(e);
  }
}
