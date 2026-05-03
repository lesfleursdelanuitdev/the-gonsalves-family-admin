/**
 * Write-capable Prisma client for the-gonsalves-family-admin.
 * Uses the shared @ligneous/prisma schema. Set DATABASE_URL in .env.local to a
 * connection string with write access (e.g. same DB as main app, write user).
 */

import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local for admin write access to the database.",
    );
  }

  const pool = new pg.Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * True if this generated client includes delegates we rely on in admin routes.
 * Bump checks when adding models so dev/HMR does not keep a pre-generate client missing new tables.
 */
function prismaClientHasExpectedDelegates(client: PrismaClient): boolean {
  const o = client as unknown as Record<string, unknown>;
  return o.openQuestion != null && o.tagProfileMedia != null;
}

function getPrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && prismaClientHasExpectedDelegates(cached)) {
    return cached;
  }
  if (cached) {
    // Dev server / HMR can keep a PrismaClient from before `prisma generate` added models.
    void cached.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  const client = createPrismaClient();
  if (!prismaClientHasExpectedDelegates(client)) {
    void client.$disconnect().catch(() => {});
    throw new Error(
      "Prisma client is out of date (missing generated models). Run `npm run generate --prefix ../packages/ligneous-prisma` (or `npm run ensure-prisma` in this app), then restart the dev server.",
    );
  }
  globalForPrisma.prisma = client;
  return client;
}

/**
 * One client + pool per Node process. Prisma interactive transactions require a stable
 * client instance and correct `this` on methods — an unbound Proxy broke `$transaction`
 * with the pg driver adapter (P2028: transaction not found).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop) as unknown;
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});

export default prisma;
