import type { Prisma, PrismaClient } from "@ligneous/prisma";
import { prisma } from "@/lib/database/prisma";
import { findEquivalentTwoPartyRelationship } from "@/lib/admin/individual-relationships";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RelationshipParticipantInput = {
  individualId: string;
  roleId: string;
  sortOrder?: number;
};

export type CreateIndividualRelationshipInput = {
  fileUuid: string;
  relationshipTypeId: string;
  participants: RelationshipParticipantInput[];
  notes?: string | null;
};

function cleanedParticipants(input: RelationshipParticipantInput[]): RelationshipParticipantInput[] {
  const out: RelationshipParticipantInput[] = [];
  for (const p of input) {
    const individualId = p.individualId.trim();
    const roleId = p.roleId.trim();
    if (!individualId || !roleId) continue;
    out.push({
      individualId,
      roleId,
      sortOrder: Number.isFinite(p.sortOrder as number) ? Math.trunc(p.sortOrder as number) : 0,
    });
  }
  return out;
}

export async function validateRelationshipParticipants(
  db: DbClient,
  fileUuid: string,
  relationshipTypeId: string,
  participants: RelationshipParticipantInput[],
): Promise<RelationshipParticipantInput[]> {
  const rows = cleanedParticipants(participants);
  if (rows.length < 2) throw new Error("At least two participants are required.");
  const uniq = new Set<string>();
  for (const p of rows) {
    const key = `${p.individualId}\t${p.roleId}`;
    if (uniq.has(key)) throw new Error("Duplicate participant role entries are not allowed.");
    uniq.add(key);
  }

  const [inds, roles] = await Promise.all([
    db.gedcomIndividual.findMany({
      where: { fileUuid, id: { in: rows.map((p) => p.individualId) } },
      select: { id: true },
    }),
    db.relationshipTypeRole.findMany({
      where: { relationshipTypeId, id: { in: rows.map((p) => p.roleId) } },
      select: { id: true },
    }),
  ]);
  if (inds.length !== new Set(rows.map((p) => p.individualId)).size) {
    throw new Error("One or more participants are not valid individuals in this tree.");
  }
  if (roles.length !== new Set(rows.map((p) => p.roleId)).size) {
    throw new Error("One or more selected roles do not belong to this relationship type.");
  }
  return rows;
}

export async function createIndividualRelationship(input: CreateIndividualRelationshipInput) {
  return prisma.$transaction(async (tx) => {
    const participants = await validateRelationshipParticipants(
      tx,
      input.fileUuid,
      input.relationshipTypeId,
      input.participants,
    );
    if (participants.length === 2) {
      const existing = await findEquivalentTwoPartyRelationship(tx, {
        fileUuid: input.fileUuid,
        relationshipTypeId: input.relationshipTypeId,
        firstIndividualId: participants[0].individualId,
        firstRoleId: participants[0].roleId,
        secondIndividualId: participants[1].individualId,
        secondRoleId: participants[1].roleId,
      });
      if (existing) return existing;
    }
    return tx.individualRelationship.create({
      data: {
        fileUuid: input.fileUuid,
        relationshipTypeId: input.relationshipTypeId,
        notes: input.notes?.trim() || null,
        participants: {
          create: participants.map((p, idx) => ({
            individualId: p.individualId,
            roleId: p.roleId,
            sortOrder: p.sortOrder ?? idx,
          })),
        },
      },
      include: {
        relationshipType: true,
        participants: { include: { individual: true, role: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  });
}

export async function updateIndividualRelationship(id: string, input: Omit<CreateIndividualRelationshipInput, "fileUuid"> & { fileUuid?: string }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.individualRelationship.findUnique({
      where: { id },
      select: { id: true, fileUuid: true },
    });
    if (!existing) throw new Error("Relationship not found.");
    const fileUuid = input.fileUuid ?? existing.fileUuid;
    const participants = await validateRelationshipParticipants(
      tx,
      fileUuid,
      input.relationshipTypeId,
      input.participants,
    );
    await tx.individualRelationshipParticipant.deleteMany({ where: { relationshipId: id } });
    return tx.individualRelationship.update({
      where: { id },
      data: {
        relationshipTypeId: input.relationshipTypeId,
        notes: input.notes?.trim() || null,
        participants: {
          create: participants.map((p, idx) => ({
            individualId: p.individualId,
            roleId: p.roleId,
            sortOrder: p.sortOrder ?? idx,
          })),
        },
      },
      include: {
        relationshipType: true,
        participants: { include: { individual: true, role: true }, orderBy: { sortOrder: "asc" } },
      },
    });
  });
}

/**
 * Given a relationship type and one participant's role, returns the DB id of the
 * reciprocal role for the other participant, using the `reciprocalRoleKey` stored on
 * each `RelationshipTypeRole` row.
 *
 * Returns null when: the role has no reciprocal (symmetric types with one shared role
 * point to themselves, which is valid), the role doesn't belong to the type, or the
 * reciprocal key has no matching sibling role (custom types with missing data).
 *
 * GEDCOM export note: the reciprocal role corresponds to `gedcomRelaBtoA` on the
 * relationship type — e.g., if A is "godparent" (gedcomRelaAtoB), B is "godchild"
 * (gedcomRelaBtoA). This mapping is resolved by `reciprocalRoleKey` at runtime.
 */
export async function inferReciprocalRoleId(
  relationshipTypeId: string,
  selectedRoleId: string,
): Promise<string | null> {
  const role = await prisma.relationshipTypeRole.findFirst({
    where: { id: selectedRoleId, relationshipTypeId },
    select: { reciprocalRoleKey: true },
  });
  if (!role?.reciprocalRoleKey) return null;
  const reciprocal = await prisma.relationshipTypeRole.findFirst({
    where: { relationshipTypeId, key: role.reciprocalRoleKey },
    select: { id: true },
  });
  return reciprocal?.id ?? null;
}

export async function listAllRelationships(fileUuid: string) {
  return prisma.individualRelationship.findMany({
    where: { fileUuid },
    orderBy: { updatedAt: "desc" },
    include: {
      relationshipType: { include: { roles: true } },
      participants: { include: { individual: true, role: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function listRelationshipsForIndividual(individualId: string) {
  const individual = await prisma.gedcomIndividual.findUnique({
    where: { id: individualId },
    select: { fileUuid: true },
  });
  if (!individual) return [];
  return prisma.individualRelationship.findMany({
    where: { fileUuid: individual.fileUuid, participants: { some: { individualId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      relationshipType: { include: { roles: true } },
      participants: { include: { individual: true, role: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}
