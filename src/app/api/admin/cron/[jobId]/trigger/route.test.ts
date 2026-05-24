import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { requireAuthMock, requireCanMock, triggerCronJobMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  requireCanMock: vi.fn(),
  triggerCronJobMock: vi.fn(),
}));

vi.mock("@/lib/infra/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/authz/routeGuards", () => ({ requireCan: requireCanMock }));
vi.mock("@/lib/admin/cron-jobs", () => ({ triggerCronJob: triggerCronJobMock }));

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_USER = { id: "u1", isActive: true, isWebsiteOwner: true };

function makeReq() {
  return new NextRequest("http://localhost/api/admin/cron/site-health/trigger", { method: "POST" });
}

function makeCtx(jobId: string) {
  return { params: Promise.resolve({ jobId }) };
}

const SAMPLE_LAST_RUN = {
  id: "run-1",
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
  durationMs: 1000,
  triggeredBy: "manual",
  ok: true,
  summary: { type: "site-health", totalIssues: 0, breakdown: [], checks: [] },
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(ACTIVE_USER);
  requireCanMock.mockResolvedValue(undefined);
  triggerCronJobMock.mockResolvedValue(SAMPLE_LAST_RUN);
});

// ── VALID_JOB_IDS guard ───────────────────────────────────────────────────────

describe("POST /api/admin/cron/[jobId]/trigger — VALID_JOB_IDS guard", () => {
  it("returns 404 for an unknown job ID", async () => {
    const res = await POST(makeReq(), makeCtx("not-a-real-job"));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not-a-real-job");
  });

  it("returns 404 for an empty job ID", async () => {
    const res = await POST(makeReq(), makeCtx(""));
    expect(res.status).toBe(404);
  });

  it("returns 404 for a near-match that is not a valid ID", async () => {
    const res = await POST(makeReq(), makeCtx("site-health-extra"));
    expect(res.status).toBe(404);
    expect(triggerCronJobMock).not.toHaveBeenCalled();
  });

  it.each(["site-health", "backup", "branch-detection"])(
    "accepts valid job ID '%s' and calls triggerCronJob",
    async (jobId) => {
      const res = await POST(makeReq(), makeCtx(jobId));
      expect(res.status).toBe(200);
      expect(triggerCronJobMock).toHaveBeenCalledWith(jobId);
    },
  );
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("POST — happy path", () => {
  it("returns ok:true and the lastRun payload", async () => {
    const res = await POST(makeReq(), makeCtx("site-health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.lastRun).toMatchObject({ id: "run-1", ok: true });
  });

  it("passes the permission check before running the job", async () => {
    await POST(makeReq(), makeCtx("backup"));
    expect(requireCanMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "individual", action: "update", scope: "tree" }),
    );
    expect(triggerCronJobMock).toHaveBeenCalledAfter(requireCanMock);
  });
});

// ── Error handling ────────────────────────────────────────────────────────────

describe("POST — error handling", () => {
  it("returns 500 when triggerCronJob throws", async () => {
    triggerCronJobMock.mockRejectedValue(new Error("Job exploded"));
    const res = await POST(makeReq(), makeCtx("site-health"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Job exploded");
  });

  it("returns 500 with stringified message for non-Error throws", async () => {
    triggerCronJobMock.mockRejectedValue("raw string failure");
    const res = await POST(makeReq(), makeCtx("backup"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("raw string failure");
  });

  it("does not call triggerCronJob when the job ID is invalid", async () => {
    await POST(makeReq(), makeCtx("invalid"));
    expect(triggerCronJobMock).not.toHaveBeenCalled();
  });
});
