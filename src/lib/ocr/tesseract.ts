// Self-hosted OCR via tesseract.js (WASM). No API key, no external service.
// tesseract.js is imported lazily (only when this engine actually runs) so the
// heavy WASM machinery never loads for the cloud path or unrelated requests.
//
// Deployment note: on Vercel this runs server-side and pulls WASM + English
// language data on first use — it works in local dev out of the box, but a
// serverless deploy may need extra function memory/time (or bundled langdata,
// or moving this engine to the browser). The cloud engine avoids all of that.

export async function tesseractExtract(bytes: Buffer): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(bytes);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}
