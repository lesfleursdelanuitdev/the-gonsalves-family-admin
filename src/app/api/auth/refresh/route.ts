import { NextResponse } from "next/server";
import { applySessionCookieToResponse, refreshSession } from "@/lib/infra/auth";

export async function POST(req: Request) {
  try {
    const { refreshToken } = await req.json();
    if (!refreshToken) {
      return NextResponse.json({ error: "Refresh token required" }, { status: 400 });
    }

    const result = await refreshSession(refreshToken);
    if (!result) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const res = NextResponse.json({ refreshToken: result.refreshToken });
    applySessionCookieToResponse(res, result.token);
    return res;
  } catch (e) {
    console.error("Refresh error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
