import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { parseNoteLinkedEntityIdParam } from "@/lib/admin/admin-notes-filter";
import { parseListParams } from "@/lib/admin/admin-list-params";
import {
  linkOpenQuestionToEntity,
  listOpenQuestionsForFile,
  OPEN_QUESTION_DETAIL_INCLUDE,
  parseOpenQuestionStatusParam,
  isOpenQuestionEntityType,
} from "@/lib/admin/open-questions";

export const GET = withAdminAuth(async (req) => {
  await requireCan({ entity: "openQuestion", action: "read", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;
  const status = parseOpenQuestionStatusParam(searchParams.get("status"));
  const q = searchParams.get("q")?.trim() || null;
  const { limit, offset } = parseListParams(searchParams);
  const linkedIndividualId = parseNoteLinkedEntityIdParam(searchParams, "linkedIndividualId");
  const linkedFamilyId = parseNoteLinkedEntityIdParam(searchParams, "linkedFamilyId");
  const linkedEventId = parseNoteLinkedEntityIdParam(searchParams, "linkedEventId");
  const linkedMediaId = parseNoteLinkedEntityIdParam(searchParams, "linkedMediaId");
  const linkedSourceId = parseNoteLinkedEntityIdParam(searchParams, "linkedSourceId");
  const linkedNoteId = parseNoteLinkedEntityIdParam(searchParams, "linkedNoteId");

  const { rows, total } = await listOpenQuestionsForFile(fileUuid, {
    status,
    q,
    linkedIndividualId,
    linkedFamilyId,
    linkedEventId,
    linkedMediaId,
    linkedSourceId,
    linkedNoteId,
    limit,
    offset,
  });
  return NextResponse.json({
    openQuestions: rows,
    total,
    hasMore: offset + rows.length < total,
  });
});

export const POST = withAdminAuth(async (req, _user) => {
  await requireCan({ entity: "openQuestion", action: "create", scope: "tree" });
  const fileUuid = await getAdminFileUuid();
  const body = (await req.json()) as Record<string, unknown>;
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }
  const details = typeof body.details === "string" ? body.details : body.details == null ? null : String(body.details);

  const initialLinks = Array.isArray(body.initialLinks) ? body.initialLinks : [];

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.openQuestion.create({
      data: {
        fileUuid,
        question,
        details: details && String(details).trim() ? String(details).trim() : null,
      },
      include: OPEN_QUESTION_DETAIL_INCLUDE,
    });

    for (const raw of initialLinks) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      const et = typeof o.entityType === "string" ? o.entityType : "";
      const eid = typeof o.entityId === "string" ? o.entityId : "";
      if (!isOpenQuestionEntityType(et) || !eid) continue;
      await linkOpenQuestionToEntity(tx, fileUuid, row.id, et, eid);
    }

    return tx.openQuestion.findFirstOrThrow({
      where: { id: row.id },
      include: OPEN_QUESTION_DETAIL_INCLUDE,
    });
  });

  return NextResponse.json({ openQuestion: created }, { status: 201 });
});
