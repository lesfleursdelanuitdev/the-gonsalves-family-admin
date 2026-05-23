import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { mergeTwoIndividuals } from "@/lib/admin/gedcom-merge-individuals";
import type { InternalDuplicatePair, InternalDuplicateResolution } from "@/lib/admin/gedcom-internal-scan";
import type { Prisma } from "@ligneous/prisma";

/** POST /api/admin/merge-records/scans/[id]/apply — execute all resolved pairs */
export const POST = withAdminAuth(async (_req, user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });

  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const scan = await prisma.internalDuplicateScan.findFirst({ where: { id, fileUuid } });
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  if (scan.status === "applied") return NextResponse.json({ error: "Already applied" }, { status: 409 });
  if (scan.status === "discarded") return NextResponse.json({ error: "Scan was discarded" }, { status: 409 });

  const pairs = (scan.pairsJson ?? []) as InternalDuplicatePair[];
  const resolutions = (scan.resolutionsJson ?? {}) as Record<string, InternalDuplicateResolution>;

  // Check no pair is still review_later
  for (const pair of pairs) {
    const res = resolutions[pair.pairId] ?? "review_later";
    if (res === "review_later") {
      return NextResponse.json(
        { error: `Pair "${pair.aDisplay}" / "${pair.bDisplay}" is still "review_later".`, pairId: pair.pairId },
        { status: 400 },
      );
    }
  }

  let merged = 0;
  let skipped = 0;
  const errors: { pairId: string; error: string }[] = [];

  for (const pair of pairs) {
    const res = resolutions[pair.pairId] ?? "not_duplicate";
    if (res === "not_duplicate") { skipped++; continue; }

    const primaryId = res === "merge_a_into_b" ? pair.individualBId : pair.individualAId;
    const secondaryId = res === "merge_a_into_b" ? pair.individualAId : pair.individualBId;

    try {
      await mergeTwoIndividuals(fileUuid, user.id, primaryId, secondaryId);
      merged++;
    } catch (err) {
      errors.push({ pairId: pair.pairId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  await prisma.internalDuplicateScan.update({
    where: { id },
    data: {
      status: "applied",
      appliedAt: new Date(),
      appliedByUserId: user.id,
      resolutionsJson: resolutions as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ ok: true, merged, skipped, errors });
});
