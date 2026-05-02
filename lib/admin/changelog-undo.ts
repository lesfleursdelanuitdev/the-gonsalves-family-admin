import type { Prisma } from "@ligneous/prisma";
import {
  rebuildSpouseRowsForFamily,
  recomputeIndividualFamilyFlags,
  syncFamilySpouseXrefs,
} from "@/lib/admin/admin-individual-families";
import { refreshIndividualKeyFactsDenorm } from "@/lib/admin/admin-individual-key-events";
import { logCreate, logDelete, logLink, logUnlink, logUpdate, setBatchSummary, type ChangeCtx } from "@/lib/admin/changelog";

type Tx = Prisma.TransactionClient;

/**
 * Maps entityType strings used in ChangeLog rows to the Prisma delegate name
 * so we can generically call tx[delegate].create / update / delete.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  individual: "gedcomIndividual",
  family: "gedcomFamily",
  event: "gedcomEvent",
  note: "gedcomNote",
  source: "gedcomSource",
  media: "gedcomMedia",
  date: "gedcomDate",
  place: "gedcomPlace",
  file_object: "gedcomFileObject",
  individual_name_form: "gedcomIndividualNameForm",
  name_form_given_name: "gedcomNameFormGivenName",
  name_form_surname: "gedcomNameFormSurname",
  individual_event: "gedcomIndividualEvent",
  family_event: "gedcomFamilyEvent",
  individual_note: "gedcomIndividualNote",
  family_note: "gedcomFamilyNote",
  event_note: "gedcomEventNote",
  source_note: "gedcomSourceNote",
  individual_source: "gedcomIndividualSource",
  family_source: "gedcomFamilySource",
  event_source: "gedcomEventSource",
  individual_media: "gedcomIndividualMedia",
  family_media: "gedcomFamilyMedia",
  source_media: "gedcomSourceMedia",
  event_media: "gedcomEventMedia",
  media_place: "gedcomMediaPlace",
  media_date: "gedcomMediaDate",
  media_app_tag: "gedcomMediaAppTag",
  album_gedcom_media: "albumGedcomMedia",
  site_media_tag: "siteMediaTag",
  user_media_tag: "userMediaTag",
  album_site_media: "albumSiteMedia",
  album_user_media: "albumUserMedia",
  source_repository: "gedcomSourceRepository",
  family_child: "gedcomFamilyChild",
  parent_child: "gedcomParentChild",
  spouse: "gedcomSpouse",
  family_surname: "gedcomFamilySurname",
  individual_occupation: "gedcomIndividualOccupation",
  individual_nationality: "gedcomIndividualNationality",
  given_name: "gedcomGivenName",
  surname: "gedcomSurname",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function delegate(tx: Tx, entityType: string): any {
  const name = ENTITY_TABLE_MAP[entityType] ?? entityType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = (tx as any)[name];
  if (!d) throw new Error(`Unknown entity type for undo: ${entityType} (delegate: ${name})`);
  return d;
}

function stripMeta(snapshot: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(snapshot)) {
    if (k === "createdAt" || k === "updatedAt") {
      out[k] = typeof v === "string" ? new Date(v) : v;
    } else {
      out[k] = v;
    }
  }
  return out;
}

interface ChangeLogRow {
  id: string;
  entityType: string;
  entityId: string;
  entityXref: string | null;
  operation: string;
  changeset: unknown;
}

async function undoSingleEntry(tx: Tx, entry: ChangeLogRow): Promise<void> {
  const cs = entry.changeset as Record<string, unknown>;
  const d = delegate(tx, entry.entityType);

  switch (entry.operation) {
    case "create": {
      try {
        await d.delete({ where: { id: entry.entityId } });
      } catch {
        // Row may already be gone via cascade — tolerate
      }
      break;
    }
    case "update": {
      const before = cs.before as Record<string, unknown> | undefined;
      if (!before || Object.keys(before).length === 0) break;
      const data = stripMeta(before);
      delete data.id;
      try {
        await d.update({ where: { id: entry.entityId }, data });
      } catch {
        // Row may be gone — tolerate
      }
      break;
    }
    case "delete": {
      const snapshot = cs.snapshot as Record<string, unknown> | undefined;
      if (!snapshot) break;
      const data = stripMeta(snapshot);
      try {
        await d.create({ data });
      } catch {
        // Unique constraint — row may already exist
      }
      break;
    }
    case "link": {
      const row = cs.row as Record<string, unknown> | undefined;
      if (!row) break;
      try {
        const jd = delegate(tx, entry.entityType);
        await jd.delete({ where: { id: row.id as string } });
      } catch {
        // Row may already be gone
      }
      break;
    }
    case "unlink": {
      const row = cs.row as Record<string, unknown> | undefined;
      if (!row) break;
      const data = stripMeta(row);
      try {
        const jd = delegate(tx, entry.entityType);
        await jd.create({ data });
      } catch {
        // Unique constraint — row may already exist
      }
      break;
    }
    default:
      break;
  }
}

async function recomputeDenormForBatch(ctx: ChangeCtx, entries: ChangeLogRow[]): Promise<void> {
  const { tx } = ctx;
  const individualIds = new Set<string>();
  const familyIds = new Set<string>();

  for (const e of entries) {
    if (e.entityType === "individual") individualIds.add(e.entityId);
    if (e.entityType === "family") familyIds.add(e.entityId);

    const cs = e.changeset as Record<string, unknown>;
    const row = (cs.row ?? cs.snapshot ?? cs.before ?? {}) as Record<string, unknown>;
    if (row.individualId && typeof row.individualId === "string") individualIds.add(row.individualId);
    if (row.childId && typeof row.childId === "string") individualIds.add(row.childId);
    if (row.parentId && typeof row.parentId === "string") individualIds.add(row.parentId);
    if (row.familyId && typeof row.familyId === "string") familyIds.add(row.familyId);
    if (row.husbandId && typeof row.husbandId === "string") individualIds.add(row.husbandId);
    if (row.wifeId && typeof row.wifeId === "string") individualIds.add(row.wifeId);
  }

  for (const id of individualIds) {
    const exists = await tx.gedcomIndividual.findUnique({ where: { id }, select: { id: true } });
    if (!exists) continue;
    try {
      await recomputeIndividualFamilyFlags(ctx, id);
      await refreshIndividualKeyFactsDenorm(ctx, id);
    } catch {
      // Individual may reference missing data — tolerate
    }
  }

  for (const id of familyIds) {
    const exists = await tx.gedcomFamily.findUnique({ where: { id }, select: { id: true } });
    if (!exists) continue;
    try {
      await rebuildSpouseRowsForFamily(ctx, id);
      await syncFamilySpouseXrefs(tx, id);
      const childCount = await tx.gedcomFamilyChild.count({ where: { familyId: id } });
      await tx.gedcomFamily.update({ where: { id }, data: { childrenCount: childCount } });
    } catch {
      // Family may reference missing data — tolerate
    }
  }
}

/**
 * Revert every change in a batch, processing in reverse chronological order.
 * Records a new "undo" batch so the reversion itself appears in the changelog.
 */
export async function undoBatch(
  tx: Tx,
  fileUuid: string,
  batchId: string,
  undoneByUserId: string,
  undoBatchId: string,
): Promise<void> {
  const entries = await tx.changeLog.findMany({
    where: { batchId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  if (entries.length === 0) throw new Error("Batch not found");

  const alreadyUndone = entries.some((e) => e.undoneAt != null);
  if (alreadyUndone) throw new Error("Batch has already been undone");

  const rows: ChangeLogRow[] = entries.map((e) => ({
    id: e.id,
    entityType: e.entityType,
    entityId: e.entityId,
    entityXref: e.entityXref,
    operation: e.operation,
    changeset: e.changeset,
  }));

  const undoCtx: ChangeCtx = {
    tx,
    fileUuid,
    userId: undoneByUserId,
    batchId: undoBatchId,
  };

  for (const entry of rows) {
    const cs = entry.changeset as Record<string, unknown>;

    switch (entry.operation) {
      case "create":
        await logDelete(undoCtx, entry.entityType, entry.entityId, entry.entityXref,
          (cs.snapshot as Record<string, unknown>) ?? {});
        break;
      case "update":
        await logUpdate(undoCtx, entry.entityType, entry.entityId, entry.entityXref,
          (cs.after as Record<string, unknown>) ?? {},
          (cs.before as Record<string, unknown>) ?? {});
        break;
      case "delete":
        await logCreate(undoCtx, entry.entityType, entry.entityId, entry.entityXref,
          (cs.snapshot as Record<string, unknown>) ?? {});
        break;
      case "link":
        await logUnlink(undoCtx, entry.entityType, entry.entityId, entry.entityXref,
          (cs.row as Record<string, unknown>) ?? {});
        break;
      case "unlink":
        await logLink(undoCtx, entry.entityType, entry.entityId, entry.entityXref,
          (cs.row as Record<string, unknown>) ?? {});
        break;
    }

    await undoSingleEntry(tx, entry);
  }

  await recomputeDenormForBatch(undoCtx, rows);

  await tx.changeLog.updateMany({
    where: { batchId },
    data: { undoneAt: new Date(), undoneBy: undoneByUserId },
  });

  const summary = entries[0]?.summary ?? "Unknown change";
  await setBatchSummary(undoCtx, `Undo: ${summary}`);
}
