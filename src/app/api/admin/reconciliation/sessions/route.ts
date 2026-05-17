import { NextResponse } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { postLibApiReconcileMergePlan } from "@/lib/admin/lib-api-export";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

function individualCount(doc: unknown): number | null {
  if (!doc || typeof doc !== "object") return null;
  const ind = (doc as { individuals?: unknown }).individuals;
  return Array.isArray(ind) ? ind.length : null;
}

export const GET = withAdminAuth(async (_req) => {
  const fileUuid = await getAdminFileUuid();
  const sessions = await prisma.reconciliationSession.findMany({
    where: { fileUuid },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      jobs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  return NextResponse.json({ sessions });
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const left = body.left;
  const right = body.right;
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return NextResponse.json({ error: "left and right enriched payloads are required" }, { status: 400 });
  }
  const deferred = body.deferred === true;
  const options = body.options;

  if (deferred) {
    const session = await prisma.reconciliationSession.create({
      data: {
        fileUuid,
        status: "draft",
        leftSnapshotJson: left as Prisma.InputJsonValue,
        rightSnapshotJson: right as Prisma.InputJsonValue,
        reconcileOptionsJson:
          options === undefined || options === null
            ? undefined
            : (options as Prisma.InputJsonValue),
        mergePlanJson: undefined,
        progressJson: { phase: "queued", message: "merge plan build deferred to job" },
      },
    });
    const job = await prisma.reconciliationJob.create({
      data: {
        sessionId: session.id,
        type: "build_merge_plan",
        status: "pending",
      },
    });
    return NextResponse.json({ session, job }, { status: 201 });
  }

  const { mergePlan } = await postLibApiReconcileMergePlan({
    left,
    right,
    options: options === undefined ? undefined : options,
  });

  const session = await prisma.reconciliationSession.create({
    data: {
      fileUuid,
      status: "draft",
      leftSnapshotJson: left as Prisma.InputJsonValue,
      rightSnapshotJson: right as Prisma.InputJsonValue,
      reconcileOptionsJson:
        options === undefined || options === null
          ? undefined
          : (options as Prisma.InputJsonValue),
      mergePlanJson: mergePlan as Prisma.InputJsonValue,
      leftIndividualCount: individualCount(left) ?? undefined,
      rightIndividualCount: individualCount(right) ?? undefined,
      progressJson: { phase: "done", message: "merge plan computed synchronously" },
    },
  });

  return NextResponse.json({ session }, { status: 201 });
});
