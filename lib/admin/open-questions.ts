import type { OpenQuestionStatus, Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";

export const OPEN_QUESTION_ENTITY_TYPES = ["individual", "family", "event", "media"] as const;
export type OpenQuestionEntityType = (typeof OPEN_QUESTION_ENTITY_TYPES)[number];

export function isOpenQuestionEntityType(v: string): v is OpenQuestionEntityType {
  return (OPEN_QUESTION_ENTITY_TYPES as readonly string[]).includes(v);
}

export const OPEN_QUESTION_DETAIL_INCLUDE = {
  resolvedBy: { select: { id: true, name: true, username: true } },
  individualLinks: {
    include: { individual: { select: { id: true, fullName: true, xref: true } } },
  },
  familyLinks: {
    include: {
      family: {
        select: {
          id: true,
          xref: true,
          husband: { select: { fullName: true } },
          wife: { select: { fullName: true } },
        },
      },
    },
  },
  eventLinks: {
    include: { event: { select: { id: true, eventType: true, customType: true } } },
  },
  mediaLinks: {
    include: { media: { select: { id: true, title: true, xref: true } } },
  },
} as const;

export type Db = Prisma.TransactionClient | typeof prisma;

export async function assertEntityBelongsToFile(
  db: Db,
  fileUuid: string,
  entityType: OpenQuestionEntityType,
  entityId: string,
): Promise<boolean> {
  switch (entityType) {
    case "individual": {
      const n = await db.gedcomIndividual.count({ where: { id: entityId, fileUuid } });
      return n > 0;
    }
    case "family": {
      const n = await db.gedcomFamily.count({ where: { id: entityId, fileUuid } });
      return n > 0;
    }
    case "event": {
      const n = await db.gedcomEvent.count({ where: { id: entityId, fileUuid } });
      return n > 0;
    }
    case "media": {
      const n = await db.gedcomMedia.count({ where: { id: entityId, fileUuid } });
      return n > 0;
    }
    default:
      return false;
  }
}

function entityWhereClause(
  entityType: OpenQuestionEntityType,
  entityId: string,
): Prisma.OpenQuestionWhereInput {
  switch (entityType) {
    case "individual":
      return { individualLinks: { some: { individualId: entityId } } };
    case "family":
      return { familyLinks: { some: { familyId: entityId } } };
    case "event":
      return { eventLinks: { some: { eventId: entityId } } };
    case "media":
      return { mediaLinks: { some: { mediaId: entityId } } };
    default:
      return { id: "__none__" };
  }
}

export async function getOpenQuestionsForEntity(
  fileUuid: string,
  entityType: OpenQuestionEntityType,
  entityId: string,
): Promise<
  Prisma.OpenQuestionGetPayload<{ include: typeof OPEN_QUESTION_DETAIL_INCLUDE }>[]
> {
  return prisma.openQuestion.findMany({
    where: {
      fileUuid,
      ...entityWhereClause(entityType, entityId),
    },
    include: OPEN_QUESTION_DETAIL_INCLUDE,
    orderBy: { updatedAt: "desc" },
  });
}

export async function linkOpenQuestionToEntity(
  db: Db,
  fileUuid: string,
  questionId: string,
  entityType: OpenQuestionEntityType,
  entityId: string,
): Promise<void> {
  const q = await db.openQuestion.findFirst({ where: { id: questionId, fileUuid } });
  if (!q) throw new Error("Open question not found");
  const ok = await assertEntityBelongsToFile(db, fileUuid, entityType, entityId);
  if (!ok) throw new Error("Entity not found for this tree");

  try {
    switch (entityType) {
      case "individual":
        await db.openQuestionIndividual.create({
          data: { openQuestionId: questionId, individualId: entityId },
        });
        break;
      case "family":
        await db.openQuestionFamily.create({
          data: { openQuestionId: questionId, familyId: entityId },
        });
        break;
      case "event":
        await db.openQuestionEvent.create({
          data: { openQuestionId: questionId, eventId: entityId },
        });
        break;
      case "media":
        await db.openQuestionMedia.create({
          data: { openQuestionId: questionId, mediaId: entityId },
        });
        break;
      default:
        throw new Error("Invalid entity type");
    }
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return;
    }
    throw e;
  }
}

export async function unlinkOpenQuestionFromEntity(
  db: Db,
  fileUuid: string,
  questionId: string,
  entityType: OpenQuestionEntityType,
  entityId: string,
): Promise<void> {
  const q = await db.openQuestion.findFirst({ where: { id: questionId, fileUuid } });
  if (!q) throw new Error("Open question not found");

  switch (entityType) {
    case "individual":
      await db.openQuestionIndividual.deleteMany({
        where: { openQuestionId: questionId, individualId: entityId },
      });
      break;
    case "family":
      await db.openQuestionFamily.deleteMany({
        where: { openQuestionId: questionId, familyId: entityId },
      });
      break;
    case "event":
      await db.openQuestionEvent.deleteMany({
        where: { openQuestionId: questionId, eventId: entityId },
      });
      break;
    case "media":
      await db.openQuestionMedia.deleteMany({
        where: { openQuestionId: questionId, mediaId: entityId },
      });
      break;
    default:
      throw new Error("Invalid entity type");
  }
}

export async function markOpenQuestionResolved(
  db: Db,
  fileUuid: string,
  questionId: string,
  resolution: string,
  resolvedById: string,
): Promise<void> {
  const trimmed = resolution.trim();
  if (!trimmed) throw new Error("Resolution is required");
  const q = await db.openQuestion.findFirst({ where: { id: questionId, fileUuid } });
  if (!q) throw new Error("Open question not found");
  await db.openQuestion.update({
    where: { id: questionId },
    data: {
      status: "resolved",
      resolution: trimmed,
      resolvedAt: new Date(),
      resolvedById,
    },
  });
}

export async function archiveOpenQuestion(
  db: Db,
  fileUuid: string,
  questionId: string,
): Promise<void> {
  const q = await db.openQuestion.findFirst({ where: { id: questionId, fileUuid } });
  if (!q) throw new Error("Open question not found");
  await db.openQuestion.update({
    where: { id: questionId },
    data: { status: "archived" },
  });
}

export async function reopenOpenQuestion(db: Db, fileUuid: string, questionId: string): Promise<void> {
  const q = await db.openQuestion.findFirst({ where: { id: questionId, fileUuid } });
  if (!q) throw new Error("Open question not found");
  await db.openQuestion.update({
    where: { id: questionId },
    data: { status: "open" },
  });
}

export function parseOpenQuestionStatusParam(raw: string | null): OpenQuestionStatus | undefined {
  if (!raw) return undefined;
  const s = raw.trim().toLowerCase();
  if (s === "open" || s === "resolved" || s === "archived") return s;
  return undefined;
}

export async function listOpenQuestionsForFile(
  fileUuid: string,
  opts: {
    status?: OpenQuestionStatus;
    q?: string | null;
    limit: number;
    offset: number;
  },
): Promise<{ rows: Prisma.OpenQuestionGetPayload<{ include: typeof OPEN_QUESTION_DETAIL_INCLUDE }>[]; total: number }> {
  const where: Prisma.OpenQuestionWhereInput = { fileUuid };
  if (opts.status) where.status = opts.status;
  const q = opts.q?.trim();
  if (q) {
    where.OR = [
      { question: { contains: q, mode: "insensitive" } },
      { details: { contains: q, mode: "insensitive" } },
      { resolution: { contains: q, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.openQuestion.count({ where }),
    prisma.openQuestion.findMany({
      where,
      include: OPEN_QUESTION_DETAIL_INCLUDE,
      orderBy: { updatedAt: "desc" },
      take: opts.limit,
      skip: opts.offset,
    }),
  ]);
  return { rows, total };
}
