import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/imports/gedcom/[id]/apply/route";

// ── mocks ─────────────────────────────────────────────────────────────────────

const { prismaMock, requireAuthMock, requireCanMock, getAdminFileUuidMock, applyGedcomImportMock } =
  vi.hoisted(() => ({
    prismaMock: {
      pendingGedcomImport: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
    },
    requireAuthMock: vi.fn(),
    requireCanMock: vi.fn(),
    getAdminFileUuidMock: vi.fn(),
    applyGedcomImportMock: vi.fn(),
  }));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/infra/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/authz/routeGuards", () => ({ requireCan: requireCanMock }));
vi.mock("@/lib/infra/admin-tree", () => ({ getAdminFileUuid: getAdminFileUuidMock }));
vi.mock("@/lib/admin/gedcom-import-apply", () => ({ applyGedcomImport: applyGedcomImportMock }));

// ── helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_USER = { id: "u1", isActive: true, isWebsiteOwner: false };
const FILE_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const IMPORT_ID = "import-1";

function makeReq(body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/admin/imports/gedcom/${IMPORT_ID}/apply`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeCtx(id = IMPORT_ID) {
  return { params: Promise.resolve({ id }) };
}

const PLAN_WITH_CANDIDATES = {
  candidates: [
    { candidateId: "c1", importedDisplay: "Alice Smith", defaultResolution: "create_new" },
  ],
  defaultResolutions: { c1: "create_new" },
};

const BASE_IMPORT_ROW = {
  id: IMPORT_ID,
  fileUuid: FILE_UUID,
  status: "pending",
  filename: "family.ged",
  importMergePlanJson: PLAN_WITH_CANDIDATES,
  resolutionsJson: {},
  canonicalSnapshotJson: {},
  appliedByUserId: null,
  appliedAt: null,
};

const APPLY_STATS = { created: 1, merged: 0, skipped: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_TREE_ID = "tree-1";
  requireAuthMock.mockResolvedValue(ACTIVE_USER);
  requireCanMock.mockResolvedValue(ACTIVE_USER);
  getAdminFileUuidMock.mockResolvedValue(FILE_UUID);
  prismaMock.pendingGedcomImport.findFirst.mockResolvedValue(BASE_IMPORT_ROW);
  prismaMock.pendingGedcomImport.update.mockResolvedValue({ ...BASE_IMPORT_ROW, status: "applied" });
  applyGedcomImportMock.mockResolvedValue(APPLY_STATS);
});

// ── guards ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/imports/gedcom/[id]/apply — guards", () => {
  it("returns 404 when import not found", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("returns 409 when import is already applied", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({ ...BASE_IMPORT_ROW, status: "applied" });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("Already applied");
  });

  it("returns 409 when import is discarded", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({ ...BASE_IMPORT_ROW, status: "discarded" });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("discarded");
  });

  it("returns 400 when no import merge plan exists", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({
      ...BASE_IMPORT_ROW,
      importMergePlanJson: null,
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("compare first");
  });

  it("returns 400 when plan has no candidates", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({
      ...BASE_IMPORT_ROW,
      importMergePlanJson: { candidates: [], defaultResolutions: {} },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(400);
  });

  it("returns 400 when a candidate still has review_later resolution", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({
      ...BASE_IMPORT_ROW,
      importMergePlanJson: {
        candidates: [
          { candidateId: "c1", importedDisplay: "Alice", defaultResolution: "review_later" },
        ],
        defaultResolutions: { c1: "review_later" },
      },
      resolutionsJson: {},
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("review_later");
    expect(body.candidateId).toBe("c1");
  });

  it("returns 403 when requireCan throws Forbidden", async () => {
    const err = new Error("Forbidden");
    err.name = "AuthorizationError";
    requireCanMock.mockRejectedValue(err);
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(403);
  });
});

// ── successful apply ───────────────────────────────────────────────────────────

describe("POST /api/admin/imports/gedcom/[id]/apply — successful apply", () => {
  it("calls applyGedcomImport and returns 200 with stats", async () => {
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(200);
    expect(applyGedcomImportMock).toHaveBeenCalledWith(
      FILE_UUID,
      "u1",
      PLAN_WITH_CANDIDATES,
      expect.any(Object),
      expect.anything(),
      undefined,
    );
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.stats).toEqual(APPLY_STATS);
  });

  it("updates import status to 'applied'", async () => {
    await POST(makeReq(), makeCtx());
    expect(prismaMock.pendingGedcomImport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "applied" }),
      })
    );
  });

  it("a resolution override of review_later is blocked even when supplied in resolutionsJson", async () => {
    prismaMock.pendingGedcomImport.findFirst.mockResolvedValue({
      ...BASE_IMPORT_ROW,
      importMergePlanJson: {
        candidates: [
          { candidateId: "c1", importedDisplay: "Bob", defaultResolution: "create_new" },
        ],
        defaultResolutions: {},
      },
      // The row-level json has review_later for c1
      resolutionsJson: { c1: "review_later" },
    });
    const res = await POST(makeReq(), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.candidateId).toBe("c1");
  });

  it("requireCan is called with gedcom entity", async () => {
    await POST(makeReq(), makeCtx());
    expect(requireCanMock).toHaveBeenCalledWith(
      expect.objectContaining({ entity: "gedcom", action: "merge_records", scope: "gedcom" })
    );
  });
});
