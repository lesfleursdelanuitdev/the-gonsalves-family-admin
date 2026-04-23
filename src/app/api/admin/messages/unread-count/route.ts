import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { countUnreadTreeInboxForUser } from "@/lib/admin/admin-message-unread";

export const GET = withAdminAuth(async (_req, user, _ctx) => {
  const treeId = process.env.ADMIN_TREE_ID;
  if (!treeId) {
    return NextResponse.json({ error: "ADMIN_TREE_ID is not configured" }, { status: 500 });
  }

  const count = await countUnreadTreeInboxForUser(user.id, treeId);
  return NextResponse.json({ count });
});
