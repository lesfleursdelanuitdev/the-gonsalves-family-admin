import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import type { InternalDuplicateResolution } from "@/lib/admin/gedcom-internal-scan";
import type { Prisma } from "@ligneous/prisma";

const VALID_RESOLUTIONS = new Set<string>([
  "merge_a_into_b",
  "merge_b_into_a",
  "not_duplicate",
  "review_later",
]);

/** PATCH /api/admin/merge-records/scans/[id]/resolutions — save resolution overrides */
export const PATCH = withAdminAuth(async (req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const scan = await prisma.internalDuplicateScan.findFirst({ where: { id, fileUuid } });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (scan.status !== "pending") return NextResponse.json({ error: "Scan is not pending" }, { status: 409 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const incoming = body.resolutions;
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "resolutions object required" }, { status: 400 });
  }

  const current = (scan.resolutionsJson ?? {}) as Record<string, string>;
  for (const [pairId, val] of Object.entries(incoming as Record<string, unknown>)) {
    if (typeof val === "string" && VALID_RESOLUTIONS.has(val)) {
      current[pairId] = val as InternalDuplicateResolution;
    }
  }

  await prisma.internalDuplicateScan.update({
    where: { id },
    data: { resolutionsJson: current as Prisma.InputJsonValue },
  });

  return NextResponse.json({ ok: true, resolutions: current });
});
