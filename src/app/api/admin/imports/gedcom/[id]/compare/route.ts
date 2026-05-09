import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { buildEnrichedDocumentForExport } from "@/lib/admin/build-enriched-document-for-export";
import { buildImportMergePlanFromMergePlan } from "@/lib/admin/gedcom-import-merge-plan";
import { postLibApiReconcileMergePlan } from "@/lib/admin/lib-api-export";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const row = await prisma.pendingGedcomImport.findFirst({ where: { id, fileUuid } });
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (row.status === "discarded" || row.status === "applied") {
    return NextResponse.json({ error: "Import is closed" }, { status: 409 });
  }

  const snap = row.canonicalSnapshotJson as Record<string, unknown>;
  const importEnriched = snap?.enriched as Record<string, unknown> | undefined;
  if (!importEnriched) {
    return NextResponse.json({ error: "Import snapshot missing enriched payload" }, { status: 400 });
  }

  const file = await prisma.gedcomFile.findFirst({
    where: { id: fileUuid },
    select: { name: true },
  });
  const treeLabel = file?.name ?? "Current tree";

  let treeEnriched: Record<string, unknown>;
  try {
    treeEnriched = await buildEnrichedDocumentForExport(fileUuid);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Failed to load tree: ${msg.slice(0, 800)}` }, { status: 500 });
  }

  let mergePlan: unknown;
  try {
    const out = await postLibApiReconcileMergePlan({
      left: treeEnriched,
      right: importEnriched,
      options: {},
    });
    mergePlan = out.mergePlan;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 2000) }, { status: 502 });
  }

  const stats = snap?.stats as Record<string, unknown> | undefined;
  const val = snap?.validation as Record<string, unknown> | undefined;
  const valErrors = val?.errors;
  let validationErrorCount = 0;
  let validationWarningCount = 0;
  if (Array.isArray(valErrors)) {
    for (const e of valErrors) {
      const o = e && typeof e === "object" ? (e as Record<string, unknown>) : null;
      const s = o?.Severity ?? o?.severity;
      const n = typeof s === "number" ? s : Number(s);
      if (n === 2) validationErrorCount++;
      else if (n === 1) validationWarningCount++;
    }
  }

  const importPlan = buildImportMergePlanFromMergePlan({
    importId: row.id,
    fileUuid,
    treeLabel,
    importFilename: row.filename,
    mergePlan,
    treeEnriched,
    importEnriched,
    stats: stats
      ? {
          individuals: Number(stats.individuals) || 0,
          families: Number(stats.families) || 0,
          events: Number(stats.events) || 0,
          notes: Number(stats.notes) || 0,
          media: Number(stats.media) || 0,
        }
      : null,
    validationErrorCount,
    validationWarningCount,
    newCandidateId: () => randomUUID(),
  });

  const updated = await prisma.pendingGedcomImport.update({
    where: { id: row.id },
    data: {
      status: "ready_for_review",
      mergePlanJson: mergePlan as Prisma.InputJsonValue,
      importMergePlanJson: importPlan as Prisma.InputJsonValue,
      resolutionsJson: {},
    },
  });

  return NextResponse.json({ import: updated, importMergePlan: importPlan });
});
