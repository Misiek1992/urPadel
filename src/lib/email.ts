// Transactional email via Resend's REST API — plain fetch, no SDK dependency
// (matches how the Playtomic client is built). Currently used only by the
// self-service data-deletion flow.
//
// Config:
//   RESEND_API_KEY           required to actually send (get one at resend.com)
//   DATA_DELETION_FROM_EMAIL from address, e.g. "urPadel <privacy@yourdomain>"
//                            — must be on a Resend-verified domain in prod;
//                            defaults to Resend's shared test sender otherwise.

const DEFAULT_FROM = "urPadel <onboarding@resend.dev>";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

/**
 * Sends `message`. Throws on a real send failure. In development with no
 * RESEND_API_KEY configured it skips the network call and resolves (the
 * caller logs the link to the server console instead), so the flow is
 * testable locally without an email account; in production a missing key is
 * a hard error rather than a silent no-op.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email service is not configured (RESEND_API_KEY missing).");
    }
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send of "${message.subject}" to ${message.to} (dev only).`
    );
    return;
  }

  const from = process.env.DATA_DELETION_FROM_EMAIL || DEFAULT_FROM;
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html }),
    });
  } catch {
    throw new Error("Could not reach the email service. Please try again.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 300)}`);
  }
}
