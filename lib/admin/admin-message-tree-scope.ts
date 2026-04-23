import type { Prisma } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";

/**
 * Users tied to the admin tree: roles (owner/maintainer/contributor) plus individual links.
 * Used to scope direct messages to this tree community (see ADMINISTRATION_PLAN §5.2).
 */
export async function getAdminTreeCommunityUserIds(treeId: string): Promise<string[]> {
  const [owners, maintainers, contributors, links] = await Promise.all([
    prisma.treeOwner.findMany({ where: { treeId }, select: { userId: true } }),
    prisma.treeMaintainer.findMany({ where: { treeId }, select: { userId: true } }),
    prisma.treeContributor.findMany({ where: { treeId }, select: { userId: true } }),
    prisma.userIndividualLink.findMany({ where: { treeId }, select: { userId: true } }),
  ]);
  const ids = new Set<string>();
  for (const r of owners) ids.add(r.userId);
  for (const r of maintainers) ids.add(r.userId);
  for (const r of contributors) ids.add(r.userId);
  for (const r of links) ids.add(r.userId);
  return [...ids];
}

/** Messages visible for this admin tree: community senders/recipients or tree-scoped groups. */
export function treeScopedMessageWhere(treeId: string, userIds: string[]): Prisma.MessageWhereInput {
  const community: Prisma.MessageWhereInput[] = [];
  if (userIds.length > 0) {
    community.push({ senderId: { in: userIds } }, { recipientId: { in: userIds } });
  }
  community.push({ group: { treeId } });
  return { OR: community };
}

export async function findMessageInAdminTreeScope(
  id: string,
  treeId: string,
  communityUserIds: string[],
): Promise<{ id: string } | null> {
  const scope = treeScopedMessageWhere(treeId, communityUserIds);
  return prisma.message.findFirst({
    where: { AND: [{ id }, scope] },
    select: { id: true },
  });
}
