import { ResourceType } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { permissionKey } from "@/lib/authz/permissions";

export type CanInput = {
  userId: string;
  entity: string;
  action: string;
  scope?: "site" | "tree" | "user" | "other_users" | "gedcom" | string;
  treeId?: string | null;
  ownerUserId?: string | null;
};

export class AuthorizationError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "AuthorizationError";
  }
}

function actionMatches(granted: string, requested: string): boolean {
  if (granted === requested) return true;
  if (granted !== "manage") return false;
  return requested === "create" || requested === "read" || requested === "update" || requested === "delete";
}

function scopeMatches(
  grantedScope: string,
  requestedScope: string,
  ctx: { requestedTreeId: string | null; assignmentTreeId: string | null; ownerUserId: string | null; userId: string },
): boolean {
  if (grantedScope === "site") return true;
  if (grantedScope !== requestedScope) return false;
  if (grantedScope === "tree") {
    if (!ctx.requestedTreeId) return false;
    return ctx.assignmentTreeId == null || ctx.assignmentTreeId === ctx.requestedTreeId;
  }
  if (
    (grantedScope === "user" || grantedScope === "other_users") &&
    ctx.assignmentTreeId != null &&
    ctx.requestedTreeId != null &&
    ctx.assignmentTreeId !== ctx.requestedTreeId
  ) {
    return false;
  }
  if (grantedScope === "user") {
    return ctx.ownerUserId != null && ctx.ownerUserId === ctx.userId;
  }
  if (grantedScope === "other_users") {
    return ctx.ownerUserId != null && ctx.ownerUserId !== ctx.userId;
  }
  return true;
}

function legacyPermissionActionMatches(granted: string, requested: string): boolean {
  if (granted === "admin") return true;
  if (granted === "read") return requested === "read";
  if (granted === "write") return requested === "create" || requested === "read" || requested === "update";
  if (granted === "delete") return requested === "delete" || requested === "read";
  return false;
}

async function legacyRoleFallback(
  userId: string,
  requestedScope: string,
  requestedAction: string,
  requestedEntity: string,
  treeId: string | null,
): Promise<boolean> {
  if (requestedScope !== "tree" && requestedScope !== "gedcom") return false;
  const effectiveTreeId = treeId ?? process.env.ADMIN_TREE_ID ?? null;
  if (!effectiveTreeId) return false;

  const [owner, maintainer, contributor] = await Promise.all([
    prisma.treeOwner.findFirst({ where: { treeId: effectiveTreeId, userId }, select: { id: true } }),
    prisma.treeMaintainer.findFirst({ where: { treeId: effectiveTreeId, userId }, select: { id: true } }),
    prisma.treeContributor.findFirst({ where: { treeId: effectiveTreeId, userId }, select: { id: true } }),
  ]);

  if (owner) return true;
  if (maintainer) {
    if (requestedEntity === "role" || requestedEntity === "user" || requestedEntity === "permission")
      return false;
    return requestedAction === "create" || requestedAction === "read" || requestedAction === "update";
  }
  if (contributor) {
    if (requestedEntity === "role" || requestedEntity === "user" || requestedEntity === "permission")
      return false;
    if (requestedEntity === "media" || requestedEntity === "tag" || requestedEntity === "album") {
      return requestedAction === "create" || requestedAction === "read" || requestedAction === "update";
    }
    return requestedAction === "read";
  }
  return false;
}

async function legacyPermissionFallback(
  userId: string,
  requestedScope: string,
  requestedAction: string,
  requestedEntity: string,
  treeId: string | null,
): Promise<boolean> {
  if (requestedScope !== "tree") return false;
  const effectiveTreeId = treeId ?? process.env.ADMIN_TREE_ID ?? null;
  if (!effectiveTreeId) return false;

  const resourceTypeForEntity: string | null =
    requestedEntity === "individual"
      ? "individual"
      : requestedEntity === "family"
        ? "family"
        : requestedEntity === "tree"
          ? "tree"
          : null;

  if (!resourceTypeForEntity) return false;

  const resourceTypeValues: ResourceType[] =
    resourceTypeForEntity === "individual"
      ? [ResourceType.individual, ResourceType.subtree, ResourceType.tree]
      : resourceTypeForEntity === "family"
        ? [ResourceType.family, ResourceType.subtree, ResourceType.tree]
        : [ResourceType.tree, ResourceType.subtree];

  const rows = await prisma.permission.findMany({
    where: {
      userId,
      treeId: effectiveTreeId,
      resourceType: { in: resourceTypeValues },
    },
    select: { permissionType: true, expiresAt: true },
  });

  const now = new Date();
  return rows.some((row) => {
    if (row.expiresAt && row.expiresAt <= now) return false;
    return legacyPermissionActionMatches(String(row.permissionType), requestedAction);
  });
}

export async function can(input: CanInput): Promise<boolean> {
  const requestedScope = (input.scope ?? "tree").toLowerCase();
  const requestedAction = input.action.toLowerCase();
  const requestedEntity = input.entity.trim();
  const requestedTreeId = input.treeId ?? null;
  const ownerUserId = input.ownerUserId ?? null;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true, isWebsiteOwner: true },
  });

  if (!user || !user.isActive) return false;
  if (user.isWebsiteOwner) return true;

  const assignmentsWhere =
    requestedTreeId == null
      ? { userId: input.userId, treeId: null as string | null }
      : { userId: input.userId, OR: [{ treeId: null }, { treeId: requestedTreeId }] };

  const assignments = await prisma.userRole.findMany({
    where: assignmentsWhere,
    select: {
      treeId: true,
      role: {
        select: {
          key: true,
          permissions: {
            select: {
              entity: true,
              action: true,
              scope: true,
            },
          },
        },
      },
    },
  });

  const granted = new Set<string>();
  for (const assignment of assignments) {
    const roleKey = assignment.role.key?.trim().toLowerCase();
    // Super-roles: Site owner/admin gets full access; tree owner gets full access for scoped checks.
    if (roleKey === "site_admin" || roleKey === "site_owner") return true;
    if (
      (roleKey === "tree_owner" || roleKey === "treeowner") &&
      (requestedScope === "tree" ||
        requestedScope === "gedcom" ||
        requestedScope === "user" ||
        requestedScope === "other_users")
    ) {
      return true;
    }

    for (const perm of assignment.role.permissions) {
      const pScope = perm.scope.toLowerCase();
      if (
        scopeMatches(pScope, requestedScope, {
          requestedTreeId,
          assignmentTreeId: assignment.treeId,
          ownerUserId,
          userId: input.userId,
        })
      ) {
        // Normalize to requested scope so broader grants (e.g. site) can satisfy tree/user checks.
        granted.add(permissionKey(perm.entity, perm.action.toLowerCase(), requestedScope));
      }
    }
  }

  if (
    granted.has(permissionKey(requestedEntity, requestedAction, requestedScope)) ||
    granted.has(permissionKey(requestedEntity, "manage", requestedScope))
  ) {
    return true;
  }

  for (const key of granted) {
    const [entity, action, scope] = key.split(":");
    if (!entity || !action || !scope) continue;
    if (entity !== requestedEntity || scope !== requestedScope) continue;
    if (actionMatches(action, requestedAction)) return true;
  }

  if (await legacyRoleFallback(input.userId, requestedScope, requestedAction, requestedEntity, requestedTreeId)) return true;
  if (await legacyPermissionFallback(input.userId, requestedScope, requestedAction, requestedEntity, requestedTreeId)) return true;

  // Compatibility fallback during migration: legacy user-owned media/tag/album routes
  // historically relied on session identity + owner checks (not role/permission rows).
  if (
    requestedScope === "user" &&
    ownerUserId != null &&
    ownerUserId === input.userId &&
    (requestedEntity === "media" ||
      requestedEntity === "tag" ||
      requestedEntity === "album" ||
      requestedEntity === "message")
  ) {
    return true;
  }

  return false;
}

export async function requirePermission(input: CanInput): Promise<void> {
  const allowed = await can(input);
  if (!allowed) throw new AuthorizationError("Forbidden");
}

