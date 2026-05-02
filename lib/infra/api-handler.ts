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
      if (e instanceof Prisma.PrismaClientValidationError) {
        console.error(`${req.method} ${req.nextUrl.pathname} Prisma validation:`, e.message);
        return NextResponse.json(
          {
            error:
              "Request data does not match the Prisma schema (invalid or unknown fields). Regenerate the Prisma client and apply migrations: `cd packages/ligneous-prisma && npx prisma generate && npx prisma migrate deploy`, then restart the admin server.",
            ...(process.env.NODE_ENV === "development" ? { detail: e.message } : {}),
          },
          { status: 400 },
        );
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        const code = e.code;
        if (code === "P2021") {
          return NextResponse.json(
            {
              error:
                "This database is missing tables the admin app needs (for example user_media or site_media). Apply migrations: in gonsalves-genealogy, run `cd packages/ligneous-prisma && npx prisma migrate deploy` with DATABASE_URL pointing at the same database as this admin server, then restart.",
              code,
            },
            { status: 503 },
          );
        }
        if (code === "P2022") {
          return NextResponse.json(
            {
              error:
                "The database is missing a column this app expects (often `story_sections.is_chapter` after an upgrade). Apply migrations: in gonsalves-genealogy run `cd packages/ligneous-prisma && npx prisma migrate deploy` against this admin server's database, then restart.",
              code,
            },
            { status: 503 },
          );
        }
        if (code === "P2002" || code === "P2003") {
          console.error(`${req.method} ${req.nextUrl.pathname} Prisma ${code}:`, e.message);
          return NextResponse.json(
            {
              error: "Database constraint prevented this operation (duplicate value or invalid reference).",
              code,
              ...(process.env.NODE_ENV === "development" ? { detail: e.message } : {}),
            },
            { status: 400 },
          );
        }
        console.error(`${req.method} ${req.nextUrl.pathname} Prisma ${code}:`, e.message);
        return NextResponse.json(
          {
            error: "Database request failed. Check server logs or apply migrations.",
            code,
            ...(process.env.NODE_ENV === "development" ? { detail: e.message } : {}),
          },
          { status: 503 },
        );
      }
      console.error(`${req.method} ${req.nextUrl.pathname} error:`, e);
      return NextResponse.json(
        {
          error: "Internal server error",
          ...(process.env.NODE_ENV === "development" && e instanceof Error ? { detail: e.message } : {}),
        },
        { status: 500 },
      );
    }
  };
}
