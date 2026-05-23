import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { runInternalDuplicateScan } from "@/lib/admin/gedcom-internal-scan";
import type { Prisma } from "@ligneous/prisma";

/** POST /api/admin/merge-records/scans/run — run a new duplicate scan */
export const POST = withAdminAuth(async (_req, user) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });

  const fileUuid = await getAdminFileUuid();

  const scan = await prisma.internalDuplicateScan.create({
    data: { fileUuid, triggeredBy: "manual", triggeredByUserId: user.id },
  });

  try {
    const { pairs, summary } = await runInternalDuplicateScan(fileUuid);

    const updated = await prisma.internalDuplicateScan.update({
      where: { id: scan.id },
      data: {
        completedAt: new Date(),
        pairsJson: pairs as unknown as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      startedAt: updated.startedAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
      summary,
      pairsCount: pairs.length,
    });
  } catch (err) {
    await prisma.internalDuplicateScan.delete({ where: { id: scan.id } });
    console.error("Internal duplicate scan failed:", err);
    return NextResponse.json({ error: "Scan failed" }, { status: 500 });
  }
});
