import { beforeEach, describe, expect, it, vi } from "vitest";
import { can } from "@/lib/authz/authorize";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
    treeOwner: { findFirst: vi.fn() },
    treeMaintainer: { findFirst: vi.fn() },
    treeContributor: { findFirst: vi.fn() },
    permission: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/database/prisma", () => ({
  prisma: prismaMock,
}));

describe("authz can()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", isActive: true, isWebsiteOwner: false });
    prismaMock.userRole.findMany.mockResolvedValue([]);
    prismaMock.treeOwner.findFirst.mockResolvedValue(null);
    prismaMock.treeMaintainer.findFirst.mockResolvedValue(null);
    prismaMock.treeContributor.findFirst.mockResolvedValue(null);
    prismaMock.permission.findMany.mockResolvedValue([]);
  });

  it("denies inactive user", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1", isActive: false, isWebsiteOwner: false });
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: "t1" })).resolves.toBe(false);
  });

  it("allows website owner for everything", async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce({ id: "u1", isActive: true, isWebsiteOwner: true });
    await expect(can({ userId: "u1", entity: "role", action: "delete", scope: "site" })).resolves.toBe(true);
  });

  it("allows explicit role permission", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "custom_role", permissions: [{ entity: "individual", action: "read", scope: "tree" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("allows explicit non-CRUD action permissions", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "custom_role", permissions: [{ entity: "gedcom", action: "merge_records", scope: "gedcom" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "gedcom", action: "merge_records", scope: "gedcom", treeId: "t1" })).resolves.toBe(true);
  });

  it("denies missing permission", async () => {
    await expect(can({ userId: "u1", entity: "family", action: "update", scope: "tree", treeId: "t1" })).resolves.toBe(false);
  });

  it("treats manage as implied CRUD", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "custom_role", permissions: [{ entity: "event", action: "manage", scope: "tree" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "event", action: "delete", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("does not apply tree assignment to other trees", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "custom_role", permissions: [{ entity: "individual", action: "read", scope: "tree" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: "t2" })).resolves.toBe(false);
  });

  it("allows user scoped permission only for own resources", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        treeId: null,
        role: { key: "custom_role", permissions: [{ entity: "media", action: "update", scope: "user" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "media", action: "update", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "media", action: "update", scope: "user", ownerUserId: "u2" })).resolves.toBe(false);
  });

  it("allows other_users scoped permission only for non-owned resources", async () => {
    prismaMock.userRole.findMany.mockResolvedValue([
      {
        treeId: null,
        role: { key: "custom_role", permissions: [{ entity: "media", action: "read", scope: "other_users" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "media", action: "read", scope: "other_users", ownerUserId: "u2" })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "media", action: "read", scope: "other_users", ownerUserId: "u1" })).resolves.toBe(false);
  });

  it("allows site scope permission for tree scoped request", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: null,
        role: { key: "custom_role", permissions: [{ entity: "individual", action: "read", scope: "site" }] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("allows site_admin as super role", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: null,
        role: { key: "site_admin", permissions: [] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "permission", action: "delete", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("allows tree_owner as super role for tree scopes", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "tree_owner", permissions: [] },
      },
    ]);
    await expect(can({ userId: "u1", entity: "user", action: "update", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("allows tree_owner as super role for other_users scope", async () => {
    prismaMock.userRole.findMany.mockResolvedValueOnce([
      {
        treeId: "t1",
        role: { key: "tree_owner", permissions: [] },
      },
    ]);
    await expect(
      can({ userId: "u1", entity: "story", action: "read", scope: "other_users", ownerUserId: "u2", treeId: "t1" }),
    ).resolves.toBe(true);
  });

  it("falls back to legacy tree owner role", async () => {
    prismaMock.treeOwner.findFirst.mockResolvedValueOnce({ id: "owner-row" });
    await expect(can({ userId: "u1", entity: "family", action: "delete", scope: "tree", treeId: "t1" })).resolves.toBe(true);
  });

  it("uses compatibility fallback for user-owned tag/media/album routes", async () => {
    await expect(can({ userId: "u1", entity: "media", action: "update", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "tag", action: "delete", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "album", action: "create", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
  });

  it("uses compatibility fallback for user-owned messages", async () => {
    await expect(can({ userId: "u1", entity: "message", action: "create", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "message", action: "delete", scope: "user", ownerUserId: "u1" })).resolves.toBe(true);
  });

  it("denies contributor for role/user/permission even read", async () => {
    prismaMock.treeContributor.findFirst.mockResolvedValueOnce({ id: "c-row" });
    await expect(can({ userId: "u1", entity: "permission", action: "read", scope: "tree", treeId: "t1" })).resolves.toBe(false);
  });
});

