import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import type { InternalDuplicatePair, InternalDuplicateScanSummary } from "@/lib/admin/gedcom-internal-scan";

/** GET /api/admin/merge-records/scans — list scans for current tree */
export const GET = withAdminAuth(async () => {
  const fileUuid = await getAdminFileUuid();
  const scans = await prisma.internalDuplicateScan.findMany({
    where: { fileUuid },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    scans: scans.map((s) => {
      const pairs = (s.pairsJson ?? []) as InternalDuplicatePair[];
      const summary: InternalDuplicateScanSummary = {
        total: pairs.length,
        exactName: pairs.filter((p) => p.matchReason === "exact_name").length,
        nameAndBirthYear: pairs.filter((p) => p.matchReason === "name_and_birth_year").length,
        similarNameBirthYear: pairs.filter((p) => p.matchReason === "similar_name_birth_year").length,
      };
      return {
        id: s.id,
        status: s.status,
        scanType: s.scanType,
        triggeredBy: s.triggeredBy,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString() ?? null,
        appliedAt: s.appliedAt?.toISOString() ?? null,
        summary,
        pairsCount: pairs.length,
      };
    }),
  });
});
