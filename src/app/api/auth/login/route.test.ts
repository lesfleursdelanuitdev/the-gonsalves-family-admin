import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";

// ── mocks ─────────────────────────────────────────────────────────────────────

const { prismaMock, verifyPasswordMock, createSessionMock, applySessionCookieMock } = vi.hoisted(() => ({
  prismaMock: { user: { findFirst: vi.fn() } },
  verifyPasswordMock: vi.fn(),
  createSessionMock: vi.fn(),
  applySessionCookieMock: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));

vi.mock("@ligneous/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@ligneous/auth")>();
  return { ...original, verifyPassword: verifyPasswordMock };
});

vi.mock("@/lib/infra/auth", () => ({
  createSession: createSessionMock,
  applySessionCookieToResponse: applySessionCookieMock,
  SESSION_TTL_MS: 24 * 60 * 60 * 1000,
}));

// ── helpers ────────────────────────────────────────────────────────────────────

function makeLoginRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const DB_USER = {
  id: "u1",
  username: "alice",
  email: "alice@example.com",
  name: "Alice",
  passwordHash: "hashed",
  isWebsiteOwner: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findFirst.mockResolvedValue(DB_USER);
  verifyPasswordMock.mockResolvedValue(true);
  createSessionMock.mockResolvedValue({ token: "session-tok" });
  applySessionCookieMock.mockImplementation(() => undefined);
});

// ── validation ────────────────────────────────────────────────────────────────

describe("POST /api/auth/login — validation", () => {
  it("returns 400 when username is missing", async () => {
    const res = await POST(makeLoginRequest({ password: "pass" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(makeLoginRequest({ username: "alice" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("required");
  });

  it("returns 400 when both are missing", async () => {
    const res = await POST(makeLoginRequest({}));
    expect(res.status).toBe(400);
  });
});

// ── authentication ─────────────────────────────────────────────────────────────

describe("POST /api/auth/login — authentication", () => {
  it("returns 401 when user is not found", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeLoginRequest({ username: "nobody", password: "x" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 401 when password is wrong", async () => {
    verifyPasswordMock.mockResolvedValue(false);
    const res = await POST(makeLoginRequest({ username: "alice", password: "wrong" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid credentials");
  });

  it("returns 200 with user on successful login", async () => {
    const res = await POST(makeLoginRequest({ username: "alice", password: "correct" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe("u1");
    expect(body.user.username).toBe("alice");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("calls createSession with the user id", async () => {
    await POST(makeLoginRequest({ username: "alice", password: "correct" }));
    expect(createSessionMock).toHaveBeenCalledWith("u1", expect.anything(), expect.anything());
  });

  it("uses longer TTL when remember=true", async () => {
    await POST(makeLoginRequest({ username: "alice", password: "correct", remember: true }));
    const [, , opts] = createSessionMock.mock.calls[0];
    const defaultTtl = 24 * 60 * 60 * 1000;
    expect(opts.accessTtlMs).toBeGreaterThan(defaultTtl);
  });
});

// ── DB error handling ─────────────────────────────────────────────────────────

describe("POST /api/auth/login — DB error handling", () => {
  it("returns 503 when DB is unavailable (ECONNREFUSED)", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("ECONNREFUSED 5432"));
    const res = await POST(makeLoginRequest({ username: "alice", password: "x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("unavailable");
  });

  it("returns 503 for DATABASE_URL misconfiguration error", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("invalid DATABASE_URL"));
    const res = await POST(makeLoginRequest({ username: "alice", password: "x" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 on PrismaClientInitializationError (no db)", async () => {
    const err = new Error("Cannot connect");
    err.constructor = { name: "PrismaClientInitializationError" } as unknown as typeof Error;
    Object.defineProperty(err, "constructor", {
      value: { name: "PrismaClientInitializationError" },
    });
    prismaMock.user.findFirst.mockRejectedValue(err);
    const res = await POST(makeLoginRequest({ username: "alice", password: "x" }));
    // The check is err.constructor?.name === "PrismaClientInitializationError"
    expect(res.status).toBe(503);
  });

  it("returns 503 for permission denied (42501 pg code)", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("ERROR 42501: permission denied for table users"));
    const res = await POST(makeLoginRequest({ username: "alice", password: "x" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("permission error");
  });

  it("returns 500 for unexpected errors", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("something unexpected"));
    const res = await POST(makeLoginRequest({ username: "alice", password: "x" }));
    expect(res.status).toBe(500);
  });
});
