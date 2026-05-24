import { describe, it, expect, vi, beforeEach } from "vitest";
import { CRON_JOBS, getAllCronJobStatuses, triggerCronJob } from "./cron-jobs.ts";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("../database/prisma.ts", () => ({
  prisma: {
    siteHealthRun: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    backup: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    gedcomBranchRun: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("../health/checks.ts", () => ({
  buildCheckContext: vi.fn().mockResolvedValue({}),
  runAllChecks: vi.fn().mockResolvedValue([]),
}));

vi.mock("./backup-service.ts", () => ({
  runBackup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./branch-detection.ts", () => ({
  runBranchDetection: vi.fn().mockResolvedValue({ type: "branch-detection" }),
}));

vi.mock("../infra/admin-tree.ts", () => ({
  getAdminFileUuid: vi.fn().mockResolvedValue("file-uuid-test"),
  _resetAdminFileUuidCache: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaMock: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let checksMock: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let backupServiceMock: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let branchDetectionMock: any;

beforeEach(async () => {
  vi.clearAllMocks();
  const prismaModule = await import("../database/prisma.ts");
  prismaMock = prismaModule.prisma;
  prismaMock.siteHealthRun.findFirst.mockResolvedValue(null);
  prismaMock.backup.findFirst.mockResolvedValue(null);
  prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(null);

  const checksModule = await import("../health/checks.ts");
  checksMock = checksModule;
  checksMock.buildCheckContext.mockResolvedValue({});
  checksMock.runAllChecks.mockResolvedValue([]);

  const backupModule = await import("./backup-service.ts");
  backupServiceMock = backupModule;
  backupServiceMock.runBackup.mockResolvedValue(undefined);

  const branchModule = await import("./branch-detection.ts");
  branchDetectionMock = branchModule;
  branchDetectionMock.runBranchDetection.mockResolvedValue({ type: "branch-detection" });
});

// ── CRON_JOBS registry ────────────────────────────────────────────────────────

describe("CRON_JOBS registry", () => {
  it("contains exactly three jobs", () => {
    expect(CRON_JOBS).toHaveLength(3);
  });

  it("contains all required job IDs", () => {
    const ids = CRON_JOBS.map((j) => j.id);
    expect(ids).toContain("site-health");
    expect(ids).toContain("backup");
    expect(ids).toContain("branch-detection");
  });

  it("every job has label, description, schedule, and humanSchedule", () => {
    for (const job of CRON_JOBS) {
      expect(job.label).toBeTruthy();
      expect(job.description).toBeTruthy();
      expect(job.schedule).toBeTruthy();
      expect(job.humanSchedule).toBeTruthy();
    }
  });

  it("IDs are unique", () => {
    const ids = CRON_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── getAllCronJobStatuses — null last-run ──────────────────────────────────────

describe("getAllCronJobStatuses — no prior runs", () => {
  it("returns a status entry for each registered job", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses).toHaveLength(CRON_JOBS.length);
  });

  it("each status includes the job metadata fields", async () => {
    const statuses = await getAllCronJobStatuses();
    for (const status of statuses) {
      expect(status.id).toBeTruthy();
      expect(status.label).toBeTruthy();
      expect(status.schedule).toBeTruthy();
    }
  });

  it("lastRun is null for all jobs when no runs exist", async () => {
    const statuses = await getAllCronJobStatuses();
    for (const status of statuses) {
      expect(status.lastRun).toBeNull();
    }
  });
});

// ── getSiteHealthLastRun shape ────────────────────────────────────────────────

describe("getAllCronJobStatuses — site-health last-run shape", () => {
  const startedAt = new Date("2026-05-01T08:00:00.000Z");
  const completedAt = new Date("2026-05-01T08:01:30.000Z"); // 90s later

  function makeHealthRun(overrides = {}) {
    return {
      id: "run-health-1",
      triggeredBy: "scheduled",
      startedAt,
      completedAt,
      results: [
        { checkKey: "orphaned_media", label: "Orphaned media", description: "", category: "media", count: 3, batchAction: "delete" },
        { checkKey: "missing_birth", label: "Missing birth year", description: "", category: "data_integrity", count: 5, batchAction: null },
        { checkKey: "clean_check", label: "No issues here", description: "", category: "data_integrity", count: 0, batchAction: null },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    prismaMock.siteHealthRun.findFirst.mockResolvedValue(makeHealthRun());
  });

  it("returns the correct CronLastRun shape", async () => {
    const statuses = await getAllCronJobStatuses();
    const health = statuses.find((s) => s.id === "site-health")!;
    expect(health.lastRun).not.toBeNull();
    const run = health.lastRun!;
    expect(run.id).toBe("run-health-1");
    expect(run.triggeredBy).toBe("scheduled");
    expect(run.startedAt).toBe(startedAt.toISOString());
    expect(run.completedAt).toBe(completedAt.toISOString());
  });

  it("calculates durationMs correctly", async () => {
    const statuses = await getAllCronJobStatuses();
    const run = statuses.find((s) => s.id === "site-health")!.lastRun!;
    expect(run.durationMs).toBe(90_000);
  });

  it("durationMs is null when completedAt is null", async () => {
    prismaMock.siteHealthRun.findFirst.mockResolvedValue(makeHealthRun({ completedAt: null }));
    const statuses = await getAllCronJobStatuses();
    const run = statuses.find((s) => s.id === "site-health")!.lastRun!;
    expect(run.durationMs).toBeNull();
  });

  it("ok is true when completedAt is set", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "site-health")!.lastRun!.ok).toBe(true);
  });

  it("ok is false when completedAt is null", async () => {
    prismaMock.siteHealthRun.findFirst.mockResolvedValue(makeHealthRun({ completedAt: null }));
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "site-health")!.lastRun!.ok).toBe(false);
  });

  it("sums totalIssues from check counts (ignores zero counts)", async () => {
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "site-health")!.lastRun!.summary;
    expect(summary.type).toBe("site-health");
    if (summary.type === "site-health") expect(summary.totalIssues).toBe(8); // 3 + 5
  });

  it("breakdown groups counts by category, excludes zero-count checks", async () => {
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "site-health")!.lastRun!.summary;
    if (summary.type !== "site-health") return;
    const mediaEntry = summary.breakdown.find((b) => b.category === "media");
    const diEntry = summary.breakdown.find((b) => b.category === "data_integrity");
    expect(mediaEntry?.count).toBe(3);
    expect(diEntry?.count).toBe(5);
    expect(summary.breakdown).toHaveLength(2); // zero-count category excluded
  });

  it("checks list contains only entries with count > 0", async () => {
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "site-health")!.lastRun!.summary;
    if (summary.type !== "site-health") return;
    expect(summary.checks).toHaveLength(2);
    expect(summary.checks.every((c) => c.count > 0)).toBe(true);
  });

  it("unknown category key falls back to raw category string in breakdown label", async () => {
    prismaMock.siteHealthRun.findFirst.mockResolvedValue(
      makeHealthRun({
        results: [
          { checkKey: "x", label: "X", description: "", category: "unknown_cat", count: 1, batchAction: null },
        ],
      }),
    );
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "site-health")!.lastRun!.summary;
    if (summary.type !== "site-health") return;
    expect(summary.breakdown[0].label).toBe("unknown_cat");
  });
});

// ── getBackupLastRun shape ────────────────────────────────────────────────────

describe("getAllCronJobStatuses — backup last-run shape", () => {
  const createdAt = new Date("2026-05-01T02:00:00.000Z");
  const completedAt = new Date("2026-05-01T02:05:00.000Z"); // 5 min later

  function makeBackupRun(overrides = {}) {
    return {
      id: "backup-1",
      createdAt,
      completedAt,
      trigger: "SCHEDULED",
      status: "COMPLETE",
      fileSize: BigInt(1024 * 1024 * 50), // 50 MB
      schemaVersion: "1.2.3",
      errorMessage: null,
      manifest: { mediaFileCount: 200 },
      ...overrides,
    };
  }

  beforeEach(() => {
    prismaMock.backup.findFirst.mockResolvedValue(makeBackupRun());
  });

  it("returns the correct CronLastRun shape", async () => {
    const statuses = await getAllCronJobStatuses();
    const job = statuses.find((s) => s.id === "backup")!;
    expect(job.lastRun).not.toBeNull();
    const run = job.lastRun!;
    expect(run.id).toBe("backup-1");
    expect(run.startedAt).toBe(createdAt.toISOString());
    expect(run.completedAt).toBe(completedAt.toISOString());
  });

  it("lowercases the trigger field", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "backup")!.lastRun!.triggeredBy).toBe("scheduled");
  });

  it("ok is true when status is COMPLETE", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "backup")!.lastRun!.ok).toBe(true);
  });

  it("ok is false when status is not COMPLETE", async () => {
    prismaMock.backup.findFirst.mockResolvedValue(makeBackupRun({ status: "FAILED" }));
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "backup")!.lastRun!.ok).toBe(false);
  });

  it("calculates durationMs correctly", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "backup")!.lastRun!.durationMs).toBe(300_000);
  });

  it("extracts mediaFileCount from manifest", async () => {
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "backup")!.lastRun!.summary;
    if (summary.type === "backup") expect(summary.mediaFileCount).toBe(200);
  });

  it("mediaFileCount is null when manifest is absent", async () => {
    prismaMock.backup.findFirst.mockResolvedValue(makeBackupRun({ manifest: null }));
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "backup")!.lastRun!.summary;
    if (summary.type === "backup") expect(summary.mediaFileCount).toBeNull();
  });

  it("fileSize is null when row has no fileSize", async () => {
    prismaMock.backup.findFirst.mockResolvedValue(makeBackupRun({ fileSize: null }));
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "backup")!.lastRun!.summary;
    if (summary.type === "backup") expect(summary.fileSize).toBeNull();
  });
});

// ── getBranchDetectionLastRun shape ───────────────────────────────────────────

describe("getAllCronJobStatuses — branch-detection last-run shape", () => {
  const startedAt = new Date("2026-05-04T03:00:00.000Z");
  const completedAt = new Date("2026-05-04T03:00:45.000Z"); // 45s later

  function makeBranchRun(overrides = {}) {
    return {
      id: "branch-run-1",
      fileUuid: "file-uuid-1",
      startedAt,
      completedAt,
      triggeredBy: "scheduled",
      totalBranches: 4,
      mainBranchSize: 120,
      isolatedIndividuals: 3,
      newBranches: 1,
      mergedBranches: 0,
      updatedBranches: 2,
      errorMessage: null,
      ...overrides,
    };
  }

  beforeEach(() => {
    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(makeBranchRun());
  });

  it("returns the correct CronLastRun shape", async () => {
    const statuses = await getAllCronJobStatuses();
    const job = statuses.find((s) => s.id === "branch-detection")!;
    expect(job.lastRun).not.toBeNull();
    const run = job.lastRun!;
    expect(run.id).toBe("branch-run-1");
    expect(run.startedAt).toBe(startedAt.toISOString());
    expect(run.completedAt).toBe(completedAt.toISOString());
  });

  it("calculates durationMs correctly", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "branch-detection")!.lastRun!.durationMs).toBe(45_000);
  });

  it("ok is true when completed with no error", async () => {
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "branch-detection")!.lastRun!.ok).toBe(true);
  });

  it("ok is false when errorMessage is set", async () => {
    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(
      makeBranchRun({ errorMessage: "Something broke" }),
    );
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "branch-detection")!.lastRun!.ok).toBe(false);
  });

  it("ok is false when completedAt is null", async () => {
    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(
      makeBranchRun({ completedAt: null }),
    );
    const statuses = await getAllCronJobStatuses();
    expect(statuses.find((s) => s.id === "branch-detection")!.lastRun!.ok).toBe(false);
  });

  it("null numeric fields default to 0 in summary", async () => {
    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(
      makeBranchRun({
        totalBranches: null,
        mainBranchSize: null,
        isolatedIndividuals: null,
        newBranches: null,
        mergedBranches: null,
        updatedBranches: null,
      }),
    );
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "branch-detection")!.lastRun!.summary;
    if (summary.type === "branch-detection") {
      expect(summary.totalBranches).toBe(0);
      expect(summary.mainBranchSize).toBe(0);
      expect(summary.isolatedIndividuals).toBe(0);
      expect(summary.newBranches).toBe(0);
      expect(summary.mergedBranches).toBe(0);
      expect(summary.updatedBranches).toBe(0);
    }
  });

  it("propagates errorMessage into summary", async () => {
    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue(
      makeBranchRun({ errorMessage: "DB timeout" }),
    );
    const statuses = await getAllCronJobStatuses();
    const summary = statuses.find((s) => s.id === "branch-detection")!.lastRun!.summary;
    if (summary.type === "branch-detection") expect(summary.errorMessage).toBe("DB timeout");
  });
});

// ── triggerCronJob dispatch ───────────────────────────────────────────────────

describe("triggerCronJob dispatch", () => {
  it("site-health: creates a run record, runs checks, and updates the record", async () => {
    prismaMock.siteHealthRun.create.mockResolvedValue({ id: "run-new" });
    prismaMock.siteHealthRun.update.mockResolvedValue({});
    prismaMock.siteHealthRun.findFirst.mockResolvedValue({
      id: "run-new",
      triggeredBy: "manual",
      startedAt: new Date(),
      completedAt: new Date(),
      results: [],
    });
    checksMock.runAllChecks.mockResolvedValue([]);

    await triggerCronJob("site-health");

    expect(prismaMock.siteHealthRun.create).toHaveBeenCalledOnce();
    expect(checksMock.buildCheckContext).toHaveBeenCalledOnce();
    expect(checksMock.runAllChecks).toHaveBeenCalledOnce();
    expect(prismaMock.siteHealthRun.update).toHaveBeenCalledOnce();
  });

  it("backup: creates a backup row and delegates to runBackup", async () => {
    prismaMock.backup.create.mockResolvedValue({ id: "backup-new" });
    prismaMock.backup.findFirst.mockResolvedValue({
      id: "backup-new",
      createdAt: new Date(),
      completedAt: new Date(),
      trigger: "MANUAL",
      status: "COMPLETE",
      fileSize: null,
      schemaVersion: "1.0",
      errorMessage: null,
      manifest: null,
    });

    await triggerCronJob("backup");

    expect(prismaMock.backup.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "PENDING", trigger: "MANUAL" } }),
    );
    expect(backupServiceMock.runBackup).toHaveBeenCalledWith("backup-new");
  });

  it("branch-detection: resolves fileUuid and delegates to runBranchDetection", async () => {
    const { getAdminFileUuid } = await import("../infra/admin-tree.ts");
    vi.mocked(getAdminFileUuid).mockResolvedValue("file-uuid-test");

    prismaMock.gedcomBranchRun.findFirst.mockResolvedValue({
      id: "branch-run-new",
      startedAt: new Date(),
      completedAt: new Date(),
      triggeredBy: "manual",
      errorMessage: null,
      totalBranches: 2,
      mainBranchSize: 10,
      isolatedIndividuals: 0,
      newBranches: 0,
      mergedBranches: 0,
      updatedBranches: 0,
    });

    await triggerCronJob("branch-detection");

    expect(getAdminFileUuid).toHaveBeenCalledOnce();
    expect(branchDetectionMock.runBranchDetection).toHaveBeenCalledWith("file-uuid-test", "manual");
  });

  it("throws for an unknown job ID", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(triggerCronJob("unknown-job" as any)).rejects.toThrow("Unknown cron job");
  });
});
