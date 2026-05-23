import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

const { getSessionTokenMock, revokeSessionMock, clearSessionCookieOnResponseMock } = vi.hoisted(() => ({
  getSessionTokenMock: vi.fn(),
  revokeSessionMock: vi.fn(),
  clearSessionCookieOnResponseMock: vi.fn(),
}));

vi.mock("@/lib/infra/auth", () => ({
  getSessionToken: getSessionTokenMock,
  revokeSession: revokeSessionMock,
  clearSessionCookieOnResponse: clearSessionCookieOnResponseMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
  revokeSessionMock.mockResolvedValue(undefined);
  clearSessionCookieOnResponseMock.mockImplementation(() => undefined);
});

describe("POST /api/auth/logout", () => {
  it("revokes session and returns ok:true when token present", async () => {
    getSessionTokenMock.mockResolvedValue("tok-abc");
    const res = await POST();
    expect(revokeSessionMock).toHaveBeenCalledWith("tok-abc");
    expect(clearSessionCookieOnResponseMock).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("does NOT call revokeSession when no token present", async () => {
    getSessionTokenMock.mockResolvedValue(null);
    const res = await POST();
    expect(revokeSessionMock).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("returns 500 when an error is thrown", async () => {
    getSessionTokenMock.mockRejectedValue(new Error("cookie read failed"));
    const res = await POST();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Internal server error");
  });
});
