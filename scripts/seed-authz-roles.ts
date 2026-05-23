#!/usr/bin/env node
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { permissionDescription } from "../lib/authz/permissionDefinitions.ts";

type Perm = { entity: string; action: string; scope: string };
type RoleSeed = {
  key: string;
  name: string;
  description: string;
  scope: string;
  isSystem: boolean;
  permissions: Perm[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

const TREE_ENTITIES = [
  "individual",
  "family",
  "event",
  "note",
  "source",
  "place",
  "givenName",
  "lastName",
  "date",
  "openQuestion",
] as const;
const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const;
const GEDCOM_ACTIONS = ["validate_external", "validate_tree", "merge_records", "export"] as const;
const SCOPED_CONTENT_ENTITIES = ["media", "tag", "album", "story"] as const;
const SOCIAL_SCOPES = ["site", "tree", "user", "other_users"] as const;
const COMMUNITY_ADMIN_ENTITIES = ["contact_message", "contribution", "access_request", "registration_request"] as const;

function buildRoleSeeds(): RoleSeed[] {
  const repositoryCrud: Perm[] = CRUD_ACTIONS.map((action) => ({ entity: "repository", action, scope: "tree" }));
  const communityCrud: Perm[] = COMMUNITY_ADMIN_ENTITIES.flatMap((entity) =>
    CRUD_ACTIONS.map((action) => ({ entity, action, scope: "site" })),
  );
  const communityReply: Perm = { entity: "contact_message", action: "reply", scope: "site" };

  const siteAdminPerms: Perm[] = [
    ...["user", "role", "permission"].flatMap((entity) =>
      CRUD_ACTIONS.map((action) => ({ entity, action, scope: "site" })),
    ),
    ...["story", "changelog"].flatMap((entity) =>
      CRUD_ACTIONS.map((action) => ({ entity, action, scope: "site" })),
    ),
    ...SCOPED_CONTENT_ENTITIES.flatMap((entity) =>
      SOCIAL_SCOPES.flatMap((scope) =>
        CRUD_ACTIONS.map((action) => ({ entity, action, scope })),
      ),
    ),
    ...GEDCOM_ACTIONS.map((action) => ({ entity: "gedcom", action, scope: "gedcom" })),
    { entity: "user", action: "manage", scope: "site" },
    { entity: "role", action: "manage", scope: "site" },
    { entity: "permission", action: "manage", scope: "site" },
    { entity: "media", action: "manage", scope: "site" },
    { entity: "tag", action: "manage", scope: "site" },
    { entity: "album", action: "manage", scope: "site" },
    ...repositoryCrud,
    ...communityCrud,
    communityReply,
  ];

  const treeOwnerPerms: Perm[] = [
    ...TREE_ENTITIES.map((entity) => ({ entity, action: "manage", scope: "tree" })),
    ...["user", "role", "permission"].flatMap((entity) =>
      CRUD_ACTIONS.map((action) => ({ entity, action, scope: "tree" })),
    ),
    ...["story", "changelog"].flatMap((entity) =>
      CRUD_ACTIONS.map((action) => ({ entity, action, scope: "tree" })),
    ),
    ...SCOPED_CONTENT_ENTITIES.flatMap((entity) =>
      ["tree", "user", "other_users"].flatMap((scope) =>
        CRUD_ACTIONS.map((action) => ({ entity, action, scope })),
      ),
    ),
    ...GEDCOM_ACTIONS.map((action) => ({ entity: "gedcom", action, scope: "gedcom" })),
    { entity: "user", action: "manage", scope: "tree" },
    { entity: "role", action: "manage", scope: "tree" },
    { entity: "permission", action: "manage", scope: "tree" },
    { entity: "media", action: "manage", scope: "tree" },
    { entity: "media", action: "manage", scope: "gedcom" },
    { entity: "tag", action: "manage", scope: "tree" },
    { entity: "album", action: "manage", scope: "tree" },
    ...repositoryCrud,
    ...communityCrud,
    communityReply,
  ];

  const treeMaintainerPerms: Perm[] = [
    ...TREE_ENTITIES.flatMap((entity) => ["create", "read", "update"].map((action) => ({ entity, action, scope: "tree" }))),
    ...["media", "tag", "album"].flatMap((entity) => ["create", "read", "update"].map((action) => ({ entity, action, scope: "tree" }))),
    ...SCOPED_CONTENT_ENTITIES.flatMap((entity) =>
      ["user", "other_users"].flatMap((scope) =>
        ["create", "read", "update"].map((action) => ({ entity, action, scope })),
      ),
    ),
    ...repositoryCrud,
  ];

  const treeContributorPerms: Perm[] = [
    ...TREE_ENTITIES.map((entity) => ({ entity, action: "read", scope: "tree" })),
    ...["media", "tag", "album"].flatMap((entity) => ["create", "read", "update"].map((action) => ({ entity, action, scope: "tree" }))),
    ...SCOPED_CONTENT_ENTITIES.flatMap((entity) =>
      ["user", "other_users"].flatMap((scope) =>
        ["read"].map((action) => ({ entity, action, scope })),
      ),
    ),
    ...repositoryCrud,
  ];

  const viewerPerms: Perm[] = [
    ...TREE_ENTITIES.map((entity) => ({ entity, action: "read", scope: "tree" })),
    { entity: "repository", action: "read", scope: "tree" },
  ];

  return [
    {
      key: "site_admin",
      name: "Site Admin",
      description: "Site-wide administration for users, roles, and global media resources.",
      scope: "site",
      isSystem: true,
      permissions: siteAdminPerms,
    },
    {
      key: "tree_owner",
      name: "Tree Owner",
      description: "Full management rights for genealogy and media content within a tree.",
      scope: "tree",
      isSystem: true,
      permissions: treeOwnerPerms,
    },
    {
      key: "tree_maintainer",
      name: "Tree Maintainer",
      description: "Create/read/update access for most genealogy and tree media content.",
      scope: "tree",
      isSystem: true,
      permissions: treeMaintainerPerms,
    },
    {
      key: "tree_contributor",
      name: "Tree Contributor",
      description: "Contribute content and read genealogy data in a tree.",
      scope: "tree",
      isSystem: true,
      permissions: treeContributorPerms,
    },
    {
      key: "viewer",
      name: "Viewer",
      description: "Read-only access to tree-scoped genealogy entities.",
      scope: "tree",
      isSystem: true,
      permissions: viewerPerms,
    },
  ];
}

function createPrisma(): { prisma: PrismaClient; pool: pg.Pool } {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  return { prisma, pool };
}

async function main() {
  const { prisma, pool } = createPrisma();
  const seeds = buildRoleSeeds();
  try {
    const catalog = new Map<string, Perm>();
    for (const seed of seeds) {
      const role = await prisma.role.upsert({
        where: { key: seed.key },
        update: {
          name: seed.name,
          description: seed.description,
          scope: seed.scope,
          isSystem: seed.isSystem,
        },
        create: {
          key: seed.key,
          name: seed.name,
          description: seed.description,
          scope: seed.scope,
          isSystem: seed.isSystem,
        },
      });

      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      if (seed.permissions.length) {
        await prisma.rolePermission.createMany({
          data: seed.permissions.map((p) => ({
            roleId: role.id,
            entity: p.entity,
            action: p.action,
            scope: p.scope,
          })),
          skipDuplicates: true,
        });
        for (const p of seed.permissions) {
          const k = `${p.entity}:${p.action}:${p.scope}`;
          if (!catalog.has(k)) catalog.set(k, p);
        }
      }
      console.log(`Seeded role ${seed.key} with ${seed.permissions.length} permissions.`);
    }

    for (const p of catalog.values()) {
      await prisma.authzPermission.upsert({
        where: {
          entity_action_scope: {
            entity: p.entity,
            action: p.action,
            scope: p.scope,
          },
        },
        update: {
          description: permissionDescription(p.entity, p.action, p.scope),
          isSystem: true,
        },
        create: {
          entity: p.entity,
          action: p.action,
          scope: p.scope,
          description: permissionDescription(p.entity, p.action, p.scope),
          isSystem: true,
        },
      });
    }

    for (const action of CRUD_ACTIONS) {
      await prisma.authzPermission.upsert({
        where: {
          entity_action_scope: {
            entity: "message",
            action,
            scope: "user",
          },
        },
        update: {
          description: permissionDescription("message", action, "user"),
          isSystem: true,
        },
        create: {
          entity: "message",
          action,
          scope: "user",
          description: permissionDescription("message", action, "user"),
          isSystem: true,
        },
      });
    }
    console.log(`Seeded ${catalog.size} system permission definitions.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

