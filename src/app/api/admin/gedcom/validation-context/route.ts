import { NextRequest, NextResponse } from "next/server";
import { buildValidationDbContext, collectXrefsFromFinding } from "@/lib/admin/gedcom-validation-db-context";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminFileUuid } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";

export const runtime = "nodejs";

type Body = {
  finding?: {
    Xref?: string;
    RelatedXref?: string;
    Details?: Record<string, string> | null;
  };
  xrefs?: string[];
};

/** POST JSON `{ finding }` or `{ xrefs: string[] }` — returns DB rows + junction counts for the admin tree. */
export const POST = withAdminAuth(async (req: NextRequest, _user, _ctx) => {
  await requireCan({ entity: "gedcom", action: "validate_tree", scope: "gedcom", treeId: process.env.ADMIN_TREE_ID ?? null });
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fileUuid = await getAdminFileUuid();

  const xrefs =
    Array.isArray(body.xrefs) && body.xrefs.length > 0
      ? body.xrefs.map((x) => String(x).trim()).filter(Boolean)
      : body.finding
        ? collectXrefsFromFinding(body.finding)
        : [];

  if (xrefs.length === 0) {
    return NextResponse.json({ fileUuid, records: [], xrefsNotInDatabase: [] });
  }

  const payload = await buildValidationDbContext(fileUuid, xrefs);
  return NextResponse.json(payload);
});
