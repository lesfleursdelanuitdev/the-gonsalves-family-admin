import { NextResponse } from "next/server";
import { clearSessionCookieOnResponse, getSessionToken, revokeSession } from "@/lib/infra/auth";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      await revokeSession(token);
    }
    const res = NextResponse.json({ ok: true });
    clearSessionCookieOnResponse(res);
    return res;
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
