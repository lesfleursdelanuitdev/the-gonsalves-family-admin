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

function extractAltSelections(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith("__alt__") && typeof v === "string") {
      out[k.slice(7)] = v;
    }
  }
  return out;
}

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const row = await prisma.pendingGedcomImport.findFirst({
    where: { id, fileUuid },
  });
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  const plan = row.importMergePlanJson as unknown as ImportMergePlan | null;
  const defaults = plan?.defaultResolutions ?? {};
  const overrides = asResolutions(row.resolutionsJson);
  const alternativeSelections = extractAltSelections(row.resolutionsJson);
  const effective: Record<string, ImportResolution> = {};
  if (plan?.candidates) {
    for (const c of plan.candidates) {
      effective[c.candidateId] = effectiveResolution(c.candidateId, defaults, overrides);
    }
  }
  return NextResponse.json({ import: row, effectiveResolutions: effective, alternativeSelections });
});

export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const resolutions = body.resolutions;
  if (!resolutions || typeof resolutions !== "object") {
    return NextResponse.json({ error: "resolutions object is required" }, { status: 400 });
  }

  const row = await prisma.pendingGedcomImport.findFirst({ where: { id, fileUuid } });
  if (!row) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }
  if (row.status === "applied" || row.status === "discarded") {
    return NextResponse.json({ error: "Import is closed" }, { status: 409 });
  }

  const rawPrev = (row.resolutionsJson ?? {}) as Record<string, unknown>;
  const prevAlt = extractAltSelections(rawPrev);
  const patch = asResolutions(resolutions);

  // Accept alternativeOverrides: { [candidateId]: existingIndividualId }
  const altOverrides = body.alternativeOverrides;
  const newAlt: Record<string, string> = {};
  if (altOverrides && typeof altOverrides === "object") {
    for (const [candidateId, existingId] of Object.entries(altOverrides as Record<string, unknown>)) {
      if (typeof existingId === "string" && existingId.trim()) {
        newAlt[`__alt__${candidateId}`] = existingId.trim();
      }
    }
  }

  const prevResolutions = asResolutions(rawPrev);
  const merged: Record<string, string> = { ...prevResolutions, ...patch };
  for (const [k, v] of Object.entries(prevAlt)) merged[`__alt__${k}`] = v;
  for (const [k, v] of Object.entries(newAlt)) merged[k] = v;

  const updated = await prisma.pendingGedcomImport.update({
    where: { id: row.id },
    data: { resolutionsJson: merged as Prisma.InputJsonValue },
  });
  return NextResponse.json({ import: updated });
});
