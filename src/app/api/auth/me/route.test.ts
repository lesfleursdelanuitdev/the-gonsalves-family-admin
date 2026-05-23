import { describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/auth/me/route";

const { getCurrentUserMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
}));

vi.mock("@/lib/infra/auth", () => ({
  getCurrentUser: getCurrentUserMock,
}));

const SIGNED_IN_USER = { id: "u1", username: "alice", isWebsiteOwner: false };

describe("GET /api/auth/me", () => {
  it("returns user when signed in", async () => {
    getCurrentUserMock.mockResolvedValue(SIGNED_IN_USER);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toEqual(SIGNED_IN_USER);
  });

  it("returns {user: null} when signed out — NOT 401", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user).toBeNull();
  });

  it("returns 500 when getCurrentUser throws", async () => {
    getCurrentUserMock.mockRejectedValue(new Error("session table missing"));
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
