import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/database/prisma";
import { createSession, setSessionCookie } from "@/lib/infra/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username },
        ],
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { token } = await createSession(user.id, req);
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
      },
    });
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
      return NextResponse.json(
        { error: "Service unavailable. Check DATABASE_URL in .env.local and that the database is running." },
        { status: 503 }
      );
    }
    // In development, return the real error so the client can show it
    const message =
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
