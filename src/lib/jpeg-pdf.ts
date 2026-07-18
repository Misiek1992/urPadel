// Wraps a JPEG image in a minimal, valid single-page PDF — no libraries.
// JPEG data passes straight through as a DCTDecode stream, so the PDF is
// essentially the image plus ~600 bytes of structure. Client-safe.

const encoder = new TextEncoder();

export function jpegToPdf(
  jpeg: Uint8Array,
  pxWidth: number,
  pxHeight: number
): Blob {
  // Render at 144 DPI: a 3120px-wide poster becomes a 1560pt (~55cm) page.
  const ptW = (pxWidth * 72) / 144;
  const ptH = (pxHeight * 72) / 144;

  const parts: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];

  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    parts.push(bytes);
    offset += bytes.length;
  };
  const beginObj = (num: number, body: string) => {
    offsets[num] = offset;
    push(`${num} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker

  beginObj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  beginObj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  beginObj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)}] ` +
      "/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>"
  );

  offsets[4] = offset;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  );
  push(jpeg);
  push("\nendstream\nendobj\n");

  const content = `q ${ptW.toFixed(2)} 0 0 ${ptH.toFixed(2)} 0 0 cm /Im0 Do Q`;
  offsets[5] = offset;
  push(
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`
  );

  const xrefOffset = offset;
  const pad = (n: number) => String(n).padStart(10, "0");
  push(
    "xref\n0 6\n0000000000 65535 f \n" +
      [1, 2, 3, 4, 5].map((n) => `${pad(offsets[n])} 00000 n \n`).join("") +
      `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  );

  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
