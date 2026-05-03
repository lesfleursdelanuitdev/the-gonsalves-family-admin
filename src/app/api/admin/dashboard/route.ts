import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { AdminTreeResolutionError, getAdminFileUuid, getAdminTreeId } from "@/lib/infra/admin-tree";
import { countUnreadTreeInboxForUser } from "@/lib/admin/admin-message-unread";
import { buildAdminDashboardSnapshot } from "@/lib/admin/admin-dashboard-snapshot";

export const GET = withAdminAuth(async (_req, user) => {
  let unreadMessages = 0;
  const treeIdEnv = process.env.ADMIN_TREE_ID?.trim();
  if (treeIdEnv) {
    try {
      unreadMessages = await countUnreadTreeInboxForUser(user.id, treeIdEnv);
    } catch {
      unreadMessages = 0;
    }
  }

  let treeId: string | null = null;
  try {
    treeId = await getAdminTreeId();
  } catch (e) {
    if (!(e instanceof AdminTreeResolutionError)) throw e;
    treeId = null;
  }

  try {
    const fileUuid = await getAdminFileUuid();
    const snapshot = await buildAdminDashboardSnapshot(fileUuid, user.id, treeId);
    return NextResponse.json({
      configured: true,
      unreadMessages,
      ...snapshot,
    });
  } catch (e) {
    if (e instanceof AdminTreeResolutionError) {
      return NextResponse.json({
        configured: false,
        unreadMessages,
        setupMessage: e.message,
        totals: null,
        recentUpdatesCount: 0,
        activity: [],
        needsAttention: [],
        needsAttentionTotal: 0,
      });
    }
    throw e;
  }
});
