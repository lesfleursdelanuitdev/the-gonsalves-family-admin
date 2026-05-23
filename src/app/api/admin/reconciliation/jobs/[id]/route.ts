import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { postLibApiReconcileMergePlan } from "@/lib/admin/lib-api-export";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "gedcom", action: "merge_records", scope: "gedcom" });
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const job = await prisma.reconciliationJob.findFirst({
    where: { id, session: { fileUuid } },
    include: {
      session: { select: { id: true, status: true, mergePlanJson: true, progressJson: true } },
    },
  });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
});
