import { cache } from "react";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { dbConnect } from "./db";
import { AppUser, Club } from "./models";
import type { ViewerJSON } from "./types";

export const DEFAULT_SUPERADMIN = (
  process.env.SUPERADMIN_EMAIL || "m.ignaczak.92@gmail.com"
).toLowerCase();

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Email of the signed-in Clerk user, lowercased, or null.
 *
 * Wrapped in React `cache()`: the root layout's SiteHeader and the page body
 * both resolve the viewer on every request, so without this every
 * manager/superadmin navigation did the Clerk lookup (and the two queries
 * below) twice. `cache()` dedupes repeat calls within a single request/render
 * — it has no effect across requests, so session changes are picked up as
 * usual on the next navigation.
 */
export const getSessionEmail = cache(async (): Promise<string | null> => {
  try {
    const user = await currentUser();
    const email =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
});

export const isSuperAdminEmail = cache(
  async (email: string | null): Promise<boolean> => {
    if (!email) return false;
    if (email === DEFAULT_SUPERADMIN) return true;
    try {
      await dbConnect();
      return Boolean(await AppUser.exists({ email, role: "superadmin" }));
    } catch {
      return false;
    }
  }
);

/** Who is viewing: email, superadmin flag, and clubs they manage (superadmins manage all). */
export const getViewer = cache(async (): Promise<ViewerJSON> => {
  const email = await getSessionEmail();
  if (!email) return { email: null, isSuperAdmin: false, managedClubs: [] };
  const isSuperAdmin = await isSuperAdminEmail(email);
  try {
    await dbConnect();
    const clubs = isSuperAdmin
      ? await Club.find({}, "name slug").sort({ name: 1 }).lean()
      : await Club.find({ managerEmails: email }, "name slug").sort({ name: 1 }).lean();
    return {
      email,
      isSuperAdmin,
      managedClubs: (clubs as any[]).map((c) => ({
        _id: String(c._id),
        name: c.name,
        slug: c.slug,
      })),
    };
  } catch {
    return { email, isSuperAdmin, managedClubs: [] };
  }
});

/** Throws 401/403 unless the viewer is a superadmin. Returns their email. */
export async function requireSuperAdmin(): Promise<string> {
  const email = await getSessionEmail();
  if (!email) throw new HttpError(401, "Sign in required.");
  if (!(await isSuperAdminEmail(email)))
    throw new HttpError(403, "Super admin access required.");
  return email;
}

/**
 * Throws 401/403/404 unless the viewer is a superadmin or a manager of the
 * given club. Returns their email.
 */
export async function requireManagerOf(clubId: string): Promise<string> {
  const email = await getSessionEmail();
  if (!email) throw new HttpError(401, "Sign in required.");
  if (await isSuperAdminEmail(email)) return email;
  await dbConnect();
  const club = await Club.findById(clubId).lean();
  if (!club) throw new HttpError(404, "Club not found.");
  const managers = ((club as any).managerEmails ?? []).map((m: string) =>
    m.toLowerCase()
  );
  if (!managers.includes(email))
    throw new HttpError(403, "You are not a manager of this club.");
  return email;
}

/** Standard error response for API route catch blocks. */
export function apiError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(e);
  const message = e instanceof Error ? e.message : "Internal server error";
  return NextResponse.json({ error: message }, { status: 500 });
}
