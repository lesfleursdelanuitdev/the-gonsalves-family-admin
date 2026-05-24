import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { prisma } from "@/lib/database/prisma";
import { AdminTreeResolutionError, getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });

  let fileUuid: string;
  try {
    fileUuid = await getAdminFileUuid();
  } catch (e) {
    if (e instanceof AdminTreeResolutionError) {
      return NextResponse.json({ configured: false as const, error: e.message }, { status: 503 });
    }
    throw e;
  }

  const [lineages, lastRun] = await Promise.all([
    prisma.lineage.findMany({
      where: { fileUuid },
      orderBy: { size: "desc" },
      select: {
        id: true,
        lineageHash: true,
        name: true,
        surname: true,
        size: true,
        founderIds: true,
        topSurnames: true,
        earliestYear: true,
        latestYear: true,
        computedAt: true,
      },
    }),
    prisma.lineageRun.findFirst({
      where: { fileUuid },
      orderBy: { startedAt: "desc" },
      select: {
        startedAt: true,
        completedAt: true,
        totalLineages: true,
        bridgeChildren: true,
        errorMessage: true,
      },
    }),
  ]);

  const totalMemberships = lineages.reduce((s, l) => s + l.size, 0);

  return NextResponse.json({
    lineages,
    stats: {
      totalLineages: lineages.length,
      totalMemberships,
      bridgeChildren: lastRun?.bridgeChildren ?? null,
      lastComputedAt: lastRun?.completedAt?.toISOString() ?? null,
      lastError: lastRun?.errorMessage ?? null,
    },
  });
});
