/**
 * Lineage detection via directed pedigree traversal in the Python API.
 * Calls POST /api/lineages/compute and returns a summary.
 */

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? "http://127.0.0.1:5001").replace(/\/$/, "");

export type LineageDetectionSummary = {
  type: "lineage-detection";
  totalLineages: number;
  newLineages: number;
  mergedLineages: number;
  updatedLineages: number;
  bridgeChildren: number;
};

type ApiResponse = {
  status: string;
  totalLineages: number;
  newLineages: number;
  mergedLineages: number;
  updatedLineages: number;
  bridgeChildren: number;
};

export async function runLineageDetection(
  fileUuid: string,
  triggeredBy: "manual" | "scheduled" = "manual",
): Promise<LineageDetectionSummary> {
  const res = await fetch(`${PYTHON_API_URL}/api/lineages/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_uuid: fileUuid, triggered_by: triggeredBy }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text;
    try {
      const json = JSON.parse(text) as { error?: string };
      detail = json.error ?? text;
    } catch {
      // use raw text
    }
    throw new Error(`Lineage detection API error (${res.status}): ${detail}`);
  }

  const json = (await res.json()) as ApiResponse;

  return {
    type: "lineage-detection",
    totalLineages: json.totalLineages ?? 0,
    newLineages: json.newLineages ?? 0,
    mergedLineages: json.mergedLineages ?? 0,
    updatedLineages: json.updatedLineages ?? 0,
    bridgeChildren: json.bridgeChildren ?? 0,
  };
}
