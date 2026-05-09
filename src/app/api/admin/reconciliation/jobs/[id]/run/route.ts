import { NextResponse } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { postLibApiReconcileMergePlan } from "@/lib/admin/lib-api-export";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

function individualCount(doc: unknown): number | null {
  if (!doc || typeof doc !== "object") return null;
  const ind = (doc as { individuals?: unknown }).individuals;
  return Array.isArray(ind) ? ind.length : null;
}

export const POST = withAdminAuth(async (_req, _user, ctx) => {
  const { id: jobId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();

  const job = await prisma.reconciliationJob.findFirst({
    where: { id: jobId, session: { fileUuid } },
    include: { session: true },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.type !== "build_merge_plan") {
    return NextResponse.json({ error: "Unsupported job type" }, { status: 400 });
  }
  if (job.status === "completed") {
    return NextResponse.json({ job, message: "Job already completed" });
  }
  if (job.status === "running") {
    return NextResponse.json({ error: "Job is already running" }, { status: 409 });
  }

  const session = job.session;
  const left = session.leftSnapshotJson;
  const right = session.rightSnapshotJson;

  await prisma.reconciliationJob.update({
    where: { id: job.id },
    data: {
      status: "running",
      startedAt: new Date(),
      progress: 10,
      progressDetailJson: { phase: "calling_lib_api" },
    },
  });
  await prisma.reconciliationSession.update({
    where: { id: session.id },
    data: {
      progressJson: { phase: "build_merge_plan", done: 1, total: 3 },
    },
  });

  try {
    const { mergePlan } = await postLibApiReconcileMergePlan({
      left,
      right,
      options: session.reconcileOptionsJson ?? undefined,
    });

    const leftN = individualCount(left);
    const rightN = individualCount(right);

    const finishedAt = new Date();

    await prisma.$transaction([
      prisma.reconciliationSession.update({
        where: { id: session.id },
        data: {
          mergePlanJson: mergePlan as Prisma.InputJsonValue,
          leftIndividualCount: leftN ?? undefined,
          rightIndividualCount: rightN ?? undefined,
          progressJson: { phase: "done", message: "merge plan from background job" },
        },
      }),
      prisma.reconciliationJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          progress: 100,
          progressDetailJson: { phase: "done" },
          resultJson: { ok: true } as Prisma.InputJsonValue,
          errorText: null,
          finishedAt,
        },
      }),
    ]);

    const updated = await prisma.reconciliationJob.findFirstOrThrow({
      where: { id: job.id },
      include: { session: { select: { id: true, status: true, progressJson: true } } },
    });
    return NextResponse.json({ job: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.reconciliationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorText: msg.slice(0, 4000),
        finishedAt: new Date(),
        progressDetailJson: { phase: "error", message: msg.slice(0, 500) },
      },
    });
    await prisma.reconciliationSession.update({
      where: { id: session.id },
      data: {
        progressJson: { phase: "failed", message: msg.slice(0, 500) },
        applyError: msg.slice(0, 2000),
      },
    });
    return NextResponse.json({ error: msg.slice(0, 800) }, { status: 502 });
  }
});
