/**
 * Server-side auth utilities: session creation, validation, cookie helpers.
 */
import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/infra/admin-session-cookie";
import { prisma } from "@/lib/database/prisma";

export { ADMIN_SESSION_COOKIE };

const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_MS / 1000,
};

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  name: string | null;
  isWebsiteOwner: boolean;
}

export async function createSession(userId: string, req?: Request) {
  const token = generateToken();
  const refreshToken = generateToken();
  const now = new Date();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      refreshTokenHash: sha256(refreshToken),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      ipAddress: req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req?.headers.get("user-agent") ?? null,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: now },
  });

  return { token, refreshToken };
}

/**
 * Attach session cookie to a Route Handler response. Prefer this over `cookies().set`
 * in `app/api/**` so Next.js reliably emits `Set-Cookie` (avoids missing session after login).
 */
export function applySessionCookieToResponse(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions);
}

/** Clear session cookie on a Route Handler response. */
export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...sessionCookieOptions,
    maxAge: 0,
  });
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(ADMIN_SESSION_COOKIE)?.value ?? null;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  const hash = sha256(token);
  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hash,
      isRevoked: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          isWebsiteOwner: true,
          isActive: true,
        },
      },
    },
  });

  if (!session || !session.user.isActive) return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    id: session.user.id,
    username: session.user.username,
    email: session.user.email,
    name: session.user.name,
    isWebsiteOwner: session.user.isWebsiteOwner,
  };
}

export async function revokeSession(token: string) {
  const hash = sha256(token);
  await prisma.session.updateMany({
    where: { tokenHash: hash },
    data: { isRevoked: true },
  });
}

export async function refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  const hash = sha256(refreshToken);
  const session = await prisma.session.findFirst({
    where: {
      refreshTokenHash: hash,
      isRevoked: false,
      refreshExpiresAt: { gt: new Date() },
    },
  });

  if (!session) return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { isRevoked: true },
  });

  const newToken = generateToken();
  const newRefreshToken = generateToken();
  const now = new Date();

  await prisma.session.create({
    data: {
      userId: session.userId,
      tokenHash: sha256(newToken),
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      refreshTokenHash: sha256(newRefreshToken),
      refreshExpiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
    },
  });

  return { token: newToken, refreshToken: newRefreshToken };
}

/** Get the current user from cookie, or null. Server-only helper. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return validateSession(token);
}

/** Get current user or throw (for protected endpoints). */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
