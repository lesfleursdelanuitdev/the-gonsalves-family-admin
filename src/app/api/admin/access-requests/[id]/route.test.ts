import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH, DELETE } from "@/app/api/admin/access-requests/[id]/route";

// ── mocks ─────────────────────────────────────────────────────────────────────

const { prismaMock, requireAuthMock, requireCanMock } = vi.hoisted(() => ({
  prismaMock: {
    accessRequest: {
      findFirst: vi.fn(),
      findFirstOrThrow: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
  requireAuthMock: vi.fn(),
  requireCanMock: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/infra/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/authz/routeGuards", () => ({ requireCan: requireCanMock }));

// ── helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_USER = { id: "u1", isActive: true, isWebsiteOwner: false };

function makeReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/access-requests/req-1", {
    method,
    ...(body !== undefined
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });
}

function makeCtx(id = "req-1") {
  return { params: Promise.resolve({ id }) };
}

const SAMPLE_REQUEST = {
  id: "req-1",
  requestType: "basic_access",
  status: "pending",
  requestedAt: new Date(),
  respondedAt: null,
  respondedBy: null,
  notes: null,
  responseNotes: null,
  resourceType: null,
  resourceId: null,
  requestedPermissionType: null,
  user: { id: "u2", name: "Bob", username: "bob", email: "bob@example.com", createdAt: new Date() },
  responder: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_TREE_ID = "tree-1";
  requireAuthMock.mockResolvedValue(ACTIVE_USER);
  requireCanMock.mockResolvedValue(ACTIVE_USER);
  prismaMock.accessRequest.findFirst.mockResolvedValue(SAMPLE_REQUEST);
  prismaMock.accessRequest.findFirstOrThrow.mockResolvedValue(SAMPLE_REQUEST);
  prismaMock.accessRequest.update.mockResolvedValue(SAMPLE_REQUEST);
});

// ── GET ────────────────────────────────────────────────────────────────────────

describe("GET /api/admin/access-requests/[id]", () => {
  it("returns 200 with request when found", async () => {
    const res = await GET(makeReq("GET"), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.request.id).toBe("req-1");
  });

  it("returns 404 when request not found", async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("GET"), makeCtx());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });

  it("scopes query to treeId", async () => {
    await GET(makeReq("GET"), makeCtx("req-99"));
    expect(prismaMock.accessRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ treeId: "tree-1" }) })
    );
  });

  it("returns 401 when not authenticated", async () => {
    requireAuthMock.mockRejectedValue(new Error("Unauthorized"));
    const res = await GET(makeReq("GET"), makeCtx());
    expect(res.status).toBe(401);
  });
});

// ── PATCH — set_status ────────────────────────────────────────────────────────

describe("PATCH /api/admin/access-requests/[id] — set_status", () => {
  it("updates status and returns request", async () => {
    const res = await PATCH(makeReq("PATCH", { action: "set_status", status: "approved" }), makeCtx());
    expect(res.status).toBe(200);
    expect(prismaMock.accessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "approved", respondedBy: "u1" }),
      })
    );
  });

  it("returns 400 for invalid status", async () => {
    const res = await PATCH(makeReq("PATCH", { action: "set_status", status: "nonsense" }), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid status");
  });

  it("accepts all valid statuses", async () => {
    for (const status of ["pending", "approved", "rejected", "cancelled"]) {
      const res = await PATCH(makeReq("PATCH", { action: "set_status", status }), makeCtx());
      expect(res.status).toBe(200);
    }
  });
});

// ── PATCH — set_response_notes ────────────────────────────────────────────────

describe("PATCH /api/admin/access-requests/[id] — set_response_notes", () => {
  it("updates response notes", async () => {
    const res = await PATCH(
      makeReq("PATCH", { action: "set_response_notes", notes: "Approved after review" }),
      makeCtx()
    );
    expect(res.status).toBe(200);
    expect(prismaMock.accessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responseNotes: "Approved after review" }),
      })
    );
  });

  it("stores null when notes is empty string", async () => {
    await PATCH(makeReq("PATCH", { action: "set_response_notes", notes: "   " }), makeCtx());
    expect(prismaMock.accessRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ responseNotes: null }),
      })
    );
  });
});

// ── PATCH — error cases ───────────────────────────────────────────────────────

describe("PATCH /api/admin/access-requests/[id] — error cases", () => {
  it("returns 404 when request not found", async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue(null);
    const res = await PATCH(makeReq("PATCH", { action: "set_status", status: "approved" }), makeCtx());
    expect(res.status).toBe(404);
  });

  it("returns 400 for unknown action", async () => {
    const res = await PATCH(makeReq("PATCH", { action: "do_something_random" }), makeCtx());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unknown action");
  });

  it("returns 403 when requireCan throws Forbidden", async () => {
    const err = new Error("Forbidden");
    err.name = "AuthorizationError";
    requireCanMock.mockRejectedValue(err);
    const res = await PATCH(makeReq("PATCH", { action: "set_status", status: "approved" }), makeCtx());
    expect(res.status).toBe(403);
  });
});

// ── DELETE ────────────────────────────────────────────────────────────────────

describe("DELETE /api/admin/access-requests/[id]", () => {
  it("deletes the request and returns 204", async () => {
    prismaMock.accessRequest.delete.mockResolvedValue(undefined);
    const res = await DELETE(makeReq("DELETE"), makeCtx());
    expect(res.status).toBe(204);
    expect(prismaMock.accessRequest.delete).toHaveBeenCalledWith({ where: { id: "req-1" } });
  });

  it("returns 404 when request not found", async () => {
    prismaMock.accessRequest.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeReq("DELETE"), makeCtx());
    expect(res.status).toBe(404);
    expect(prismaMock.accessRequest.delete).not.toHaveBeenCalled();
  });
});
