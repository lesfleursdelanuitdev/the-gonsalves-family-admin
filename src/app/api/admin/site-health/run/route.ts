import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { runAllChecks, buildCheckContext } from "@/lib/health/checks";
import type { CheckResult } from "@/lib/health/types";

export const POST = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const run = await prisma.siteHealthRun.create({
    data: { triggeredBy: "manual" },
  });

  try {
    const ctx = await buildCheckContext();
    const results = await runAllChecks(ctx);
    const completed = await prisma.siteHealthRun.update({
      where: { id: run.id },
      data: { completedAt: new Date(), results: results as object[] },
    });

    const totalIssues = results.reduce((s: number, r: CheckResult) => s + Math.max(0, r.count), 0);
    return NextResponse.json({
      id: completed.id,
      triggeredBy: completed.triggeredBy,
      startedAt: completed.startedAt.toISOString(),
      completedAt: completed.completedAt?.toISOString() ?? null,
      results,
      totalIssues,
    });
  } catch (err) {
    await prisma.siteHealthRun.delete({ where: { id: run.id } });
    throw err;
  }
});
