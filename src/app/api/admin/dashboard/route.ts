import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { AdminTreeResolutionError, getAdminFileUuid, getAdminTreeId } from "@/lib/infra/admin-tree";
import { countUnreadTreeInboxForUser } from "@/lib/admin/admin-message-unread";
import { buildAdminDashboardSnapshot } from "@/lib/admin/admin-dashboard-snapshot";

export const GET = withAdminAuth(async (_req, user) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
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
        lastImportAt: null,
        newThisWeek: { individuals: 0, media: 0, events: 0 },
        archiveHealth: {
          score: 0,
          linkedMediaPct: 0,
          datedEventsPct: 0,
          geocodedPlacesPct: 0,
          sourcedFactsPct: 0,
          peopleWithPhotosPct: 0,
          peopleWithStoriesPct: 0,
        },
        heatmap: [],
        insights: {
          topSurnames: [],
          birthsByDecade: [],
          branchSlices: [],
          topBirthPlaces: [],
          mediaCoverage: [],
          generationCoverage: [],
        },
        discoveries: [],
      });
    }
    throw e;
  }
});
