import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import type { CheckResult } from "@/lib/health/types";

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const run = await prisma.siteHealthRun.findFirst({
    orderBy: { startedAt: "desc" },
    where: { completedAt: { not: null } },
  });

  if (!run) return NextResponse.json(null);

  const results = (run.results ?? []) as CheckResult[];
  const totalIssues = results.reduce((s, r) => s + Math.max(0, r.count), 0);

  return NextResponse.json({
    id: run.id,
    triggeredBy: run.triggeredBy,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    results,
    totalIssues,
  });
});
