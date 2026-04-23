import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { resolveAdminGedcomFileUuid } from "@/lib/infra/admin-tree";

/**
 * GET /api/admin/setup — Returns whether admin tree is configured and suggests
 * ADMIN_TREE_ID or ADMIN_TREE_FILE_ID from the database when not set.
 */
export const GET = withAdminAuth(async (_req, _user, _ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  const fileId = process.env.ADMIN_TREE_FILE_ID;

  const trees = await prisma.tree.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      fileId: true,
      gedcomFileId: true,
      gedcomFile: { select: { fileId: true } },
    },
  });

  const suggestions = trees.map((t) => ({
    adminTreeId: t.id,
    adminTreeFileId: t.gedcomFile?.fileId ?? t.fileId,
    name: t.name,
  }));

  const r = await resolveAdminGedcomFileUuid();

  if (!r.ok) {
    return NextResponse.json({
      configured: false,
      message: r.reason,
      suggestions,
    });
  }

  const gedcomFile = await prisma.gedcomFile.findUnique({
    where: { id: r.fileUuid },
    select: { id: true, fileId: true, name: true },
  });

  const gedcomMediaCount = await prisma.gedcomMedia.count({
    where: { fileUuid: r.fileUuid },
  });

  if (treeId) {
    const tree = await prisma.tree.findUnique({
      where: { id: treeId },
      select: { id: true, name: true, gedcomFileId: true, fileId: true },
    });
    return NextResponse.json({
      configured: true,
      source: "ADMIN_TREE_ID",
      fileUuid: r.fileUuid,
      gedcomFile,
      gedcomMediaCount,
      tree: tree
        ? { id: tree.id, name: tree.name, gedcomFileId: tree.gedcomFileId, fileId: tree.fileId }
        : null,
    });
  }

  if (fileId) {
    const tree = gedcomFile
      ? await prisma.tree.findFirst({
          where: { gedcomFileId: gedcomFile.id },
          select: { id: true, name: true },
        })
      : null;
    return NextResponse.json({
      configured: true,
      source: "ADMIN_TREE_FILE_ID",
      fileUuid: r.fileUuid,
      gedcomFile,
      gedcomMediaCount,
      tree: tree ? { id: tree.id, name: tree.name } : null,
    });
  }

  return NextResponse.json({
    configured: true,
    source: "resolved",
    fileUuid: r.fileUuid,
    gedcomFile,
    gedcomMediaCount,
  });
});
