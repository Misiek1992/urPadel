import { NextRequest, NextResponse } from "next/server";
import { dbConnect } from "@/lib/db";
import { Club } from "@/lib/models";
import { apiError, HttpError, requireSuperAdmin } from "@/lib/auth";
import { logAction } from "@/lib/audit";
import { serialize, type ClubJSON } from "@/lib/types";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET() {
  try {
    await dbConnect();
    const clubs = await Club.find({}).sort({ name: 1 }).lean();
    return NextResponse.json({ clubs: serialize<ClubJSON[]>(clubs) });
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actorEmail = await requireSuperAdmin();
    await dbConnect();
    const body = (await req.json().catch(() => null)) as {
      name?: unknown;
      slug?: unknown;
      city?: unknown;
      description?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new HttpError(400, "Club name is required.");

    const slugSource =
      typeof body.slug === "string" && body.slug.trim() ? body.slug : name;
    const slug = slugify(slugSource);
    if (!slug)
      throw new HttpError(400, "Could not derive a valid slug. Provide one explicitly.");
    if (await Club.exists({ slug }))
      throw new HttpError(409, `A club with the slug "${slug}" already exists.`);

    const city = typeof body.city === "string" ? body.city.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";

    const club = await Club.create({
      name,
      slug,
      city: city || undefined,
      description: description || undefined,
      managerEmails: [],
    });

    await logAction({
      actorEmail,
      action: "club.create",
      clubId: String(club._id),
      message: `Created club "${name}" (slug: ${slug}).`,
    });

    return NextResponse.json({ club: serialize<ClubJSON>(club) });
  } catch (e) {
    return apiError(e);
  }
}
