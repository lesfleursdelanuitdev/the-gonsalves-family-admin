import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { CHECK_KEYS } from "@/lib/health/checks";

export const POST = withAdminAuth(async (req, user) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const body = await req.json().catch(() => ({}));
  const { checkKey, recordId, reason } = body as Record<string, unknown>;

  if (typeof checkKey !== "string" || !CHECK_KEYS.includes(checkKey)) {
    return NextResponse.json({ error: "Invalid checkKey" }, { status: 400 });
  }
  if (typeof recordId !== "string" || !recordId) {
    return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  }

  const suppression = await prisma.siteHealthSuppression.upsert({
    where: { checkKey_recordId: { checkKey, recordId } },
    create: {
      checkKey,
      recordId,
      reason: typeof reason === "string" ? reason.trim() || null : null,
      suppressedBy: user.id,
    },
    update: {
      reason: typeof reason === "string" ? reason.trim() || null : null,
      suppressedBy: user.id,
    },
  });

  return NextResponse.json({ suppression });
});
