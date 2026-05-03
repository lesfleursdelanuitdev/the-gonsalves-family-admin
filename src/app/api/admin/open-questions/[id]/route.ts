import { NextResponse } from "next/server";
import type { OpenQuestionStatus, Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import {
  archiveOpenQuestion,
  linkOpenQuestionToEntity,
  markOpenQuestionResolved,
  OPEN_QUESTION_DETAIL_INCLUDE,
  reopenOpenQuestion,
  unlinkOpenQuestionFromEntity,
  isOpenQuestionEntityType,
} from "@/lib/admin/open-questions";

function parseStatus(v: unknown): OpenQuestionStatus | undefined {
  if (v !== "open" && v !== "resolved" && v !== "archived") return undefined;
  return v;
}

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const openQuestion = await prisma.openQuestion.findFirst({
    where: { id, fileUuid },
    include: OPEN_QUESTION_DETAIL_INCLUDE,
  });
  if (!openQuestion) {
    return NextResponse.json({ error: "Open question not found" }, { status: 404 });
  }
  return NextResponse.json({ openQuestion });
});

export const PATCH = withAdminAuth(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;

  const existing = await prisma.openQuestion.findFirst({ where: { id, fileUuid } });
  if (!existing) {
    return NextResponse.json({ error: "Open question not found" }, { status: 404 });
  }

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  if (action === "resolve") {
    const resolution = typeof body.resolution === "string" ? body.resolution : "";
    try {
      await markOpenQuestionResolved(prisma, fileUuid, id, resolution, user.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const openQuestion = await prisma.openQuestion.findFirstOrThrow({
      where: { id },
      include: OPEN_QUESTION_DETAIL_INCLUDE,
    });
    return NextResponse.json({ openQuestion });
  }
  if (action === "reopen") {
    try {
      await reopenOpenQuestion(prisma, fileUuid, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const openQuestion = await prisma.openQuestion.findFirstOrThrow({
      where: { id },
      include: OPEN_QUESTION_DETAIL_INCLUDE,
    });
    return NextResponse.json({ openQuestion });
  }
  if (action === "archive") {
    try {
      await archiveOpenQuestion(prisma, fileUuid, id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const openQuestion = await prisma.openQuestion.findFirstOrThrow({
      where: { id },
      include: OPEN_QUESTION_DETAIL_INCLUDE,
    });
    return NextResponse.json({ openQuestion });
  }

  const link = body.link;
  if (link && typeof link === "object") {
    const o = link as Record<string, unknown>;
    const et = typeof o.entityType === "string" ? o.entityType : "";
    const eid = typeof o.entityId === "string" ? o.entityId : "";
    if (!isOpenQuestionEntityType(et) || !eid) {
      return NextResponse.json({ error: "Invalid link payload" }, { status: 400 });
    }
    try {
      await linkOpenQuestionToEntity(prisma, fileUuid, id, et, eid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to link";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const unlink = body.unlink;
  if (unlink && typeof unlink === "object") {
    const o = unlink as Record<string, unknown>;
    const et = typeof o.entityType === "string" ? o.entityType : "";
    const eid = typeof o.entityId === "string" ? o.entityId : "";
    if (!isOpenQuestionEntityType(et) || !eid) {
      return NextResponse.json({ error: "Invalid unlink payload" }, { status: 400 });
    }
    try {
      await unlinkOpenQuestionFromEntity(prisma, fileUuid, id, et, eid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to unlink";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  const data: Record<string, unknown> = {};
  if ("question" in body) {
    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ error: "question must be a non-empty string" }, { status: 400 });
    }
    data.question = body.question.trim();
  }
  if ("details" in body) {
    if (body.details == null) data.details = null;
    else if (typeof body.details === "string") data.details = body.details.trim() || null;
    else return NextResponse.json({ error: "details must be a string or null" }, { status: 400 });
  }
  if ("resolution" in body) {
    if (body.resolution == null) data.resolution = null;
    else if (typeof body.resolution === "string") data.resolution = body.resolution.trim() || null;
    else return NextResponse.json({ error: "resolution must be a string or null" }, { status: 400 });
  }
  if ("status" in body) {
    const st = parseStatus(body.status);
    if (!st) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    data.status = st;
    if (st === "resolved") {
      const resText =
        typeof body.resolution === "string" && body.resolution.trim()
          ? body.resolution.trim()
          : typeof existing.resolution === "string" && existing.resolution.trim()
            ? existing.resolution.trim()
            : "";
      if (!resText) {
        return NextResponse.json(
          { error: "resolution is required when status is resolved" },
          { status: 400 },
        );
      }
      data.resolution = resText;
      data.resolvedAt = new Date();
      data.resolvedById = user.id;
    }
  }

  const hasFieldPatch = Object.keys(data).length > 0;
  if (!hasFieldPatch && !link && !unlink) {
    return NextResponse.json({ error: "No valid fields or actions" }, { status: 400 });
  }

  if (hasFieldPatch) {
    await prisma.openQuestion.update({
      where: { id },
      data: data as Prisma.OpenQuestionUpdateInput,
    });
  }

  const openQuestion = await prisma.openQuestion.findFirstOrThrow({
    where: { id },
    include: OPEN_QUESTION_DETAIL_INCLUDE,
  });
  return NextResponse.json({ openQuestion });
});

export const DELETE = withAdminAuth(async (_req, _user, ctx) => {
  const { id } = await ctx.params;
  const fileUuid = await getAdminFileUuid();
  const existing = await prisma.openQuestion.findFirst({ where: { id, fileUuid } });
  if (!existing) {
    return NextResponse.json({ error: "Open question not found" }, { status: 404 });
  }
  await prisma.openQuestion.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
});
