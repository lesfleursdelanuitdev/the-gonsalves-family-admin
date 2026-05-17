import { NextRequest, NextResponse } from "next/server";
import { buildEnrichedDocumentForExport } from "@/lib/admin/build-enriched-document-for-export";
import { postLibApiExport } from "@/lib/admin/lib-api-export";
import { postLibApiValidateGedcomFile } from "@/lib/admin/lib-api-validate";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const runtime = "nodejs";

export const POST = withAdminAuth(async (req: NextRequest) => {
  await requireCan({ entity: "gedcom", action: "validate_external", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing file field (multipart form field name: file)" }, { status: 400 });
    }
    try {
      const result = await postLibApiValidateGedcomFile(file, file.name || "upload.ged");
      return NextResponse.json({ source: "upload" as const, filename: file.name, ...result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json(
    { error: "Use multipart/form-data with field file, or POST /api/admin/gedcom/validate/tree" },
    { status: 415 },
  );
});
