import type { Prisma, PrismaClient } from "@ligneous/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RelationshipTypeSeed = {
  key: string;
  label: string;
  isSymmetric: boolean;
  gedcomRelaAtoB: string;
  gedcomRelaBtoA: string;
  roles: Array<{
    key: string;
    label: string;
    reciprocalRoleKey: string;
  }>;
};

export const DEFAULT_RELATIONSHIP_TYPE_SEEDS: RelationshipTypeSeed[] = [
  {
    key: "friendship",
    label: "Friendship",
    isSymmetric: true,
    gedcomRelaAtoB: "friend",
    gedcomRelaBtoA: "friend",
    roles: [{ key: "friend", label: "Friend", reciprocalRoleKey: "friend" }],
  },
  {
    key: "dating",
    label: "Dating / Romantic Relationship",
    isSymmetric: true,
    gedcomRelaAtoB: "partner",
    gedcomRelaBtoA: "partner",
    roles: [{ key: "partner", label: "Partner", reciprocalRoleKey: "partner" }],
  },
  {
    key: "godparenthood",
    label: "Godparenthood",
    isSymmetric: false,
    gedcomRelaAtoB: "godparent",
    gedcomRelaBtoA: "godchild",
    roles: [
      { key: "godparent", label: "Godparent", reciprocalRoleKey: "godchild" },
      { key: "godchild", label: "Godchild", reciprocalRoleKey: "godparent" },
    ],
  },
  {
    key: "enslavement",
    label: "Enslavement",
    isSymmetric: false,
    gedcomRelaAtoB: "enslaver",
    gedcomRelaBtoA: "enslaved",
    roles: [
      { key: "enslaver", label: "Enslaver", reciprocalRoleKey: "enslaved" },
      { key: "enslaved", label: "Enslaved Person", reciprocalRoleKey: "enslaver" },
    ],
  },
  {
    key: "mentorship",
    label: "Mentorship",
    isSymmetric: false,
    gedcomRelaAtoB: "mentor",
    gedcomRelaBtoA: "mentee",
    roles: [
      { key: "mentor", label: "Mentor", reciprocalRoleKey: "mentee" },
      { key: "mentee", label: "Mentee", reciprocalRoleKey: "mentor" },
    ],
  },
  {
    key: "employment",
    label: "Employment",
    isSymmetric: false,
    gedcomRelaAtoB: "employer",
    gedcomRelaBtoA: "employee",
    roles: [
      { key: "employer", label: "Employer", reciprocalRoleKey: "employee" },
      { key: "employee", label: "Employee", reciprocalRoleKey: "employer" },
    ],
  },
  {
    key: "step_parenthood",
    label: "Step-parenthood",
    isSymmetric: false,
    gedcomRelaAtoB: "step-parent",
    gedcomRelaBtoA: "step-child",
    roles: [
      { key: "step_parent", label: "Step-parent", reciprocalRoleKey: "step_child" },
      { key: "step_child", label: "Step-child", reciprocalRoleKey: "step_parent" },
    ],
  },
  {
    key: "custom_association",
    label: "Custom association",
    isSymmetric: true,
    gedcomRelaAtoB: "associated",
    gedcomRelaBtoA: "associated",
    roles: [{ key: "associated_person", label: "Associated person", reciprocalRoleKey: "associated_person" }],
  },
];

const RELA_TO_TYPE_ROLE: Record<string, { typeKey: string; roleKey: string }> = {
  friend: { typeKey: "friendship", roleKey: "friend" },
  partner: { typeKey: "dating", roleKey: "partner" },
  dating: { typeKey: "dating", roleKey: "partner" },
  romantic_partner: { typeKey: "dating", roleKey: "partner" },
  godparent: { typeKey: "godparenthood", roleKey: "godparent" },
  godchild: { typeKey: "godparenthood", roleKey: "godchild" },
  enslaver: { typeKey: "enslavement", roleKey: "enslaver" },
  slave_owner: { typeKey: "enslavement", roleKey: "enslaver" },
  enslaved: { typeKey: "enslavement", roleKey: "enslaved" },
  enslaved_person: { typeKey: "enslavement", roleKey: "enslaved" },
  mentor: { typeKey: "mentorship", roleKey: "mentor" },
  mentee: { typeKey: "mentorship", roleKey: "mentee" },
  employer: { typeKey: "employment", roleKey: "employer" },
  employee: { typeKey: "employment", roleKey: "employee" },
  step_parent: { typeKey: "step_parenthood", roleKey: "step_parent" },
  stepparent: { typeKey: "step_parenthood", roleKey: "step_parent" },
  step_child: { typeKey: "step_parenthood", roleKey: "step_child" },
  stepchild: { typeKey: "step_parenthood", roleKey: "step_child" },
};

export function normalizeRelaToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

export function lookupTypeRoleForRela(rawRela: string): { typeKey: string; roleKey: string } | null {
  const normalized = normalizeRelaToken(rawRela);
  return RELA_TO_TYPE_ROLE[normalized] ?? null;
}

export async function ensureDefaultRelationshipTypes(db: DbClient, treeId: string | null): Promise<void> {
  for (const seed of DEFAULT_RELATIONSHIP_TYPE_SEEDS) {
    const existing = await db.relationshipType.findFirst({
      where: { treeId, key: seed.key },
      select: { id: true },
    });
    const type = existing
      ? await db.relationshipType.update({
          where: { id: existing.id },
          data: {
            label: seed.label,
            isSymmetric: seed.isSymmetric,
            gedcomRelaAtoB: seed.gedcomRelaAtoB,
            gedcomRelaBtoA: seed.gedcomRelaBtoA,
          },
          select: { id: true },
        })
      : await db.relationshipType.create({
          data: {
            treeId,
            key: seed.key,
            label: seed.label,
            isSymmetric: seed.isSymmetric,
            gedcomRelaAtoB: seed.gedcomRelaAtoB,
            gedcomRelaBtoA: seed.gedcomRelaBtoA,
          },
          select: { id: true },
        });
    for (const role of seed.roles) {
      await db.relationshipTypeRole.upsert({
        where: { relationshipTypeId_key: { relationshipTypeId: type.id, key: role.key } },
        update: {
          label: role.label,
          reciprocalRoleKey: role.reciprocalRoleKey,
        },
        create: {
          relationshipTypeId: type.id,
          key: role.key,
          label: role.label,
          reciprocalRoleKey: role.reciprocalRoleKey,
        },
      });
    }
  }
}

export async function resolveTreeIdForFileUuid(db: DbClient, fileUuid: string): Promise<string | null> {
  const tree = await db.tree.findFirst({
    where: { gedcomFileId: fileUuid },
    select: { id: true },
  });
  return tree?.id ?? null;
}

export async function listRelationshipTypes(db: DbClient, treeId?: string | null) {
  return db.relationshipType.findMany({
    where: treeId ? { OR: [{ treeId }, { treeId: null }] } : undefined,
    orderBy: [{ treeId: "desc" }, { label: "asc" }],
    include: { roles: { orderBy: { key: "asc" } } },
  });
}

export async function findEquivalentTwoPartyRelationship(
  db: DbClient,
  args: {
    fileUuid: string;
    relationshipTypeId: string;
    firstIndividualId: string;
    firstRoleId: string;
    secondIndividualId: string;
    secondRoleId: string;
  },
) {
  const candidates = await db.individualRelationship.findMany({
    where: {
      fileUuid: args.fileUuid,
      relationshipTypeId: args.relationshipTypeId,
      participants: {
        some: { individualId: { in: [args.firstIndividualId, args.secondIndividualId] } },
      },
    },
    include: { participants: true },
  });
  for (const rel of candidates) {
    if (rel.participants.length !== 2) continue;
    const p = rel.participants;
    const direct =
      p.some((x) => x.individualId === args.firstIndividualId && x.roleId === args.firstRoleId) &&
      p.some((x) => x.individualId === args.secondIndividualId && x.roleId === args.secondRoleId);
    const reverse =
      p.some((x) => x.individualId === args.firstIndividualId && x.roleId === args.secondRoleId) &&
      p.some((x) => x.individualId === args.secondIndividualId && x.roleId === args.firstRoleId);
    if (direct || reverse) return rel;
  }
  return null;
}

