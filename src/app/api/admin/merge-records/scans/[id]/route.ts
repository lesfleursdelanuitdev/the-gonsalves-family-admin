import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import type { InternalDuplicatePair, InternalDuplicateScanSummary } from "@/lib/admin/gedcom-internal-scan";

/** GET /api/admin/merge-records/scans/[id] — get scan with full pairs */
export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const scan = await prisma.internalDuplicateScan.findFirst({ where: { id, fileUuid } });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const pairs = (scan.pairsJson ?? []) as InternalDuplicatePair[];
  const resolutions = (scan.resolutionsJson ?? {}) as Record<string, string>;

  const summary: InternalDuplicateScanSummary = {
    total: pairs.length,
    exactName: pairs.filter((p) => p.matchReason === "exact_name").length,
    nameAndBirthYear: pairs.filter((p) => p.matchReason === "name_and_birth_year").length,
    similarNameBirthYear: pairs.filter((p) => p.matchReason === "similar_name_birth_year").length,
  };

  return NextResponse.json({
    id: scan.id,
    status: scan.status,
    scanType: scan.scanType,
    triggeredBy: scan.triggeredBy,
    startedAt: scan.startedAt.toISOString(),
    completedAt: scan.completedAt?.toISOString() ?? null,
    appliedAt: scan.appliedAt?.toISOString() ?? null,
    summary,
    pairs,
    resolutions,
  });
});
