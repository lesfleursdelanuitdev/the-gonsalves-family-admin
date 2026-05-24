import { describe, it, expect, vi, beforeEach } from "vitest";
import { join } from "node:path";

// ── fs/promises mock ──────────────────────────────────────────────────────────

const unlinkMock = vi.fn().mockResolvedValue(undefined);
const mkdirMock = vi.fn().mockResolvedValue(undefined);
const statMock = vi.fn().mockResolvedValue({ size: 1024 });
const accessMock = vi.fn().mockResolvedValue(undefined);
const readdirMock = vi.fn().mockResolvedValue([]);

vi.mock("node:fs/promises", () => ({
  unlink: unlinkMock,
  mkdir: mkdirMock,
  stat: statMock,
  readdir: readdirMock,
  access: accessMock,
  constants: { R_OK: 4 },
}));

// ── Prisma mock ───────────────────────────────────────────────────────────────

vi.mock("../database/prisma.ts", () => ({
  prisma: {
    backup: {
      findMany: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

// ── Other heavy deps — not under test ────────────────────────────────────────

vi.mock("../infra/admin-tree.ts", () => ({
  getAdminFileUuid: vi.fn().mockResolvedValue("file-uuid"),
  getAdminTreeId: vi.fn().mockResolvedValue("tree-id"),
}));
vi.mock("./build-enriched-document-for-export.ts", () => ({
  buildEnrichedDocumentForExport: vi.fn().mockResolvedValue({ Media: [] }),
}));
vi.mock("./backup-extras.ts", () => ({
  buildBackupExtras: vi.fn().mockResolvedValue({}),
}));
vi.mock("./lib-api-export.ts", () => ({
  postLibApiExport: vi.fn().mockResolvedValue(Buffer.alloc(0)),
}));
vi.mock("./resolve-file-ref-to-gedcom-disk-path.ts", () => ({
  resolveFileRefToGedcomAdminDiskPath: vi.fn().mockReturnValue(null),
  zipEntryNameForMedia: vi.fn().mockReturnValue("media/file.jpg"),
}));

// ── Subject under test ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaMock: any;

beforeEach(async () => {
  vi.clearAllMocks();
  unlinkMock.mockResolvedValue(undefined);
  const mod = await import("../database/prisma.ts");
  prismaMock = mod.prisma;
  prismaMock.backup.findMany.mockResolvedValue([]);
  prismaMock.backup.delete.mockResolvedValue({});
});

// ── getBackupsDir ─────────────────────────────────────────────────────────────

describe("getBackupsDir", () => {
  it("returns BACKUPS_DIR env var when set", async () => {
    process.env.BACKUPS_DIR = "/custom/backups";
    const { getBackupsDir } = await import("./backup-service.ts");
    expect(getBackupsDir()).toBe("/custom/backups");
    delete process.env.BACKUPS_DIR;
  });

  it("falls back to cwd()/backups when BACKUPS_DIR is not set", async () => {
    delete process.env.BACKUPS_DIR;
    const { getBackupsDir } = await import("./backup-service.ts");
    expect(getBackupsDir()).toBe(join(process.cwd(), "backups"));
  });
});

// ── applyRetentionPolicy ──────────────────────────────────────────────────────

describe("applyRetentionPolicy", () => {
  it("queries for COMPLETE backups excluding keepBackupId", async () => {
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");
    expect(prismaMock.backup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "COMPLETE",
          id: { not: "keep-id" },
          filePath: { not: null },
        }),
      }),
    );
  });

  it("orders by createdAt desc", async () => {
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");
    expect(prismaMock.backup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("skips BACKUP_RETENTION - 1 rows (default 10 → skip 9)", async () => {
    delete process.env.BACKUP_RETENTION_COUNT;
    // Module was loaded with default; just verify skip value
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");
    expect(prismaMock.backup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 9 }),
    );
  });

  it("respects BACKUP_RETENTION_COUNT env var when module is re-loaded", async () => {
    process.env.BACKUP_RETENTION_COUNT = "3";
    vi.resetModules();
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    const freshPrisma = (await import("../database/prisma.ts")).prisma;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (freshPrisma.backup.findMany as any).mockResolvedValue([]);
    await applyRetentionPolicy("keep-id");
    expect(freshPrisma.backup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2 }), // BACKUP_RETENTION=3 → skip=2
    );
    delete process.env.BACKUP_RETENTION_COUNT;
  });

  it("does nothing when no old backups are returned", async () => {
    prismaMock.backup.findMany.mockResolvedValue([]);
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");
    expect(unlinkMock).not.toHaveBeenCalled();
    expect(prismaMock.backup.delete).not.toHaveBeenCalled();
  });

  it("unlinks the file path and deletes the DB row for each old backup", async () => {
    prismaMock.backup.findMany.mockResolvedValue([
      { id: "old-1", filePath: "/backups/2025-01-backup.zip" },
      { id: "old-2", filePath: "/backups/2025-02-backup.zip" },
    ]);
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");

    expect(unlinkMock).toHaveBeenCalledWith("/backups/2025-01-backup.zip");
    expect(unlinkMock).toHaveBeenCalledWith("/backups/2025-02-backup.zip");
    expect(prismaMock.backup.delete).toHaveBeenCalledWith({ where: { id: "old-1" } });
    expect(prismaMock.backup.delete).toHaveBeenCalledWith({ where: { id: "old-2" } });
  });

  it("skips unlink when filePath is null, but still deletes the DB row", async () => {
    prismaMock.backup.findMany.mockResolvedValue([{ id: "old-nofile", filePath: null }]);
    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");

    expect(unlinkMock).not.toHaveBeenCalled();
    expect(prismaMock.backup.delete).toHaveBeenCalledWith({ where: { id: "old-nofile" } });
  });

  it("silently ignores unlink ENOENT errors and still deletes the DB row", async () => {
    prismaMock.backup.findMany.mockResolvedValue([
      { id: "old-missing", filePath: "/backups/gone.zip" },
    ]);
    unlinkMock.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await expect(applyRetentionPolicy("keep-id")).resolves.toBeUndefined();
    expect(prismaMock.backup.delete).toHaveBeenCalledWith({ where: { id: "old-missing" } });
  });

  it("silently ignores DB delete errors", async () => {
    prismaMock.backup.findMany.mockResolvedValue([{ id: "old-1", filePath: null }]);
    prismaMock.backup.delete.mockRejectedValue(new Error("DB gone"));

    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await expect(applyRetentionPolicy("keep-id")).resolves.toBeUndefined();
  });

  it("processes multiple old backups independently — one failure does not stop others", async () => {
    prismaMock.backup.findMany.mockResolvedValue([
      { id: "old-1", filePath: "/backups/a.zip" },
      { id: "old-2", filePath: "/backups/b.zip" },
    ]);
    // First unlink fails, second should still be attempted
    unlinkMock
      .mockRejectedValueOnce(new Error("ENOENT"))
      .mockResolvedValueOnce(undefined);

    const { applyRetentionPolicy } = await import("./backup-service.ts");
    await applyRetentionPolicy("keep-id");

    expect(unlinkMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.backup.delete).toHaveBeenCalledTimes(2);
  });
});
