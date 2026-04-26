import { prisma } from "@/lib/database/prisma";
import {
  getAdminTreeCommunityUserIds,
  messageParticipantWhere,
  treeScopedMessageWhere,
} from "@/lib/admin/admin-message-tree-scope";

/** Unread direct messages in the admin tree inbox for this user (tree-scoped). */
export async function countUnreadTreeInboxForUser(
  userId: string,
  treeId: string,
): Promise<number> {
  const communityIds = await getAdminTreeCommunityUserIds(treeId);
  const scope = treeScopedMessageWhere(treeId, communityIds);
  const participant = messageParticipantWhere(userId);
  return prisma.message.count({
    where: {
      AND: [scope, participant, { recipientId: userId }, { isRead: false }],
    },
  });
}
