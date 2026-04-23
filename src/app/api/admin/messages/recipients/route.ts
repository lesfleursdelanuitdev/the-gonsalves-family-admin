import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeCommunityUserIds } from "@/lib/admin/admin-message-tree-scope";

/** Users who may appear as DM recipients for this admin tree (roles + individual links). */
export const GET = withAdminAuth(async (_req, _user, _ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const ids = await getAdminTreeCommunityUserIds(treeId);
  if (ids.length === 0) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true },
    orderBy: { username: "asc" },
    select: { id: true, username: true, name: true },
  });

  return NextResponse.json({ users });
});
