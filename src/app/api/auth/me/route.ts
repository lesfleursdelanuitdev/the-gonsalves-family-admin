import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/infra/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    // 200 + user: null = signed out. (401 would make fetchJson throw and is wrong for a "who am I" probe.)
    if (!user) {
      return NextResponse.json({ user: null });
    }
    return NextResponse.json({ user });
  } catch (e) {
    console.error("Auth/me error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
