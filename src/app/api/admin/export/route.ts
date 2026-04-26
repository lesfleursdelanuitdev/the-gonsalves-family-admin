import { NextResponse } from "next/server";
import { buildEnrichedDocumentForExport } from "@/lib/admin/build-enriched-document-for-export";
import { sanitizeExportBasename } from "@/lib/admin/export-filename";
import { postLibApiExport } from "@/lib/admin/lib-api-export";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

const FORMATS = ["gedcom", "json", "csv"] as const;
type ExportFormat = (typeof FORMATS)[number];

function formatToExt(format: ExportFormat): string {
  switch (format) {
    case "gedcom":
      return "ged";
    case "json":
      return "json";
    case "csv":
      return "csv";
    default:
      return "bin";
  }
}

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const { searchParams } = req.nextUrl;
  const formatRaw = (searchParams.get("format") ?? "gedcom").toLowerCase();
  if (!FORMATS.includes(formatRaw as ExportFormat)) {
    return NextResponse.json(
      { error: `Invalid format. Use one of: ${FORMATS.join(", ")}` },
      { status: 400 },
    );
  }
  const format = formatRaw as ExportFormat;

  const filename = sanitizeExportBasename(
    searchParams.get("filename"),
    "tree-export",
  );

  const fileUuid = await getAdminFileUuid();
  const enriched = await buildEnrichedDocumentForExport(fileUuid);

  let body: ArrayBuffer;
  let contentType: string;
  let disposition: string;
  try {
    body = await postLibApiExport(enriched, format, filename);
    contentType = "application/octet-stream";
    disposition = `attachment; filename="${filename}.${formatToExt(format)}"`;
    if (format === "gedcom") contentType = "text/plain; charset=utf-8";
    if (format === "json") contentType = "application/json";
    if (format === "csv") contentType = "text/csv; charset=utf-8";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Export API error:", msg);
    return NextResponse.json(
      { error: "Export service failed", detail: msg.slice(0, 2000) },
      { status: 502 },
    );
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": disposition,
    },
  });
});
