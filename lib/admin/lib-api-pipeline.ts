import { getLibApiBaseUrl } from "@/lib/admin/lib-api-export";

export type LibApiPipelineResponse = {
  document: unknown;
  warnings: unknown[];
  validation: { valid: boolean; errors: unknown[] };
  enriched: Record<string, unknown>;
  stats: {
    individuals: number;
    families: number;
    dates: number;
    places: number;
    surnames: number;
    given_names: number;
    events: number;
    notes: number;
    sources: number;
    repositories: number;
    media: number;
    event_media: number;
  };
};

/** POST multipart `file` to ligneous-gedcom-lib-api `/api/v1/parse-validate-enrich`. */
export async function postLibApiParseValidateEnrich(
  file: Blob,
  filename: string,
  options?: { generateIds?: boolean },
): Promise<LibApiPipelineResponse> {
  const base = getLibApiBaseUrl();
  const fd = new FormData();
  fd.append("file", file, filename || "upload.ged");
  const gen = options?.generateIds !== false;
  const q = gen ? "?generateIds=true" : "";
  const res = await fetch(`${base}/api/v1/parse-validate-enrich${q}`, {
    method: "POST",
    body: fd,
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 2000);
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* keep */
    }
    throw new Error(`Parse pipeline failed (${res.status}): ${detail}`);
  }
  try {
    return JSON.parse(text) as LibApiPipelineResponse;
  } catch {
    throw new Error(`Parse pipeline returned non-JSON: ${text.slice(0, 300)}`);
  }
}
