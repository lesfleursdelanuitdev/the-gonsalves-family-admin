/**
 * Tests for withAdminAuth — verifies every error-branch mapping.
 * The inner handler simply resolves; errors are thrown to trigger the wrapper's catch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { withAdminAuth } from "@/lib/infra/api-handler";
import { AdminTreeResolutionError } from "@/lib/infra/admin-tree";

// ── requireAuth mock ──────────────────────────────────────────────────────────

const { requireAuthMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
}));

vi.mock("@/lib/infra/auth", () => ({
  requireAuth: requireAuthMock,
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_USER = { id: "u1", isActive: true, isWebsiteOwner: false };

function makeRequest(url = "http://localhost/api/admin/test") {
  return new NextRequest(url, { method: "GET" });
}

function makeCtx(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

async function callWith(error?: unknown): Promise<NextResponse> {
  const handler = withAdminAuth(async (_req, _user, _ctx) => {
    if (error) throw error;
    return NextResponse.json({ ok: true });
  });
  return handler(makeRequest(), makeCtx());
}

// ── tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue(ACTIVE_USER);
});

describe("withAdminAuth — happy path", () => {
  it("passes user to handler and returns handler response", async () => {
    const handler = withAdminAuth(async (_req, user, _ctx) => {
      return NextResponse.json({ userId: user.id });
    });
    const res = await handler(makeRequest(), makeCtx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("u1");
  });

  it("forwards params from ctx to handler", async () => {
    const handler = withAdminAuth(async (_req, _user, ctx) => {
      const { id } = await ctx.params;
      return NextResponse.json({ id });
    });
    const res = await handler(makeRequest(), makeCtx({ id: "abc-123" }));
    const body = await res.json();
    expect(body.id).toBe("abc-123");
  });
});

describe("withAdminAuth — auth failures", () => {
  it("returns 401 when requireAuth throws Unauthorized", async () => {
    requireAuthMock.mockRejectedValue(new Error("Unauthorized"));
    const res = await callWith();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns 403 when handler throws Forbidden", async () => {
    const res = await callWith(new Error("Forbidden"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("returns 403 when handler throws an error with name AuthorizationError", async () => {
    const err = new Error("some message");
    err.name = "AuthorizationError";
    const res = await callWith(err);
    expect(res.status).toBe(403);
  });
});

describe("withAdminAuth — AdminTreeResolutionError → 503", () => {
  it("returns 503 with the error message", async () => {
    const res = await callWith(new AdminTreeResolutionError("Tree not configured"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("Tree not configured");
  });
});

describe("withAdminAuth — PrismaClientValidationError → 400", () => {
  it("returns 400 for PrismaClientValidationError", async () => {
    const err = new Prisma.PrismaClientValidationError("bad field", { clientVersion: "5.0" });
    const res = await callWith(err);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Prisma schema");
  });
});

describe("withAdminAuth — PrismaClientKnownRequestError codes", () => {
  function knownError(code: string) {
    return new Prisma.PrismaClientKnownRequestError("msg", { code, clientVersion: "5.0" });
  }

  it("P2021 → 503 (missing table)", async () => {
    const res = await callWith(knownError("P2021"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("P2021");
    expect(body.error).toContain("missing tables");
  });

  it("P2022 → 503 (missing column)", async () => {
    const res = await callWith(knownError("P2022"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("P2022");
    expect(body.error).toContain("missing a column");
  });

  it("P2002 → 400 (unique constraint)", async () => {
    const res = await callWith(knownError("P2002"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("P2002");
    expect(body.error).toContain("constraint");
  });

  it("P2003 → 400 (foreign key constraint)", async () => {
    const res = await callWith(knownError("P2003"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("P2003");
  });

  it("other known Prisma error → 503", async () => {
    const res = await callWith(knownError("P2025"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("P2025");
  });
});

describe("withAdminAuth — generic error → 500", () => {
  it("returns 500 for an unexpected error", async () => {
    const res = await callWith(new Error("Something blew up"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });

  it("returns 500 for a non-Error thrown value", async () => {
    const res = await callWith("raw string error");
    expect(res.status).toBe(500);
  });
});
