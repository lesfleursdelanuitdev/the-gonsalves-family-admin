/**
 * Next.js 16 proxy (replaces middleware.ts). Do not add middleware.ts — use this file only.
 * @see https://nextjs.org/docs/messages/middleware-to-proxy
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "admin_session";
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/refresh"];

/** Only run on real app/HTML routes — not on `/_next/*`, static files, or most `/api/*` (avoids dev redirect/HMR noise). */
export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/api/admin/:path*"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth gating for /admin/* and /api/admin/* routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (!token) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Static assets: pass through without cache headers
  if (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  // HTML/document responses: no-cache for fresh deploys
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0"
  );
  response.headers.set("Pragma", "no-cache");
  return response;
}
