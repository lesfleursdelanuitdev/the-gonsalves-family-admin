import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { triggerCronJob, type CronJobId } from "@/lib/admin/cron-jobs";

/** Jobs can run for several minutes. */
export const maxDuration = 600;

const VALID_JOB_IDS = new Set<CronJobId>(["site-health", "backup"]);

export const POST = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const { jobId } = await ctx.params;

  if (!VALID_JOB_IDS.has(jobId as CronJobId)) {
    return NextResponse.json({ error: `Unknown job: ${jobId}` }, { status: 404 });
  }

  try {
    const lastRun = await triggerCronJob(jobId as CronJobId);
    return NextResponse.json({ ok: true, lastRun });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
});
