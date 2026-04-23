import { NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";

export const GET = withAdminAuth(async (req, _user, _ctx) => {
  const fileUuid = await getAdminFileUuid();
  const { searchParams } = req.nextUrl;

  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const entityType = searchParams.get("entityType")?.trim() || null;
  const entityId = searchParams.get("entityId")?.trim() || null;
  const userId = searchParams.get("userId")?.trim() || null;

  const where: Prisma.ChangeLogWhereInput = {
    fileUuid,
    undoneAt: null,
  };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;

  const batches = await prisma.$queryRaw<
    {
      batch_id: string;
      summary: string | null;
      created_at: Date;
      user_id: string;
      username: string;
      user_name: string | null;
      entry_count: bigint;
      entity_types: string[];
      operations: string[];
    }[]
  >(Prisma.sql`
    SELECT
      cl.batch_id,
      MAX(cl.summary) AS summary,
      MIN(cl.created_at) AS created_at,
      cl.user_id,
      u.username,
      u.name AS user_name,
      COUNT(*)::bigint AS entry_count,
      ARRAY_AGG(DISTINCT cl.entity_type) AS entity_types,
      ARRAY_AGG(DISTINCT cl.operation) AS operations
    FROM change_log cl
    JOIN users u ON u.id = cl.user_id
    WHERE cl.file_uuid = ${fileUuid}::uuid
      AND cl.undone_at IS NULL
      ${entityType ? Prisma.sql`AND cl.entity_type = ${entityType}` : Prisma.empty}
      ${entityId ? Prisma.sql`AND cl.entity_id = ${entityId}::uuid` : Prisma.empty}
      ${userId ? Prisma.sql`AND cl.user_id = ${userId}::uuid` : Prisma.empty}
    GROUP BY cl.batch_id, cl.user_id, u.username, u.name
    ORDER BY MIN(cl.created_at) DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `);

  const total = await prisma.changeLog.groupBy({
    by: ["batchId"],
    where,
    _count: true,
  });

  return NextResponse.json({
    batches: batches.map((b) => ({
      batchId: b.batch_id,
      summary: b.summary,
      createdAt: b.created_at,
      userId: b.user_id,
      username: b.username,
      userName: b.user_name,
      entryCount: Number(b.entry_count),
      entityTypes: b.entity_types,
      operations: b.operations,
    })),
    total: total.length,
    hasMore: offset + batches.length < total.length,
  });
});
