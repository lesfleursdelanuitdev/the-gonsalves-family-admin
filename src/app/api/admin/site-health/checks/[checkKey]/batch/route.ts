import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { getCheck, buildCheckContext } from "@/lib/health/checks";

export const POST = withAdminAuth(async (req, _user, ctx) => {
  // Destructive: batch actions delete or archive records. Requires delete permission.
  await requireCan({ entity: "individual", action: "delete", scope: "tree" });
  const { checkKey } = await ctx.params;
  const check = checkKey ? getCheck(checkKey) : undefined;
  if (!check) return NextResponse.json({ error: "Unknown check" }, { status: 404 });
  if (!check.batchAction) return NextResponse.json({ error: "Check does not support batch actions" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

  const context = await buildCheckContext();
  const affected = await check.batch(context, ids);

  return NextResponse.json({ affected });
});
