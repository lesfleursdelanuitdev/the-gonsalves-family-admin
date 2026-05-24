import { prisma } from "../database/prisma.ts";
import { runAllChecks, buildCheckContext } from "../health/checks.ts";
import { runBackup } from "./backup-service.ts";
import { runBranchDetection } from "./branch-detection.ts";
import { runLineageDetection } from "./lineage-detection.ts";
import { getAdminFileUuid } from "../infra/admin-tree.ts";
import type { CheckResult } from "../health/types.ts";

// ── Types ─────────��───────────────────────────────────────────────────────────

export type CronJobId = "site-health" | "backup" | "branch-detection" | "lineage-detection";

export type CronJobMeta = {
  id: CronJobId;
  label: string;
  description: string;
  schedule: string;
  humanSchedule: string;
};

export type SiteHealthSummary = {
  type: "site-health";
  totalIssues: number;
  breakdown: { category: string; label: string; count: number }[];
  checks: { checkKey: string; label: string; count: number; category: string }[];
};

export type BackupSummary = {
  type: "backup";
  status: string;
  fileSize: string | null;
  schemaVersion: string;
  mediaFileCount: number | null;
  errorMessage: string | null;
};

export type BranchDetectionSummary = {
  type: "branch-detection";
  totalBranches: number;
  mainBranchSize: number;
  mainBranchCoverage: number;
  isolatedIndividuals: number;
  newBranches: number;
  mergedBranches: number;
  updatedBranches: number;
  errorMessage: string | null;
};

export type LineageDetectionSummary = {
  type: "lineage-detection";
  totalLineages: number;
  newLineages: number;
  mergedLineages: number;
  updatedLineages: number;
  bridgeChildren: number;
  errorMessage: string | null;
};

export type CronLastRun = {
  id: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  triggeredBy: string;
  ok: boolean;
  summary: SiteHealthSummary | BackupSummary | BranchDetectionSummary | LineageDetectionSummary;
};

export type CronJobStatus = CronJobMeta & { lastRun: CronLastRun | null };

// ── Registry ─────────────────��──────────────────────────────────���─────────────

const CATEGORY_LABELS: Record<string, string> = {
  data_integrity: "Data integrity",
  media: "Media",
  community: "Community",
  user_hygiene: "User hygiene",
};

export const CRON_JOBS: CronJobMeta[] = [
  {
    id: "site-health",
    label: "Site health check",
    description: "Scans the tree for data integrity issues, orphaned media, and other anomalies.",
    schedule: "0 8 * * 1",
    humanSchedule: "Every Monday at 8:00 AM",
  },
  {
    id: "backup",
    label: "Monthly backup",
    description: "Creates a full archive ZIP: pg_dump, GEDCOM export, JSON export, extras, and all media files.",
    schedule: "0 2 1 * *",
    humanSchedule: "1st of every month at 2:00 AM",
  },
  {
    id: "branch-detection",
    label: "Branch detection",
    description: "Scans the pedigree graph to discover connected family branches and persists assignments to the database.",
    schedule: "0 3 * * 0",
    humanSchedule: "Every Sunday at 3:00 AM",
  },
  {
    id: "lineage-detection",
    label: "Lineage detection",
    description: "Traces directed pedigree lines from founding ancestors by surname and persists lineage memberships to the database.",
    schedule: "0 4 * * 0",
    humanSchedule: "Every Sunday at 4:00 AM",
  },
];

// ── Last-run queries ──────���─────────────────────────────────��─────────────────

async function getSiteHealthLastRun(): Promise<CronLastRun | null> {
  const run = await prisma.siteHealthRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  if (!run) return null;

  const results = (run.results ?? []) as CheckResult[];
  const totalIssues = results.reduce((s, r) => s + Math.max(0, r.count), 0);

  const categoryMap = new Map<string, number>();
  for (const r of results) {
    if (r.count > 0) {
      categoryMap.set(r.category, (categoryMap.get(r.category) ?? 0) + r.count);
    }
  }

  const breakdown = [...categoryMap.entries()].map(([category, count]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    count,
  }));

  const checks = results
    .filter((r) => r.count > 0)
    .map((r) => ({ checkKey: r.checkKey, label: r.label, count: r.count, category: r.category }));

  const durationMs =
    run.completedAt && run.startedAt
      ? run.completedAt.getTime() - run.startedAt.getTime()
      : null;

  return {
    id: run.id,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs,
    triggeredBy: run.triggeredBy,
    ok: run.completedAt != null,
    summary: { type: "site-health", totalIssues, breakdown, checks },
  };
}

async function getBackupLastRun(): Promise<CronLastRun | null> {
  const row = await prisma.backup.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  const manifest = row.manifest as Record<string, unknown> | null;
  const durationMs =
    row.completedAt && row.createdAt
      ? row.completedAt.getTime() - row.createdAt.getTime()
      : null;

  return {
    id: row.id,
    startedAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs,
    triggeredBy: row.trigger.toLowerCase(),
    ok: row.status === "COMPLETE",
    summary: {
      type: "backup",
      status: row.status,
      fileSize: row.fileSize?.toString() ?? null,
      schemaVersion: row.schemaVersion,
      mediaFileCount: typeof manifest?.mediaFileCount === "number" ? manifest.mediaFileCount : null,
      errorMessage: row.errorMessage,
    },
  };
}

async function getBranchDetectionLastRun(): Promise<CronLastRun | null> {
  const row = await prisma.gedcomBranchRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  if (!row) return null;

  const durationMs =
    row.completedAt && row.startedAt
      ? row.completedAt.getTime() - row.startedAt.getTime()
      : null;

  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs,
    triggeredBy: row.triggeredBy,
    ok: row.completedAt != null && row.errorMessage == null,
    summary: {
      type: "branch-detection",
      totalBranches: row.totalBranches ?? 0,
      mainBranchSize: row.mainBranchSize ?? 0,
      mainBranchCoverage: 0,
      isolatedIndividuals: row.isolatedIndividuals ?? 0,
      newBranches: row.newBranches ?? 0,
      mergedBranches: row.mergedBranches ?? 0,
      updatedBranches: row.updatedBranches ?? 0,
      errorMessage: row.errorMessage ?? null,
    },
  };
}

async function getLineageDetectionLastRun(): Promise<CronLastRun | null> {
  const row = await prisma.lineageRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
  if (!row) return null;

  const durationMs =
    row.completedAt && row.startedAt
      ? row.completedAt.getTime() - row.startedAt.getTime()
      : null;

  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    durationMs,
    triggeredBy: row.triggeredBy,
    ok: row.completedAt != null && row.errorMessage == null,
    summary: {
      type: "lineage-detection",
      totalLineages: row.totalLineages ?? 0,
      newLineages: row.newLineages ?? 0,
      mergedLineages: row.mergedLineages ?? 0,
      updatedLineages: row.updatedLineages ?? 0,
      bridgeChildren: row.bridgeChildren ?? 0,
      errorMessage: row.errorMessage ?? null,
    },
  };
}

export async function getAllCronJobStatuses(): Promise<CronJobStatus[]> {
  const [healthRun, backupRun, branchRun, lineageRun] = await Promise.all([
    getSiteHealthLastRun(),
    getBackupLastRun(),
    getBranchDetectionLastRun(),
    getLineageDetectionLastRun(),
  ]);
  const runMap: Record<CronJobId, CronLastRun | null> = {
    "site-health": healthRun,
    backup: backupRun,
    "branch-detection": branchRun,
    "lineage-detection": lineageRun,
  };
  return CRON_JOBS.map((job) => ({ ...job, lastRun: runMap[job.id] }));
}

// ── Trigger functions (no email side-effects) ─────────────────────────────────

async function triggerSiteHealth(): Promise<CronLastRun> {
  const run = await prisma.siteHealthRun.create({
    data: { triggeredBy: "manual" },
  });
  try {
    const ctx = await buildCheckContext();
    const results = await runAllChecks(ctx);
    const now = new Date();
    await prisma.siteHealthRun.update({
      where: { id: run.id },
      data: { completedAt: now, results: results as object[] },
    });
    const lastRun = await getSiteHealthLastRun();
    return lastRun!;
  } catch (err) {
    await prisma.siteHealthRun.delete({ where: { id: run.id } }).catch(() => {});
    throw err;
  }
}

async function triggerBackup(): Promise<CronLastRun> {
  const row = await prisma.backup.create({
    data: { status: "PENDING", trigger: "MANUAL" },
  });
  await runBackup(row.id);
  const lastRun = await getBackupLastRun();
  return lastRun!;
}

async function triggerBranchDetection(): Promise<CronLastRun> {
  const fileUuid = await getAdminFileUuid();
  await runBranchDetection(fileUuid, "manual");
  const lastRun = await getBranchDetectionLastRun();
  return lastRun!;
}

async function triggerLineageDetection(): Promise<CronLastRun> {
  const fileUuid = await getAdminFileUuid();
  await runLineageDetection(fileUuid, "manual");
  const lastRun = await getLineageDetectionLastRun();
  return lastRun!;
}

export async function triggerCronJob(id: CronJobId): Promise<CronLastRun> {
  switch (id) {
    case "site-health":
      return triggerSiteHealth();
    case "backup":
      return triggerBackup();
    case "branch-detection":
      return triggerBranchDetection();
    case "lineage-detection":
      return triggerLineageDetection();
    default:
      throw new Error(`Unknown cron job: ${String(id)}`);
  }
}
