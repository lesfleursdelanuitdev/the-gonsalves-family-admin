import { NextResponse } from "next/server";
import { getSessionToken, revokeSession, clearSessionCookie } from "@/lib/infra/auth";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      await revokeSession(token);
    }
    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Logout error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
