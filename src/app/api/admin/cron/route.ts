import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { getAllCronJobStatuses } from "@/lib/admin/cron-jobs";

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const jobs = await getAllCronJobStatuses();
  return NextResponse.json({ jobs });
});
