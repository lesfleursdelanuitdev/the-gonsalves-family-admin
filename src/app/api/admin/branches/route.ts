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

  const [branches, lastRun] = await Promise.all([
    prisma.gedcomBranch.findMany({
      where: { fileUuid },
      orderBy: { size: "desc" },
      select: {
        id: true,
        branchHash: true,
        name: true,
        size: true,
        isMain: true,
        founderIds: true,
        topSurnames: true,
        earliestYear: true,
        latestYear: true,
        computedAt: true,
      },
    }),
    prisma.gedcomBranchRun.findFirst({
      where: { fileUuid },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, completedAt: true, errorMessage: true },
    }),
  ]);

  const total = branches.reduce((s, b) => s + b.size, 0);

  return NextResponse.json({
    branches,
    stats: {
      totalBranches: branches.length,
      totalIndividualsInBranches: total,
      lastComputedAt: lastRun?.completedAt?.toISOString() ?? null,
      lastError: lastRun?.errorMessage ?? null,
    },
  });
});
