import { NextResponse } from "next/server";
import { can } from "@/lib/authz/authorize";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { AUTHZ_SCOPES, type AuthzScope } from "@/lib/authz/permissions";

const ALLOWED_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "manage",
  "validate_external",
  "validate_tree",
  "merge_records",
  "export",
] as const;
const ALLOWED_SCOPES = new Set<AuthzScope>(AUTHZ_SCOPES);

export const GET = withAdminAuth(async (req, user) => {
  const entity = req.nextUrl.searchParams.get("entity")?.trim() ?? "";
  const scopeRaw = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase() ?? "tree";
  const ownerUserIdRaw = req.nextUrl.searchParams.get("ownerUserId")?.trim() ?? "";

  if (!entity) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }
  if (!ALLOWED_SCOPES.has(scopeRaw as AuthzScope)) {
    return NextResponse.json({ error: "scope must be one of site, tree, user, other_users, gedcom" }, { status: 400 });
  }

  const scope = scopeRaw as AuthzScope;
  const treeId = scope === "tree" || scope === "gedcom" ? (process.env.ADMIN_TREE_ID ?? null) : null;
  const ownerUserId =
    scope === "user"
      ? ownerUserIdRaw || user.id
      : scope === "other_users"
        ? ownerUserIdRaw || "__other_user__"
        : undefined;

  const checks = await Promise.all(
    ALLOWED_ACTIONS.map(async (action) => {
      const allowed = await can({
        userId: user.id,
        entity,
        action,
        scope,
        treeId,
        ownerUserId,
      });
      return [action, allowed] as const;
    }),
  );

  return NextResponse.json({
    entity,
    scope,
    permissions: Object.fromEntries(checks),
  });
});
