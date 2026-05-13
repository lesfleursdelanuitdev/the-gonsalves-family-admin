import {
  DEFAULT_SESSION_TTL_MS,
  authCookieName,
  createSession as createSharedSession,
  getCurrentUserFromToken as getSharedCurrentUserFromToken,
  refreshSession as refreshSharedSession,
  requireAuthFromToken as requireSharedAuthFromToken,
  revokeSession as revokeSharedSession,
  sessionCookieOptions,
  validateSession as validateSharedSession,
  type CreateSessionOptions,
  type SessionUser,
} from "@ligneous/auth";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { ADMIN_SESSION_COOKIE } from "@/lib/infra/admin-session-cookie";

export { ADMIN_SESSION_COOKIE };
export const SESSION_TTL_MS = DEFAULT_SESSION_TTL_MS;
export type { CreateSessionOptions, SessionUser };

export async function createSession(userId: string, req?: Request, options?: CreateSessionOptions) {
  return createSharedSession(prisma, userId, req, options);
}

export function applySessionCookieToResponse(response: NextResponse, token: string, cookieMaxAgeSeconds?: number) {
  response.cookies.set(authCookieName(), token, sessionCookieOptions(cookieMaxAgeSeconds));
}

export function clearSessionCookieOnResponse(response: NextResponse) {
  response.cookies.set(authCookieName(), "", sessionCookieOptions(0));
}

export async function getSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(authCookieName())?.value ?? null;
}

export async function validateSession(token: string): Promise<SessionUser | null> {
  return validateSharedSession(prisma, token);
}

export async function revokeSession(token: string) {
  await revokeSharedSession(prisma, token);
}

export async function refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  return refreshSharedSession(prisma, refreshToken);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  return getSharedCurrentUserFromToken(prisma, token);
}

export async function requireAuth(): Promise<SessionUser> {
  const token = await getSessionToken();
  return requireSharedAuthFromToken(prisma, token);
}
