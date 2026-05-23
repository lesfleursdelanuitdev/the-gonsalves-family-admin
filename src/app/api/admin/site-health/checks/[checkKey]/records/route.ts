import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getCheck, buildCheckContext } from "@/lib/health/checks";

const DEFAULT_LIMIT = 50;

export const GET = withAdminAuth(async (req, _user, ctx) => {
  const { checkKey } = await ctx.params;
  const check = checkKey ? getCheck(checkKey) : undefined;
  if (!check) return NextResponse.json({ error: "Unknown check" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));

  const context = await buildCheckContext();
  const [records, total] = await Promise.all([
    check.records(context, offset, limit),
    check.count(context),
  ]);

  return NextResponse.json({ checkKey: check.key, records, total, offset, limit });
});
