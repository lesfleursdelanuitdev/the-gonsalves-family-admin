import { getLibApiBaseUrl } from "@/lib/admin/lib-api-export";

export type LibApiValidationError = {
  Severity: number;
  Code: string;
  Message: string;
  Xref: string;
  /** From ligneous-gedcom-lib `ValidationError.RelatedXref` (JSON). */
  RelatedXref?: string;
  /** From ligneous-gedcom-lib `ValidationError.AssociatedXrefs` (JSON). */
  AssociatedXrefs?: string[];
  /** From ligneous-gedcom-lib `ValidationError.Details` (JSON). */
  Details?: Record<string, string>;
};

export type LibApiValidateResponse = {
  valid: boolean;
  errors: LibApiValidationError[];
  counts: { errors: number; warnings: number; hints: number };
};

/** POST multipart `file` to ligneous-gedcom-lib-api `/api/v1/validate`. */
export async function postLibApiValidateGedcomFile(file: Blob, filename: string): Promise<LibApiValidateResponse> {
  const base = getLibApiBaseUrl();
  const fd = new FormData();
  fd.append("file", file, filename || "upload.ged");
  const res = await fetch(`${base}/api/v1/validate`, {
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
      /* keep text */
    }
    throw new Error(`Validate failed (${res.status}): ${detail}`);
  }
  return JSON.parse(text) as LibApiValidateResponse;
}
