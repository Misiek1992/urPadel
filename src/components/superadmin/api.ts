// Small client-side helpers shared by the superadmin mutation components.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Extracts the `{ error }` message from a failed API response. */
export async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown };
    if (data && typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    // Ignore unparsable bodies and fall through to the generic message.
  }
  return `Request failed (${res.status})`;
}

export const NETWORK_ERROR = "Network error — please try again.";
