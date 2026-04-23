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

function getPrisma(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;
  globalForPrisma.prisma = createPrismaClient();
  return globalForPrisma.prisma;
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
