import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { apiError, requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export interface ClerkUserSummary {
  id: string;
  name: string;
  email: string;
}

// Lets the superadmin panel search real, registered Clerk users so managers
// can be assigned by picking a person instead of typing raw email addresses.
export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();
    const query = req.nextUrl.searchParams.get("q")?.trim() || undefined;

    const client = await clerkClient();
    const { data } = await client.users.getUserList({
      query,
      limit: 8,
      orderBy: "-created_at",
    });

    const users: ClerkUserSummary[] = data
      .map((u) => {
        const email =
          u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)
            ?.emailAddress ?? u.emailAddresses[0]?.emailAddress;
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
        return email ? { id: u.id, name, email: email.toLowerCase() } : null;
      })
      .filter((u): u is ClerkUserSummary => u !== null);

    return NextResponse.json({ users });
  } catch (e) {
    return apiError(e);
  }
}
