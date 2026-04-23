import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/health — Check database connectivity (for debugging login/setup).
 * Returns 200 if DB is reachable, 503 otherwise.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const userCount = await prisma.user.count();
    return NextResponse.json({
      ok: true,
      database: "connected",
      usersExist: userCount > 0,
      userCount,
    });
  } catch (e) {
    console.error("Health check failed:", e);
    return NextResponse.json(
      {
        ok: false,
        database: "disconnected",
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
