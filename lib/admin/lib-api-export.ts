const EXPORT_FORMATS = ["gedcom", "json", "csv"] as const;
export type LibApiExportFormat = (typeof EXPORT_FORMATS)[number];

export function getLibApiBaseUrl(): string {
  return (process.env.LIB_API_URL ?? "http://127.0.0.1:8092").replace(/\/$/, "");
}

export async function postLibApiExport(
  enriched: Record<string, unknown>,
  format: LibApiExportFormat,
  filename: string,
): Promise<ArrayBuffer> {
  const base = getLibApiBaseUrl();
  const res = await fetch(`${base}/api/v1/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enriched, format, filename }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Export ${format} failed (${res.status}): ${detail.slice(0, 800)}`);
  }
  return res.arrayBuffer();
}
