/**
 * Additional coverage for can() legacy fallback paths and requirePermission.
 * The main authorize.test.ts covers the RBAC happy-path; this file covers:
 *   - legacyRoleFallback: treeMaintainer and treeContributor role rows
 *   - legacyPermissionFallback: direct permission rows with expiry
 *   - requirePermission: throws AuthorizationError on denial
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { can, requirePermission, AuthorizationError } from "@/lib/authz/authorize";
import { ResourceType } from "@ligneous/prisma";

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

const ACTIVE_USER = { id: "u1", isActive: true, isWebsiteOwner: false };
const TREE = "t1";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue(ACTIVE_USER);
  prismaMock.userRole.findMany.mockResolvedValue([]);
  prismaMock.treeOwner.findFirst.mockResolvedValue(null);
  prismaMock.treeMaintainer.findFirst.mockResolvedValue(null);
  prismaMock.treeContributor.findFirst.mockResolvedValue(null);
  prismaMock.permission.findMany.mockResolvedValue([]);
});

// ── legacyRoleFallback: treeMaintainer ────────────────────────────────────────

describe("legacy treeMaintainer role", () => {
  beforeEach(() => {
    prismaMock.treeMaintainer.findFirst.mockResolvedValue({ id: "maint-row" });
  });

  it("allows create on individuals", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows read on individuals", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows update on families", async () => {
    await expect(can({ userId: "u1", entity: "family", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows create on events", async () => {
    await expect(can({ userId: "u1", entity: "event", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("denies delete on any entity", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
    await expect(can({ userId: "u1", entity: "family", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
    await expect(can({ userId: "u1", entity: "event", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies read on role entity", async () => {
    await expect(can({ userId: "u1", entity: "role", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies all actions on user entity", async () => {
    await expect(can({ userId: "u1", entity: "user", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
    await expect(can({ userId: "u1", entity: "user", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies all actions on permission entity", async () => {
    await expect(can({ userId: "u1", entity: "permission", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });
});

// ── legacyRoleFallback: treeContributor ───────────────────────────────────────

describe("legacy treeContributor role", () => {
  beforeEach(() => {
    prismaMock.treeContributor.findFirst.mockResolvedValue({ id: "contrib-row" });
  });

  it("allows read on individuals", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows read on families", async () => {
    await expect(can({ userId: "u1", entity: "family", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("denies create on individuals (contributor is read-only for most entities)", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies update on individuals", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies delete on individuals", async () => {
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("allows create on media (contributor exception)", async () => {
    await expect(can({ userId: "u1", entity: "media", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows read on media", async () => {
    await expect(can({ userId: "u1", entity: "media", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows update on media", async () => {
    await expect(can({ userId: "u1", entity: "media", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("denies delete on media", async () => {
    await expect(can({ userId: "u1", entity: "media", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("allows create/update on tag", async () => {
    await expect(can({ userId: "u1", entity: "tag", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "tag", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("allows create/update on album", async () => {
    await expect(can({ userId: "u1", entity: "album", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "album", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("denies read on role entity", async () => {
    await expect(can({ userId: "u1", entity: "role", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies read on user entity", async () => {
    await expect(can({ userId: "u1", entity: "user", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("denies read on permission entity", async () => {
    await expect(can({ userId: "u1", entity: "permission", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });
});

// ── legacyPermissionFallback: direct permission rows ─────────────────────────

describe("legacy permission fallback: individual entity", () => {
  it("'admin' permissionType allows delete", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("'write' permissionType allows create", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "write", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("'write' permissionType allows update", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "write", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "update", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });

  it("'write' permissionType denies delete", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "write", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("'read' permissionType allows read only", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "read", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "individual", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("'delete' permissionType allows read and delete", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "delete", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "tree", treeId: TREE })).resolves.toBe(true);
    await expect(can({ userId: "u1", entity: "individual", action: "create", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("expired permission is ignored", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: new Date("2000-01-01") },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });

  it("not-yet-expired permission is honoured", async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: future },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });
});

describe("legacy permission fallback: family entity", () => {
  it("'admin' permissionType on family allows delete", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "family", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(true);
  });
});

describe("legacy permission fallback: non-tree scope skipped", () => {
  it("does not apply permission fallback for gedcom scope", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: null },
    ]);
    await expect(can({ userId: "u1", entity: "individual", action: "read", scope: "gedcom", treeId: TREE })).resolves.toBe(false);
  });
});

describe("legacy permission fallback: entity not mapped skipped", () => {
  it("does not apply for event entity (not in resourceType map)", async () => {
    prismaMock.permission.findMany.mockResolvedValue([
      { permissionType: "admin", expiresAt: null },
    ]);
    // event entity is not in the legacy permission map → should deny
    await expect(can({ userId: "u1", entity: "event", action: "delete", scope: "tree", treeId: TREE })).resolves.toBe(false);
  });
});

// ── requirePermission ─────────────────────────────────────────────────────────

describe("requirePermission", () => {
  it("does not throw when can() returns true", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", isActive: true, isWebsiteOwner: true });
    await expect(
      requirePermission({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })
    ).resolves.toBeUndefined();
  });

  it("throws AuthorizationError when can() returns false", async () => {
    await expect(
      requirePermission({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })
    ).rejects.toThrow(AuthorizationError);
  });

  it("thrown AuthorizationError has status 403", async () => {
    await expect(
      requirePermission({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })
    ).rejects.toMatchObject({ status: 403 });
  });

  it("thrown error message is 'Forbidden'", async () => {
    await expect(
      requirePermission({ userId: "u1", entity: "individual", action: "delete", scope: "tree", treeId: TREE })
    ).rejects.toThrow("Forbidden");
  });
});
