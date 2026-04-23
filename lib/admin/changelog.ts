import type { Prisma } from "@ligneous/prisma";

export type Tx = Prisma.TransactionClient;
type JsonInput = Prisma.InputJsonValue;

/**
 * Carried through every mutation function so changelog entries are written
 * atomically inside the same transaction that performs the data change.
 */
export interface ChangeCtx {
  tx: Tx;
  fileUuid: string;
  userId: string;
  batchId: string;
}

export function newBatchId(): string {
  return crypto.randomUUID();
}

// Fields that are derived / denormalized and should never appear in changesets.
// They are recomputed after undo rather than stored.
const INDIVIDUAL_DENORM_FIELDS = new Set([
  "fullNameLower",
  "birthYear",
  "deathYear",
  "birthDateDisplay",
  "birthPlaceDisplay",
  "deathDateDisplay",
  "deathPlaceDisplay",
  "hasParents",
  "hasChildren",
  "hasSpouse",
]);

const FAMILY_DENORM_FIELDS = new Set([
  "marriageDateDisplay",
  "marriagePlaceDisplay",
  "marriageYear",
  "childrenCount",
  "husbandXref",
  "wifeXref",
]);

function stripDenorm(entityType: string, obj: Record<string, unknown>): Record<string, unknown> {
  const deny =
    entityType === "individual"
      ? INDIVIDUAL_DENORM_FIELDS
      : entityType === "family"
        ? FAMILY_DENORM_FIELDS
        : null;
  if (!deny) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!deny.has(k)) out[k] = v;
  }
  return out;
}

function serializableValue(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  return v;
}

function serializableObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = serializableValue(v);
  }
  return out;
}

/**
 * Compute the diff between `before` and `after`, returning only changed fields.
 * Returns null if nothing changed.
 */
function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const bDiff: Record<string, unknown> = {};
  const aDiff: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of allKeys) {
    const bv = serializableValue(before[k]);
    const av = serializableValue(after[k]);
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      bDiff[k] = bv;
      aDiff[k] = av;
    }
  }
  if (Object.keys(bDiff).length === 0) return null;
  return { before: bDiff, after: aDiff };
}

export async function logCreate(
  ctx: ChangeCtx,
  entityType: string,
  entityId: string,
  entityXref: string | null | undefined,
  snapshot: Record<string, unknown>,
) {
  const cleaned = stripDenorm(entityType, serializableObject(snapshot));
  await ctx.tx.changeLog.create({
    data: {
      fileUuid: ctx.fileUuid,
      userId: ctx.userId,
      batchId: ctx.batchId,
      entityType,
      entityId,
      entityXref: entityXref ?? null,
      operation: "create",
      changeset: { snapshot: cleaned } as unknown as JsonInput,
    },
  });
}

export async function logUpdate(
  ctx: ChangeCtx,
  entityType: string,
  entityId: string,
  entityXref: string | null | undefined,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const bClean = stripDenorm(entityType, before);
  const aClean = stripDenorm(entityType, after);
  const diff = diffFields(bClean, aClean);
  if (!diff) return;
  await ctx.tx.changeLog.create({
    data: {
      fileUuid: ctx.fileUuid,
      userId: ctx.userId,
      batchId: ctx.batchId,
      entityType,
      entityId,
      entityXref: entityXref ?? null,
      operation: "update",
      changeset: diff as unknown as JsonInput,
    },
  });
}

export async function logDelete(
  ctx: ChangeCtx,
  entityType: string,
  entityId: string,
  entityXref: string | null | undefined,
  snapshot: Record<string, unknown>,
) {
  const cleaned = stripDenorm(entityType, serializableObject(snapshot));
  await ctx.tx.changeLog.create({
    data: {
      fileUuid: ctx.fileUuid,
      userId: ctx.userId,
      batchId: ctx.batchId,
      entityType,
      entityId,
      entityXref: entityXref ?? null,
      operation: "delete",
      changeset: { snapshot: cleaned } as unknown as JsonInput,
    },
  });
}

export async function logLink(
  ctx: ChangeCtx,
  junctionTable: string,
  entityId: string,
  entityXref: string | null | undefined,
  row: Record<string, unknown>,
) {
  await ctx.tx.changeLog.create({
    data: {
      fileUuid: ctx.fileUuid,
      userId: ctx.userId,
      batchId: ctx.batchId,
      entityType: junctionTable,
      entityId,
      entityXref: entityXref ?? null,
      operation: "link",
      changeset: { junction: junctionTable, row: serializableObject(row) } as unknown as JsonInput,
    },
  });
}

export async function logUnlink(
  ctx: ChangeCtx,
  junctionTable: string,
  entityId: string,
  entityXref: string | null | undefined,
  row: Record<string, unknown>,
) {
  await ctx.tx.changeLog.create({
    data: {
      fileUuid: ctx.fileUuid,
      userId: ctx.userId,
      batchId: ctx.batchId,
      entityType: junctionTable,
      entityId,
      entityXref: entityXref ?? null,
      operation: "unlink",
      changeset: { junction: junctionTable, row: serializableObject(row) } as unknown as JsonInput,
    },
  });
}

export async function setBatchSummary(ctx: ChangeCtx, summary: string) {
  await ctx.tx.changeLog.updateMany({
    where: { batchId: ctx.batchId },
    data: { summary },
  });
}
