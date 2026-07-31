import { NextRequest, NextResponse } from "next/server";
import { apiError, HttpError } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hasPlayerDataForEmail, signDeletionToken } from "@/lib/data-deletion";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A deletion email is a mild abuse vector (spam someone's inbox), so cap it.
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_MS = 60 * 60 * 1000; // per hour per IP

function confirmEmailHtml(link: string): string {
  return `
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0a1425">
      <h2 style="color:#0a1425">Confirm your urPadel data deletion</h2>
      <p>We received a request to delete the player profile and ranking history
         associated with this email address on urPadel.</p>
      <p>If this was you, confirm below. <strong>This permanently removes your
         data and cannot be undone.</strong></p>
      <p style="margin:28px 0">
        <a href="${link}" style="background:#0a1425;color:#d9f954;text-decoration:none;
           padding:12px 22px;border-radius:10px;font-weight:700;display:inline-block">
          Review &amp; confirm deletion
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">This link expires in 1 hour. If you
         didn't request this, you can safely ignore this email — nothing will be
         deleted.</p>
    </div>`;
}

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`data-deletion:${clientIp(req)}`, REQUEST_LIMIT, REQUEST_WINDOW_MS)) {
      throw new HttpError(429, "Too many requests — please try again later.");
    }

    const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
    if (!body || typeof body !== "object") throw new HttpError(400, "Invalid JSON body.");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) throw new HttpError(400, "Enter a valid email address.");

    // Only email addresses that actually have data — avoids spamming strangers
    // whose address someone typo'd. The response is identical either way, so it
    // never reveals to the requester whether an address is in the system.
    if (await hasPlayerDataForEmail(email)) {
      const token = signDeletionToken(email);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const link = `${siteUrl}/data-deletion/confirm?token=${encodeURIComponent(token)}`;
      if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
        console.warn(`[data-deletion] dev confirm link for ${email}:\n${link}`);
      }
      await sendEmail({
        to: email,
        subject: "Confirm your urPadel data deletion",
        html: confirmEmailHtml(link),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
