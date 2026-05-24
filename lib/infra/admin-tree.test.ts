import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveAdminGedcomFileUuid,
  getAdminFileUuid,
  getAdminTreeId,
  AdminTreeResolutionError,
  _resetAdminFileUuidCache,
} from "./admin-tree.ts";

// ── Prisma mock ───────────────────────────────────────────────────────────────

vi.mock("../database/prisma.ts", () => ({
  prisma: {
    tree: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    gedcomFile: {
      findFirst: vi.fn(),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaMock: any;

beforeEach(async () => {
  vi.clearAllMocks();
  _resetAdminFileUuidCache();
  // Reset env vars
  delete process.env.ADMIN_TREE_ID;
  delete process.env.ADMIN_TREE_FILE_ID;

  const mod = await import("../database/prisma.ts");
  prismaMock = mod.prisma;
});

// ── resolveAdminGedcomFileUuid ────────────────────────────────────────────────

describe("resolveAdminGedcomFileUuid", () => {
  describe("ADMIN_TREE_ID path", () => {
    it("resolves via tree when ADMIN_TREE_ID points to a tree with a gedcomFileId", async () => {
      process.env.ADMIN_TREE_ID = "tree-abc";
      prismaMock.tree.findUnique.mockResolvedValue({ gedcomFileId: "file-uuid-1" });

      const result = await resolveAdminGedcomFileUuid();
      expect(result).toEqual({ ok: true, fileUuid: "file-uuid-1" });
      expect(prismaMock.tree.findUnique).toHaveBeenCalledWith({
        where: { id: "tree-abc" },
        select: { gedcomFileId: true },
      });
    });

    it("returns ok:false when ADMIN_TREE_ID matches no tree", async () => {
      process.env.ADMIN_TREE_ID = "no-such-tree";
      prismaMock.tree.findUnique.mockResolvedValue(null);

      const result = await resolveAdminGedcomFileUuid();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("ADMIN_TREE_ID=no-such-tree");
    });

    it("returns ok:false with 'no linked GEDCOM file' when tree has null gedcomFileId", async () => {
      process.env.ADMIN_TREE_ID = "tree-no-file";
      prismaMock.tree.findUnique.mockResolvedValue({ gedcomFileId: null });

      const result = await resolveAdminGedcomFileUuid();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("no linked GEDCOM file");
    });

    it("falls through to ADMIN_TREE_FILE_ID when tree has null gedcomFileId", async () => {
      process.env.ADMIN_TREE_ID = "tree-no-file";
      process.env.ADMIN_TREE_FILE_ID = "some-file-id";
      prismaMock.tree.findUnique.mockResolvedValue({ gedcomFileId: null });
      prismaMock.gedcomFile.findFirst.mockResolvedValue({ id: "file-uuid-2" });

      const result = await resolveAdminGedcomFileUuid();
      expect(result).toEqual({ ok: true, fileUuid: "file-uuid-2" });
    });
  });

  describe("ADMIN_TREE_FILE_ID path", () => {
    it("resolves via gedcom_files when ADMIN_TREE_FILE_ID is set", async () => {
      process.env.ADMIN_TREE_FILE_ID = "gedcom-file-ref";
      prismaMock.gedcomFile.findFirst.mockResolvedValue({ id: "file-uuid-3" });

      const result = await resolveAdminGedcomFileUuid();
      expect(result).toEqual({ ok: true, fileUuid: "file-uuid-3" });
      expect(prismaMock.gedcomFile.findFirst).toHaveBeenCalledWith({
        where: { fileId: "gedcom-file-ref" },
        select: { id: true },
      });
    });

    it("returns ok:false when ADMIN_TREE_FILE_ID matches no row in gedcom_files", async () => {
      process.env.ADMIN_TREE_FILE_ID = "missing-ref";
      prismaMock.gedcomFile.findFirst.mockResolvedValue(null);

      const result = await resolveAdminGedcomFileUuid();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("ADMIN_TREE_FILE_ID is set but no row");
    });
  });

  describe("neither env var set", () => {
    it("returns ok:false with configuration guidance", async () => {
      const result = await resolveAdminGedcomFileUuid();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toContain("Admin tree not configured");
    });

    it("does not call the database when no env vars are set", async () => {
      await resolveAdminGedcomFileUuid();
      expect(prismaMock.tree.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.gedcomFile.findFirst).not.toHaveBeenCalled();
    });
  });
});

// ── getAdminFileUuid ──────────────────────────────────────────────────────────

describe("getAdminFileUuid", () => {
  it("returns the resolved file UUID", async () => {
    process.env.ADMIN_TREE_ID = "tree-1";
    prismaMock.tree.findUnique.mockResolvedValue({ gedcomFileId: "file-uuid-ok" });

    expect(await getAdminFileUuid()).toBe("file-uuid-ok");
  });

  it("caches the result — Prisma is only called once across two calls", async () => {
    process.env.ADMIN_TREE_ID = "tree-1";
    prismaMock.tree.findUnique.mockResolvedValue({ gedcomFileId: "cached-uuid" });

    await getAdminFileUuid();
    await getAdminFileUuid();

    expect(prismaMock.tree.findUnique).toHaveBeenCalledOnce();
  });

  it("throws AdminTreeResolutionError when resolution fails", async () => {
    // No env vars → resolution fails
    await expect(getAdminFileUuid()).rejects.toThrow(AdminTreeResolutionError);
  });

  it("error message from resolution is propagated to the thrown error", async () => {
    process.env.ADMIN_TREE_ID = "bad-id";
    prismaMock.tree.findUnique.mockResolvedValue(null);

    await expect(getAdminFileUuid()).rejects.toThrow("ADMIN_TREE_ID=bad-id");
  });
});

// ── getAdminTreeId ────────────────────────────────────────────────────────────

describe("getAdminTreeId", () => {
  it("returns the tree id directly when ADMIN_TREE_ID is set and the row exists", async () => {
    process.env.ADMIN_TREE_ID = "tree-direct";
    prismaMock.tree.findUnique.mockResolvedValue({ id: "tree-direct" });

    expect(await getAdminTreeId()).toBe("tree-direct");
  });

  it("throws AdminTreeResolutionError when ADMIN_TREE_ID tree is not found", async () => {
    process.env.ADMIN_TREE_ID = "no-tree";
    // findUnique called once for ADMIN_TREE_ID check → null
    prismaMock.tree.findUnique.mockResolvedValue(null);

    await expect(getAdminTreeId()).rejects.toThrow(AdminTreeResolutionError);
  });

  it("falls back to gedcomFileId lookup when ADMIN_TREE_ID is not set", async () => {
    process.env.ADMIN_TREE_FILE_ID = "file-ref";
    prismaMock.gedcomFile.findFirst.mockResolvedValue({ id: "file-uuid-fallback" });
    prismaMock.tree.findFirst.mockResolvedValue({ id: "tree-via-file" });

    expect(await getAdminTreeId()).toBe("tree-via-file");
    expect(prismaMock.tree.findFirst).toHaveBeenCalledWith({
      where: { gedcomFileId: "file-uuid-fallback" },
      select: { id: true },
    });
  });

  it("throws AdminTreeResolutionError when no tree is linked to the GEDCOM file", async () => {
    process.env.ADMIN_TREE_FILE_ID = "file-ref";
    prismaMock.gedcomFile.findFirst.mockResolvedValue({ id: "file-uuid-orphan" });
    prismaMock.tree.findFirst.mockResolvedValue(null);

    await expect(getAdminTreeId()).rejects.toThrow(AdminTreeResolutionError);
  });
});

// ── AdminTreeResolutionError ──────────────────────────────────────────────────

describe("AdminTreeResolutionError", () => {
  it("has name AdminTreeResolutionError", () => {
    const err = new AdminTreeResolutionError("msg");
    expect(err.name).toBe("AdminTreeResolutionError");
  });

  it("is an instance of Error", () => {
    expect(new AdminTreeResolutionError("x")).toBeInstanceOf(Error);
  });
});
