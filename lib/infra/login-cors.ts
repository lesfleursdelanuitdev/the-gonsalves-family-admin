/**
 * Credentialed CORS for POST /api/auth/login from the public family site (inline nav login).
 * Extend via ADMIN_LOGIN_CORS_ORIGINS (comma-separated origins).
 */
import type { NextResponse } from "next/server";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://temp.gonsalvesfamily.com",
  "https://gonsalves.family",
  "https://www.gonsalves.family",
];

function allowedOrigins(): string[] {
  const extra = (process.env.ADMIN_LOGIN_CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...extra])];
}

/** Returns CORS headers when Origin is allowlisted; otherwise empty. */
export function loginCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) {
    return {};
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function applyCorsToResponse(request: Request, response: NextResponse): NextResponse {
  const h = loginCorsHeaders(request);
  for (const [k, v] of Object.entries(h)) {
    response.headers.set(k, v);
  }
  return response;
}
