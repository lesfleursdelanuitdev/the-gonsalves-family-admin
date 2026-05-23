import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loginCorsHeaders } from "@/lib/infra/login-cors";

function makeRequest(origin: string | null): Request {
  const headers: Record<string, string> = {};
  if (origin !== null) headers["origin"] = origin;
  return new Request("http://localhost/api/auth/login", { headers });
}

describe("loginCorsHeaders — allowlisted origins", () => {
  const allowed = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://gonsalves.family",
    "https://www.gonsalves.family",
    "https://temp.gonsalvesfamily.com",
  ];

  for (const origin of allowed) {
    it(`allows ${origin}`, () => {
      const h = loginCorsHeaders(makeRequest(origin));
      expect(h["Access-Control-Allow-Origin"]).toBe(origin);
      expect(h["Access-Control-Allow-Credentials"]).toBe("true");
      expect(h["Access-Control-Allow-Methods"]).toContain("POST");
    });
  }
});

describe("loginCorsHeaders — denied origins", () => {
  it("returns empty headers for an unknown origin", () => {
    const h = loginCorsHeaders(makeRequest("https://evil.example.com"));
    expect(Object.keys(h)).toHaveLength(0);
  });

  it("returns empty headers when origin header is absent", () => {
    const h = loginCorsHeaders(makeRequest(null));
    expect(Object.keys(h)).toHaveLength(0);
  });

  it("does not allow a subdomain of an allowed origin", () => {
    const h = loginCorsHeaders(makeRequest("https://admin.gonsalves.family"));
    expect(h["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("loginCorsHeaders — ADMIN_LOGIN_CORS_ORIGINS env extension", () => {
  beforeEach(() => {
    process.env.ADMIN_LOGIN_CORS_ORIGINS = "https://extra.example.com,https://another.example.org";
  });

  afterEach(() => {
    delete process.env.ADMIN_LOGIN_CORS_ORIGINS;
  });

  it("allows origins added via env variable", () => {
    const h = loginCorsHeaders(makeRequest("https://extra.example.com"));
    expect(h["Access-Control-Allow-Origin"]).toBe("https://extra.example.com");
  });

  it("still allows built-in origins alongside extras", () => {
    const h = loginCorsHeaders(makeRequest("https://gonsalves.family"));
    expect(h["Access-Control-Allow-Origin"]).toBe("https://gonsalves.family");
  });
});
