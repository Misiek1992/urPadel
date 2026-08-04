// Cloud OCR via Google Cloud Vision's REST API (DOCUMENT_TEXT_DETECTION),
// called with a plain fetch + API key — no SDK, matching the app's dependency
// style. Far better than raw OCR on structured invoices/receipts. Requires
// GOOGLE_VISION_API_KEY; throws a clear error if it's missing so the failure
// surfaces on the document rather than as a silent blank.

const VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

interface VisionResponse {
  responses?: {
    fullTextAnnotation?: { text?: string };
    error?: { message?: string };
  }[];
}

export async function cloudExtract(bytes: Buffer, _mimeType: string): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Cloud OCR isn't configured (GOOGLE_VISION_API_KEY missing). Set it, or switch this club to the self-hosted engine."
    );
  }

  let res: Response;
  try {
    res = await fetch(`${VISION_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: bytes.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    });
  } catch {
    throw new Error("Could not reach the cloud OCR service. Please try again.");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Cloud OCR failed (status ${res.status}): ${body.slice(0, 200)}`);
  }

  const data = (await res.json().catch(() => null)) as VisionResponse | null;
  const first = data?.responses?.[0];
  if (first?.error?.message) throw new Error(`Cloud OCR error: ${first.error.message}`);
  return first?.fullTextAnnotation?.text ?? "";
}
