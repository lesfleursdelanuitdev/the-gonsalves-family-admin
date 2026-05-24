import { NextResponse } from "next/server";
import { runBranchDetection } from "@/lib/admin/branch-detection";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const fileUuid = await getAdminFileUuid();
    const summary = await runBranchDetection(fileUuid, "scheduled");
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
