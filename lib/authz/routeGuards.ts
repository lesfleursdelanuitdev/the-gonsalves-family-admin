import { prisma } from "@/lib/database/prisma";
import { requireAuth } from "@/lib/infra/auth";
import { createAuthzApi, AuthorizationError } from "@ligneous/auth";
import { can } from "@/lib/authz/authorize";

type RequireCanInput = {
  entity: string;
  action: string;
  scope?: "site" | "tree" | "user" | "gedcom" | string;
  treeId?: string | null;
  ownerUserId?: string | null;
};

export async function requireAuthUser() {
  return requireAuth();
}

export async function requireWebsiteOwner() {
  const authUser = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, isActive: true, isWebsiteOwner: true },
  });
  if (!user || !user.isActive || !user.isWebsiteOwner) {
    throw new AuthorizationError("Forbidden");
  }
  return authUser;
}

export async function requireCan(input: RequireCanInput) {
  const authUser = await requireAuth();
  const authz = createAuthzApi(can);
  const allowed = await authz.can({
    userId: authUser.id,
    entity: input.entity,
    action: input.action,
    scope: input.scope,
    treeId: input.treeId,
    ownerUserId: input.ownerUserId,
  });
  if (!allowed) throw new AuthorizationError("Forbidden");
  return authUser;
}

