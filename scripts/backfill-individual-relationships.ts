#!/usr/bin/env node
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PrismaClient } from "@ligneous/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  ensureDefaultRelationshipTypes,
  findEquivalentTwoPartyRelationship,
  lookupTypeRoleForRela,
  resolveTreeIdForFileUuid,
} from "../lib/admin/individual-relationships.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
config({ path: path.join(repoRoot, ".env.local") });
config({ path: path.join(repoRoot, ".env") });

function createPrisma(): { prisma: PrismaClient; pool: pg.Pool } {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new pg.Pool({ connectionString: url });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });
  return { prisma, pool };
}

async function main() {
  const { prisma, pool } = createPrisma();
  try {
    const fileRows = await prisma.gedcomFile.findMany({ select: { id: true } });
    let linked = 0;
    let created = 0;
    for (const file of fileRows) {
      const treeId = await resolveTreeIdForFileUuid(prisma, file.id);
      await ensureDefaultRelationshipTypes(prisma, treeId);
      const typeRows = await prisma.relationshipType.findMany({
        where: { OR: [{ treeId }, { treeId: null }] },
        include: { roles: true },
      });
      const typeByKey = new Map(typeRows.map((t) => [t.key, t]));
      const rows = await prisma.gedcomIndividualAssociation.findMany({
        where: { fileUuid: file.id },
        orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
      });
      for (const row of rows) {
        const mapped = lookupTypeRoleForRela(row.rela);
        const typeKey = mapped?.typeKey ?? "custom_association";
        const roleKey = mapped?.roleKey ?? "associated_person";
        const type = typeByKey.get(typeKey);
        if (!type) continue;
        const role = type.roles.find((r) => r.key === roleKey);
        const reciprocal = role?.reciprocalRoleKey
          ? type.roles.find((r) => r.key === role.reciprocalRoleKey)
          : null;
        const fallbackRole = type.roles[0];
        const firstRole = role ?? fallbackRole;
        const secondRole = reciprocal ?? fallbackRole;
        if (!firstRole || !secondRole) continue;

        let relationship = await findEquivalentTwoPartyRelationship(prisma, {
          fileUuid: file.id,
          relationshipTypeId: type.id,
          firstIndividualId: row.subjectIndividualId,
          firstRoleId: firstRole.id,
          secondIndividualId: row.associateIndividualId,
          secondRoleId: secondRole.id,
        });
        if (!relationship) {
          relationship = await prisma.individualRelationship.create({
            data: {
              fileUuid: file.id,
              relationshipTypeId: type.id,
              notes: mapped ? null : `Original RELA: ${row.rela}`,
              participants: {
                create: [
                  { individualId: row.subjectIndividualId, roleId: firstRole.id, sortOrder: 0 },
                  { individualId: row.associateIndividualId, roleId: secondRole.id, sortOrder: 1 },
                ],
              },
            },
            include: { participants: true },
          });
          created += 1;
        }
        await prisma.individualRelationshipSourceAssociation.upsert({
          where: {
            relationshipId_gedcomIndividualAssociationId: {
              relationshipId: relationship.id,
              gedcomIndividualAssociationId: row.id,
            },
          },
          update: {},
          create: {
            relationshipId: relationship.id,
            gedcomIndividualAssociationId: row.id,
          },
        });
        linked += 1;
      }
    }
    console.log(`Backfill complete. Created ${created} relationship rows; linked ${linked} source association rows.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
