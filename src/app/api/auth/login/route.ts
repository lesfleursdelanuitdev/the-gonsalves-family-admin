import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/database/prisma";
import { applySessionCookieToResponse, createSession, SESSION_TTL_MS } from "@/lib/infra/auth";
import { applyCorsToResponse, loginCorsHeaders } from "@/lib/infra/login-cors";

const REMEMBER_ME_ACCESS_MS = 30 * 24 * 60 * 60 * 1000;

function jsonWithCors(req: Request, body: unknown, init?: { status?: number }) {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  return applyCorsToResponse(req, res);
}

export async function OPTIONS(req: Request) {
  const h = loginCorsHeaders(req);
  if (!h["Access-Control-Allow-Origin"]) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(null, { status: 204, headers: h });
}

export async function POST(req: Request) {
  try {
    const { username, password, remember } = await req.json();

    if (!username || !password) {
      return jsonWithCors(req, { error: "Username and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: username }, { email: username }],
        isActive: true,
      },
    });

    if (!user) {
      return jsonWithCors(req, { error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return jsonWithCors(req, { error: "Invalid credentials" }, { status: 401 });
    }

    const accessTtlMs = remember === true ? REMEMBER_ME_ACCESS_MS : SESSION_TTL_MS;
    const cookieMaxAgeSec = Math.floor(accessTtlMs / 1000);

    const { token } = await createSession(user.id, req, { accessTtlMs });

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        isWebsiteOwner: user.isWebsiteOwner,
      },
    });
    applySessionCookieToResponse(res, token, cookieMaxAgeSec);
    return applyCorsToResponse(req, res);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("Login error:", err.message, err.stack);
    const isDbError =
      err.message?.includes("DATABASE_URL") ||
      err.message?.includes("connect") ||
      err.message?.includes("ECONNREFUSED") ||
      err.message?.includes("timeout") ||
      err.constructor?.name === "PrismaClientInitializationError";
    if (isDbError) {
      return jsonWithCors(
        req,
        {
          error:
            "Service unavailable. Check DATABASE_URL in .env.local and that the database is running.",
        },
        { status: 503 }
      );
    }
    const message =
      process.env.NODE_ENV === "development" ? err.message : "Internal server error";
    return jsonWithCors(req, { error: message }, { status: 500 });
  }
}
