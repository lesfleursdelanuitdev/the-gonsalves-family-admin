import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { runAllChecks, buildCheckContext } from "@/lib/health/checks";
import { sendHealthDigest } from "@/lib/email/health-digest";
import type { CheckResult } from "@/lib/health/types";

export const GET = async (req: Request) => {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await prisma.siteHealthRun.create({
    data: { triggeredBy: "scheduled" },
  });

  try {
    const ctx = await buildCheckContext();
    const results = await runAllChecks(ctx);
    const now = new Date();

    await prisma.siteHealthRun.update({
      where: { id: run.id },
      data: { completedAt: now, results: results as object[] },
    });

    await sendHealthDigest(results, now).catch((err) =>
      console.error("Health digest email failed:", err),
    );

    const totalIssues = results.reduce((s: number, r: CheckResult) => s + Math.max(0, r.count), 0);
    return NextResponse.json({ ok: true, totalIssues, runId: run.id });
  } catch (err) {
    await prisma.siteHealthRun.delete({ where: { id: run.id } });
    console.error("Site health cron failed:", err);
    return NextResponse.json({ error: "Health check run failed" }, { status: 500 });
  }
};
