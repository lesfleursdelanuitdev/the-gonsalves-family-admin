import { prisma } from "@/lib/database/prisma";
import { getAdminTreeId } from "@/lib/infra/admin-tree";

export interface AdminTreeReadScope {
  treeId: string;
  canReadAllTreeData: boolean;
}

export async function getAdminTreeReadScope(user: {
  id: string;
  isWebsiteOwner: boolean;
}): Promise<AdminTreeReadScope> {
  const treeId = await getAdminTreeId();
  if (user.isWebsiteOwner) {
    return { treeId, canReadAllTreeData: true };
  }

  const isTreeOwner = !!(await prisma.treeOwner.findFirst({
    where: { treeId, userId: user.id },
    select: { id: true },
  }));

  return { treeId, canReadAllTreeData: isTreeOwner };
}
