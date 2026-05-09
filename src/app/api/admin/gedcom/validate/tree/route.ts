import { NextResponse } from "next/server";
import { buildEnrichedDocumentForExport } from "@/lib/admin/build-enriched-document-for-export";
import { postLibApiExport } from "@/lib/admin/lib-api-export";
import { postLibApiValidateGedcomFile } from "@/lib/admin/lib-api-validate";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const runtime = "nodejs";

/** Validates the configured admin tree by exporting to GEDCOM (same path as download) then running lib-api validate. */
export const POST = withAdminAuth(async (_req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  try {
    const enriched = await buildEnrichedDocumentForExport(fileUuid);
    const gedcomBuf = await postLibApiExport(enriched, "gedcom", "admin-tree-validate");
    const blob = new Blob([gedcomBuf], { type: "text/plain; charset=utf-8" });
    const result = await postLibApiValidateGedcomFile(blob, "admin-tree.ged");
    return NextResponse.json({ source: "database" as const, fileUuid, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
});
