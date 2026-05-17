import { NextResponse } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import {
  effectiveResolution,
  type ImportMergePlan,
  type ImportResolution,
} from "@/lib/admin/gedcom-import-merge-plan";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

function asResolutions(v: unknown): Record<string, ImportResolution> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, ImportResolution> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (
      val === "merge_into_existing" ||
      val === "create_new" ||
      val === "skip" ||
      val === "review_later" ||
      val === "mark_not_match"
    ) {
      out[k] = val;
    }
  }
  return out;
}

export const POST = withAdminAuth(async (req, user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  const row = await prisma.pendingGedcomImport.findFirst({ where: { id, fileUuid } });
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (row.status === "discarded") {
    return NextResponse.json({ error: "Import was discarded" }, { status: 409 });
  }
  if (row.status === "applied") {
    return NextResponse.json({ error: "Already applied" }, { status: 409 });
  }
  const plan = row.importMergePlanJson as unknown as ImportMergePlan | null;
  if (!plan?.candidates?.length) {
    return NextResponse.json({ error: "Run compare first (no import merge plan)" }, { status: 400 });
  }

  const defaults = plan.defaultResolutions ?? {};
  const overrides = asResolutions(row.resolutionsJson);
  for (const c of plan.candidates) {
    const r = effectiveResolution(c.candidateId, defaults, overrides);
    if (r === "review_later") {
      return NextResponse.json(
        {
          error: `All rows must be resolved before apply. Candidate "${c.importedDisplay}" is still "review_later".`,
          candidateId: c.candidateId,
        },
        { status: 400 },
      );
    }
  }

  const auditPayload: Prisma.InputJsonValue = {
    at: new Date().toISOString(),
    filename: row.filename,
    note: note || null,
    appliedByUserId: user.id,
    resolutions: { ...defaults, ...overrides } as Record<string, string>,
    persistenceNote:
      "GEDCOM row creation and merge-into-existing persistence are not wired yet; this apply records your decisions for audit and downstream jobs.",
  };

  const prevSnap =
    row.canonicalSnapshotJson && typeof row.canonicalSnapshotJson === "object"
      ? (row.canonicalSnapshotJson as Record<string, unknown>)
      : {};
  const nextSnapshot: Prisma.InputJsonValue = {
    ...prevSnap,
    applyAudit: auditPayload,
  };

  const updated = await prisma.pendingGedcomImport.update({
    where: { id: row.id },
    data: {
      status: "applied",
      appliedAt: new Date(),
      appliedByUserId: user.id,
      importMergePlanJson: plan as unknown as Prisma.InputJsonValue,
      resolutionsJson: { ...defaults, ...overrides } as Prisma.InputJsonValue,
      canonicalSnapshotJson: nextSnapshot,
    },
  });

  return NextResponse.json({
    import: updated,
    applied: true,
    message:
      "Decisions saved as applied. Creating or merging GedcomIndividual rows in the database will follow in a later release.",
  });
});
