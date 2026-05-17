import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { requireCan } from "@/lib/authz/routeGuards";
import { listRelationshipsForIndividual } from "@/lib/admin/individual-relationships-service";

export const GET = withAdminAuth(async (_req, _user, ctx) => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  const { id } = await ctx.params;
  const relationships = await listRelationshipsForIndividual(id);
  return NextResponse.json({ relationships });
});
