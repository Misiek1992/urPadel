import { NextResponse } from "next/server";
import { apiError, getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await getViewer();
    return NextResponse.json(viewer);
  } catch (e) {
    return apiError(e);
  }
}
