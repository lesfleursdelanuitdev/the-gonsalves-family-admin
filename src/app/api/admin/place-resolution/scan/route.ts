import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import {
  runPlaceResolutionScan,
  type PlaceResolutionScanSummary,
} from "@/lib/admin/place-resolution-scan";

export type PlaceResolutionScanResult = PlaceResolutionScanSummary;

/** POST /api/admin/place-resolution/scan — run detection scan for the current tree */
export const POST = withAdminAuth(async () => {
  await requireCan({ entity: "place_resolution", action: "use", scope: "tree", treeId: process.env.ADMIN_TREE_ID ?? null });
  const fileUuid = await getAdminFileUuid();
  const summary = await runPlaceResolutionScan(fileUuid);
  return NextResponse.json(summary);
});
