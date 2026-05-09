import { NextResponse } from "next/server";
import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const POST = withAdminAuth(async (req, _user, ctx) => {
  const { id: sessionId } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  const session = await prisma.reconciliationSession.findFirst({
    where: { id: sessionId, fileUuid },
  });
  if (!session) {
    return NextResponse.json({ error: "Reconciliation session not found" }, { status: 404 });
  }
  if (session.status === "applied") {
    return NextResponse.json({ error: "Session is already applied" }, { status: 409 });
  }
  if (!session.mergePlanJson) {
    return NextResponse.json({ error: "Session has no merge plan yet" }, { status: 400 });
  }

  const payload: Prisma.InputJsonValue = {
    note: note || null,
    previousStatus: session.status,
    at: new Date().toISOString(),
  };

  try {
    await prisma.$transaction([
      prisma.reconciliationApplyLog.create({
        data: {
          sessionId: session.id,
          step: "mark_applied",
          payload,
        },
      }),
      prisma.reconciliationSession.update({
        where: { id: session.id },
        data: {
          status: "applied",
          appliedAt: new Date(),
          applyError: null,
        },
      }),
    ]);
  } catch (e) {
    console.error("reconciliation apply transaction:", e);
    return NextResponse.json({ error: "Apply failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessionId: session.id });
});
