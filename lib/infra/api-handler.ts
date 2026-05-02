import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@ligneous/prisma";
import { AdminTreeResolutionError } from "@/lib/infra/admin-tree";
import { requireAuth, type SessionUser } from "@/lib/infra/auth";

type RouteContext = { params: Promise<Record<string, string>> };

type AdminHandler = (
  req: NextRequest,
  user: SessionUser,
  ctx: RouteContext,
) => Promise<NextResponse>;

/**
 * Wraps an admin API route handler with auth + consistent error handling.
 * Returns a standard Next.js route handler function.
 */
export function withAdminAuth(handler: AdminHandler) {
  return async (req: NextRequest, ctx: RouteContext): Promise<NextResponse> => {
    try {
      const user = await requireAuth();
      return await handler(req, user, ctx);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (e instanceof AdminTreeResolutionError) {
        return NextResponse.json({ error: e.message }, { status: 503 });
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
        return NextResponse.json(
          {
            error:
              "This database is missing tables the admin app needs (for example user_media or site_media). Apply migrations: in gonsalves-genealogy, run `cd packages/ligneous-prisma && npx prisma migrate deploy` with DATABASE_URL pointing at the same database as this admin server, then restart.",
          },
          { status: 503 },
        );
      }
      console.error(`${req.method} ${req.nextUrl.pathname} error:`, e);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  };
}
