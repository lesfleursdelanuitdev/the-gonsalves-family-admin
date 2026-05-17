import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { getAdminTreeId } from "@/lib/infra/admin-tree";
import { requireCan } from "@/lib/authz/routeGuards";
import { ensureDefaultRelationshipTypes } from "@/lib/admin/individual-relationships";

function isMissingRelationshipSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
  return maybeCode === "P2021";
}

export const GET = withAdminAuth(async () => {
  await requireCan({ entity: "individual", action: "read", scope: "tree" });
  try {
    const treeId = await getAdminTreeId();
    await ensureDefaultRelationshipTypes(prisma, treeId);
    const relationshipTypes = await prisma.relationshipType.findMany({
      where: { OR: [{ treeId }, { treeId: null }] },
      orderBy: [{ treeId: "desc" }, { label: "asc" }],
      include: { roles: { orderBy: { key: "asc" } } },
    });
    return NextResponse.json({ relationshipTypes, schemaReady: true as const });
  } catch (error) {
    if (isMissingRelationshipSchemaError(error)) {
      return NextResponse.json({
        relationshipTypes: [],
        schemaReady: false as const,
        setupMessage:
          "Relationship tables are missing in this database. Run `npm run db:migrate:all` in the admin app, then refresh.",
      });
    }
    throw error;
  }
});

export const POST = withAdminAuth(async (req) => {
  await requireCan({ entity: "individual", action: "update", scope: "tree" });
  const treeId = await getAdminTreeId();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = typeof body.key === "string" ? body.key.trim().toLowerCase() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : null;
  const isSymmetric = body.isSymmetric === true;
  const gedcomRelaAtoB = typeof body.gedcomRelaAtoB === "string" ? body.gedcomRelaAtoB.trim() : null;
  const gedcomRelaBtoA = typeof body.gedcomRelaBtoA === "string" ? body.gedcomRelaBtoA.trim() : null;
  const roles = Array.isArray(body.roles) ? body.roles : [];

  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });
  if (!roles.length) return NextResponse.json({ error: "At least one role is required" }, { status: 400 });

  const roleRows = roles
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      key: typeof r.key === "string" ? r.key.trim().toLowerCase() : "",
      label: typeof r.label === "string" ? r.label.trim() : "",
      reciprocalRoleKey: typeof r.reciprocalRoleKey === "string" ? r.reciprocalRoleKey.trim().toLowerCase() : null,
      description: typeof r.description === "string" ? r.description.trim() : null,
    }))
    .filter((r) => r.key && r.label);

  if (!roleRows.length) {
    return NextResponse.json({ error: "roles must include key and label" }, { status: 400 });
  }
  const roleKeySet = new Set<string>();
  for (const role of roleRows) {
    if (roleKeySet.has(role.key)) {
      return NextResponse.json({ error: `Duplicate role key: ${role.key}` }, { status: 400 });
    }
    roleKeySet.add(role.key);
  }
  for (const role of roleRows) {
    if (role.reciprocalRoleKey && !roleKeySet.has(role.reciprocalRoleKey)) {
      return NextResponse.json(
        { error: `Role ${role.key} has reciprocalRoleKey ${role.reciprocalRoleKey} that does not exist` },
        { status: 400 },
      );
    }
  }

  try {
    const existing = await prisma.relationshipType.findUnique({
      where: { treeId_key: { treeId, key } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "Relationship type key must be unique." }, { status: 409 });

    const relationshipType = await prisma.relationshipType.create({
      data: {
        treeId,
        key,
        label,
        description,
        isSymmetric,
        gedcomRelaAtoB,
        gedcomRelaBtoA,
        roles: {
          create: roleRows.map((role) => ({
            key: role.key,
            label: role.label,
            reciprocalRoleKey: role.reciprocalRoleKey,
            description: role.description,
          })),
        },
      },
      include: { roles: { orderBy: { key: "asc" } } },
    });
    return NextResponse.json({ relationshipType }, { status: 201 });
  } catch (error) {
    if (isMissingRelationshipSchemaError(error)) {
      return NextResponse.json(
        { error: "Relationship tables are missing. Run `npm run db:migrate:all` and retry." },
        { status: 503 },
      );
    }
    throw error;
  }
});
