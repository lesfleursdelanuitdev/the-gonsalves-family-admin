# Changelog + Undo System — Implementation Plan

## Goal

Record every mutation to GEDCOM tree data so that administrators can:

1. See **who** changed **what** and **when**.
2. View a full history for any entity (individual, family, event, etc.).
3. **Undo** any saved change as an atomic batch.

Design constraints:

- No redundant full-entity snapshots on every field edit — store only changed fields for updates.
- Derived / denormalized columns are **not** logged; they are recomputed after undo.
- Every row-level change produced by a single user "Save" shares a **batch ID** so undo reverts the entire logical action.

---

## 1. Schema Changes

### 1.1 New model: `ChangeLog`

Add to `schema.prisma`:

```prisma
model ChangeLog {
  id          String    @id @default(uuid()) @db.Uuid
  fileUuid    String    @map("file_uuid") @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)

  entityType  String    @map("entity_type") @db.VarChar(50)
  entityId    String    @map("entity_id") @db.Uuid
  entityXref  String?   @map("entity_xref") @db.Text

  operation   String    @db.VarChar(20)  // create | update | delete | link | unlink
  changeset   Json

  batchId     String    @map("batch_id") @db.Uuid
  summary     String?   @db.Text

  undoneAt    DateTime? @map("undone_at") @db.Timestamptz(6)
  undoneBy    String?   @map("undone_by") @db.Uuid

  user        User      @relation("ChangeLogUser", fields: [userId], references: [id], onDelete: Cascade)
  undoer      User?     @relation("ChangeLogUndoneBy", fields: [undoneBy], references: [id], onDelete: SetNull)

  @@index([fileUuid, createdAt])
  @@index([fileUuid, entityType, entityId])
  @@index([batchId])
  @@index([userId])
  @@map("change_log")
}
```

### 1.2 User model additions

Add two relation arrays to the existing `User` model:

```prisma
changeLogs        ChangeLog[] @relation("ChangeLogUser")
undoneChangeLogs  ChangeLog[] @relation("ChangeLogUndoneBy")
```

### 1.3 Migration

Run `npx prisma migrate dev --name add_change_log` after updating the schema. No existing tables are altered.

---

## 2. Changeset JSON Structure

The `changeset` column stores different shapes depending on `operation`:

| Operation   | Changeset shape                                                        | How to undo                           |
| ----------- | ---------------------------------------------------------------------- | ------------------------------------- |
| `create`    | `{ "snapshot": { ...all fields of new row } }`                         | Delete the row by `entityId`          |
| `update`    | `{ "before": { ...changed fields only }, "after": { ...changed fields only } }` | Apply `before` values to the row |
| `delete`    | `{ "snapshot": { ...all fields of deleted row } }`                     | Re-insert from snapshot               |
| `link`      | `{ "junction": "table_name", "row": { ...full junction row } }`       | Delete the junction row               |
| `unlink`    | `{ "junction": "table_name", "row": { ...full junction row } }`       | Re-insert the junction row            |

---

## 3. What NOT to Log (Derived / Denormalized Data)

These fields are recomputed from source-of-truth data and must **not** appear in changesets. After undo, a `recomputeDenorm()` call refreshes them.

**`GedcomIndividual`**: `fullNameLower`, `birthYear`, `deathYear`, `birthDateDisplay`, `birthPlaceDisplay`, `deathDateDisplay`, `deathPlaceDisplay`, `hasParents`, `hasChildren`, `hasSpouse`.

**`GedcomFamily`**: `marriageDateDisplay`, `marriagePlaceDisplay`, `marriageYear`, `childrenCount`, `husbandXref`, `wifeXref`.

**`GedcomSurname` / `GedcomGivenName`**: `frequency` counts.

**All models**: any `*Lower` text-search columns.

---

## 4. Backend — Changelog Service

### 4.1 ChangeCtx type

**New file: `lib/admin/changelog.ts`**

Today every `lib/admin/` function takes `(tx: Tx, fileUuid: string, ...)` but never a user ID. Instead of adding two new parameters everywhere, introduce a context carrier that replaces both `tx` and `fileUuid`:

```typescript
import { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface ChangeCtx {
  tx: Tx;
  fileUuid: string;
  userId: string;
  batchId: string;
}

export function newBatchId(): string {
  return crypto.randomUUID();
}
```

### 4.2 Logging functions

All live in `lib/admin/changelog.ts`. Each writes a single `change_log` row inside the same `tx` that performs the data change.

| Function | Signature | Purpose |
| -------- | --------- | ------- |
| `logCreate` | `(ctx, entityType, entityId, entityXref?, snapshot)` | Record a row creation with full snapshot |
| `logUpdate` | `(ctx, entityType, entityId, entityXref?, before, after)` | Record changed fields only; no-op if before === after |
| `logDelete` | `(ctx, entityType, entityId, entityXref?, snapshot)` | Record a deletion with full snapshot for re-creation |
| `logLink`   | `(ctx, junctionTable, entityId, entityXref?, row)` | Record a junction row insertion |
| `logUnlink` | `(ctx, junctionTable, entityId, entityXref?, row)` | Record a junction row removal |
| `setBatchSummary` | `(ctx, summary)` | Update all rows in the batch with a human-readable description |

### 4.3 Batch summary generation

At the end of each route handler (after all sub-operations), call `setBatchSummary` with a string like:

- `"Created individual John Doe (I42)"`
- `"Updated birth date for Maria Silva (I7)"`
- `"Deleted family F12"`
- `"Added child I5 to family F3"`

---

## 5. Signature Refactor — Threading ChangeCtx

### 5.1 Pattern

Every `lib/admin/` function that currently takes `(tx: Tx, fileUuid: string, ...)` changes to `(ctx: ChangeCtx, ...)`. The function destructures `{ tx, fileUuid }` from `ctx` internally, so the body changes are minimal. The additional `userId` and `batchId` are available for `log*` calls.

### 5.2 Affected lib files

| File | Functions to update |
| ---- | ------------------- |
| `lib/admin/admin-individual-editor-apply.ts` | `applyIndividualEditorPayload`, `createIndividualFromEditorPayload`, `repairIndividualKeyFactDenormFromEvents`, `createNewSpouseFamilyRecords`, `applyAddChildrenToSpouseFamilies`, `syncIndividualSpouseFamilies`, `syncIndividualChildFamilies`, `recomputeIndividualFamilyFlags` |
| `lib/admin/admin-individual-names.ts` | `syncIndividualNameForms` |
| `lib/admin/admin-individual-key-events.ts` | `upsertIndividualKeyFact` |
| `lib/admin/admin-individual-families.ts` | Any helpers called by the editor apply |
| `lib/admin/admin-family-membership.ts` | `addParentToFamily`, `removeParentFromFamily`, `addChildToFamily`, `removeChildFromFamily` |
| `lib/admin/admin-family-delete.ts` | `deleteGedcomFamilyWithCleanup` |
| `lib/admin/admin-family-marriage.ts` | `upsertFamilyMarriageFact`, `upsertFamilyDivorceFact` |
| `lib/admin/admin-event-create.ts` | `findOrCreateGedcomDate`, `findOrCreateGedcomPlace` (or wrappers) |
| `lib/admin/admin-note-links.ts` | `createGedcomNoteWithLinks`, `replaceNoteLinksInTx` |

### 5.3 Route handler changes

Each `withAdminAuth` handler already has access to `user.id` (currently ignored as `_user`). The pattern becomes:

```typescript
export const PATCH = withAdminAuth(async (req, user, ctx) => {
  // ...parse body...
  const batchId = newBatchId();
  await prisma.$transaction(async (tx) => {
    const changeCtx: ChangeCtx = { tx, fileUuid, userId: user.id, batchId };
    await applyIndividualEditorPayload(changeCtx, individualId, payload);
    await setBatchSummary(changeCtx, `Updated individual ${name} (${xref})`);
  });
  // ...return response...
});
```

---

## 6. Mutation Instrumentation — Full Inventory

### 6.1 Individuals

**POST (create)**
- After inserting the individual row: `logCreate(ctx, "individual", newId, newXref, snapshot)`.
- `logCreate` for new `gedcom_file_objects` entry.
- Sub-operations (names, birth/death, family links) each log via the same `ctx` as described below.
- `setBatchSummary(ctx, "Created individual ...")`.

**PATCH (update via editor payload)**
`applyIndividualEditorPayload` calls sub-functions, each logging:

| Sub-operation | Log calls |
| ------------- | --------- |
| `syncIndividualNameForms` | `logDelete` removed name forms; `logCreate` new ones; `logUpdate` changed ones. `logLink`/`logUnlink` for name-form-to-given-name and name-form-to-surname junctions. |
| `upsertIndividualKeyFact` (birth/death) | `logCreate` for new event+date+place; `logUpdate` for changed event/date/place; `logDelete` if clearing a key fact. |
| Sex change | `logUpdate(ctx, "individual", id, xref, { sex: old }, { sex: new })` |
| Living change | `logUpdate(ctx, "individual", id, xref, { isLiving: old }, { isLiving: new })` |
| `syncIndividualSpouseFamilies` | `logLink`/`logUnlink` for spouse junctions; `logUpdate` on family rows if husband/wife slots change. |
| `createNewSpouseFamilyRecords` | `logCreate` for new family, new partner individual (if any), new spouse junctions. |
| `syncIndividualChildFamilies` | `logLink`/`logUnlink` for `gedcom_family_child` and `gedcom_parent_child`; `logUpdate` for relationship type / pedigree / birth order changes. |
| `applyAddChildrenToSpouseFamilies` | `logCreate` for new child individuals; `logLink` for new family-child and parent-child junctions. |
| `recomputeIndividualFamilyFlags` | **Not logged** — derived. |

**DELETE**
Before each `deleteMany`, read the rows being deleted:
1. `logUnlink` for spouse junction rows.
2. `logUnlink` for family-child and parent-child rows.
3. `logDelete` for individual-event junctions + orphan events (with their dates/places).
4. `logDelete` for individual-note/source/media junctions.
5. `logDelete` for name forms and their given-name/surname links.
6. `logDelete` for the individual row itself (full snapshot).
7. `logDelete` for the `gedcom_file_objects` xref row.

### 6.2 Families

**POST (create)**
- `logCreate` for new family row.
- `logCreate` for `gedcom_file_objects` entry.
- If spouse xrefs synced: `logUpdate` on family for xref fields.

**PATCH (update)**
- Read family row before update.
- Marriage/divorce upsert: `logCreate` or `logUpdate` for MARR/DIV events, dates, places, family-event junctions, and denorm fields.
- Direct field changes: `logUpdate` with before/after.

**DELETE**
- `deleteGedcomFamilyWithCleanup`: read + log each junction type, then `logDelete` for the family row.

**Membership (POST /families/[id]/membership)**
- `addParent`/`removeParent`: `logLink`/`logUnlink` for spouse junctions; `logUpdate` for family spouse slots.
- `addChild`/`removeChild`: `logLink`/`logUnlink` for family-child and parent-child junctions.
- `createParentAndAdd`/`createChildAndAdd`: `logCreate` for new individual + membership link logs.

### 6.3 Events

**POST (create)**
- `logCreate` for event row, date (if new), place (if new).
- `logLink` for individual-event and/or family-event junctions.

**PATCH (update)**
- Read before state.
- `logUpdate` for event fields, date/place changes.
- If links replaced: `logUnlink` old junctions + `logLink` new junctions.

**DELETE**
- `logUnlink` for individual/family event junctions.
- `logDelete` for event-note, event-source junctions.
- `logDelete` for event row.
- Orphan date/place cleanup: `logDelete` if removed.

### 6.4 Notes

**POST**: `logCreate` for note + `logLink` for each junction (individual-note, family-note, event-note, source-note).

**PATCH**: `logUpdate` for note content/isTopLevel. If links replaced: `logUnlink` old + `logLink` new.

**DELETE**: `logUnlink` for all junctions + `logDelete` for note + `logDelete` for file-objects.

### 6.5 Sources

**POST**: `logCreate` for source row.

**PATCH**: `logUpdate` for changed fields.

**DELETE**: `logUnlink` for citation junctions (individual-source, family-source, event-source) + `logDelete` for source-note, source-media, source-repository junctions + `logDelete` for source row.

### 6.6 Media

**POST**: `logCreate` for media row + `logLink` for individual-media / family-media junctions.

**PATCH**: `logUpdate` for changed fields (title, fileRef, form).

**DELETE**: `logUnlink` for individual-media, family-media, source-media junctions + `logDelete` for media row.

---

## 7. Undo Logic

### 7.1 New file: `lib/admin/changelog-undo.ts`

**`undoBatch(tx, fileUuid, batchId, undoneByUserId)`**

Steps:

1. Load all `ChangeLog` rows for `batchId`, ordered by `createdAt DESC, id DESC` (reverse insertion order).
2. Verify none are already undone (`undoneAt IS NULL`).
3. For each entry, apply the reverse operation:

| Original operation | Undo action |
| ------------------ | ----------- |
| `create`           | Delete the row by `entityId` from the target table |
| `update`           | Apply `changeset.before` field values via UPDATE |
| `delete`           | Re-insert from `changeset.snapshot` |
| `link`             | Delete the junction row using stored key fields |
| `unlink`           | Re-insert the junction row from `changeset.row` |

4. Run `recomputeDenorm()` for all affected entities (individuals, families).
5. Mark all entries: `undoneAt = now()`, `undoneBy = undoneByUserId`.
6. Write a **new** changelog batch for the undo itself (so the undo action appears in history and could theoretically be undone).

### 7.2 Entity type to Prisma model mapping

```typescript
const ENTITY_TABLE_MAP: Record<string, string> = {
  individual:                "gedcomIndividual",
  family:                    "gedcomFamily",
  event:                     "gedcomEvent",
  note:                      "gedcomNote",
  source:                    "gedcomSource",
  media:                     "gedcomMedia",
  date:                      "gedcomDate",
  place:                     "gedcomPlace",
  file_object:               "gedcomFileObject",
  individual_name_form:      "gedcomIndividualNameForm",
  name_form_given_name:      "gedcomNameFormGivenName",
  name_form_surname:         "gedcomNameFormSurname",
  individual_event:          "gedcomIndividualEvent",
  family_event:              "gedcomFamilyEvent",
  individual_note:           "gedcomIndividualNote",
  family_note:               "gedcomFamilyNote",
  event_note:                "gedcomEventNote",
  source_note:               "gedcomSourceNote",
  individual_source:         "gedcomIndividualSource",
  family_source:             "gedcomFamilySource",
  event_source:              "gedcomEventSource",
  individual_media:          "gedcomIndividualMedia",
  family_media:              "gedcomFamilyMedia",
  source_media:              "gedcomSourceMedia",
  source_repository:         "gedcomSourceRepository",
  family_child:              "gedcomFamilyChild",
  parent_child:              "gedcomParentChild",
  spouse:                    "gedcomSpouse",
  family_surname:            "gedcomFamilySurname",
  individual_occupation:     "gedcomIndividualOccupation",
  individual_nationality:    "gedcomIndividualNationality",
};
```

### 7.3 Denorm recompute after undo

After all row-level reversals, call existing helpers to refresh derived columns:

- `recomputeIndividualFamilyFlags(ctx, individualId)` — `hasSpouse`, `hasChildren`, `hasParents`.
- `repairIndividualKeyFactDenormFromEvents(ctx, individualId)` — birth/death display fields, years.
- `syncFamilySpouseXrefs(tx, familyId)` — husband/wife xref strings.
- Recount `childrenCount` on affected families.
- Recount `frequency` on affected surnames / given names.

### 7.4 Undo constraint

Only the **most recent non-undone batch** can be undone (prevents conflicts from out-of-order reverts on overlapping entities). The API route enforces this by checking that no later non-undone batch touches any of the same `(entityType, entityId)` pairs.

---

## 8. API Routes

### 8.1 `GET /api/admin/changelog`

**Query params**: `page`, `limit`, `entityType?`, `entityId?`, `userId?`.

Returns paginated **batches** (grouped by `batchId`), each containing:
- `batchId`, `summary`, `createdAt`
- `userId` + user display name
- Primary `operation` and primary `entityType` of the batch
- `changeCount` (number of `change_log` rows in the batch)
- `undoneAt`, `undoneBy` (null if still active)
- `canUndo` (boolean — true if this batch is the most recent non-undone batch for its entities)

Implementation: SQL query that groups by `batch_id`, aggregates counts, and joins `users` for display name.

### 8.2 `GET /api/admin/changelog/[batchId]`

Returns all `ChangeLog` rows for one batch, ordered by `createdAt ASC`.

Each row includes the full `changeset` JSON, `entityType`, `entityId`, `entityXref`, `operation`. Used for the detail/expand view in the UI.

### 8.3 `POST /api/admin/changelog/[batchId]/undo`

Calls `undoBatch()` inside a `prisma.$transaction`. Returns `200` on success or `409` if the batch cannot be undone (already undone, or a later batch conflicts).

---

## 9. UI

### 9.1 Global Changelog Page

**Route**: `src/app/admin/changelog/page.tsx`

**Nav entry**: Add to `adminNavItems` in `src/config/admin-nav.ts` with label `"Changelog"` and a `History` Lucide icon (or `ClipboardList`).

**Layout**: Uses `DataViewer` with these columns:

| Column  | Content |
| ------- | ------- |
| When    | Relative timestamp ("2 hours ago"), tooltip with exact datetime |
| Who     | User display name |
| Action  | Human-readable `summary` text |
| Scope   | Badge with entity type + change count |
| Status  | "Active" or "Undone" badge |
| Actions | "Details" expand button + "Undo" button (shown only when `canUndo` is true) |

Card mode for mobile shows the same information stacked vertically.

Optional filter bar: entity type dropdown, user dropdown, date range.

### 9.2 Batch Detail (Expandable Row or Modal)

When clicking "Details" on a batch row:

- Fetches `GET /api/admin/changelog/[batchId]`.
- Shows a list of each row-level change:
  - For `update`: field name, old value, new value.
  - For `create` / `delete`: entity type + xref + key identifying fields from the snapshot.
  - For `link` / `unlink`: junction name + connected entity identifiers.

### 9.3 Per-Entity History Card

**New component**: `src/components/admin/EntityHistoryCard.tsx`

A reusable `Card` component that:
- Accepts `entityType` and `entityId` props.
- Fetches `GET /api/admin/changelog?entityType=...&entityId=...`.
- Renders a compact timeline of changes to this entity.
- Each entry shows: when, who, summary, undo button.

Added as a section at the bottom of each detail page:
- `src/app/admin/individuals/[id]/page.tsx`
- `src/app/admin/families/[id]/page.tsx`
- `src/app/admin/events/[id]/page.tsx`
- `src/app/admin/notes/[id]/page.tsx`
- `src/app/admin/sources/[id]/page.tsx` (if detail page exists)
- `src/app/admin/media/[id]/page.tsx`

### 9.4 Undo Confirmation Dialog

Clicking "Undo" opens a confirmation:

> **Undo this change?**
>
> This will revert all changes from "[summary]" made by [user] at [time].
> [N] database rows will be affected.
>
> [Cancel] [Confirm Undo]

After success: invalidate React Query caches for the changelog and all affected entities.

### 9.5 React Query Hooks

**New file**: `src/hooks/useChangelog.ts`

| Hook | Purpose |
| ---- | ------- |
| `useChangelogBatches(filters?)` | Paginated batch list for the global page |
| `useChangelogForEntity(entityType, entityId)` | Filtered batch list for per-entity history cards |
| `useChangelogBatchDetail(batchId)` | Full row-level detail for one batch |
| `useUndoBatch()` | Mutation that calls `POST .../undo`; on success invalidates changelog + entity queries |

---

## 10. File Inventory

### New files (~8)

| File | Purpose |
| ---- | ------- |
| `lib/admin/changelog.ts` | ChangeCtx type, log functions, batch helpers |
| `lib/admin/changelog-undo.ts` | Undo logic, entity-table map, denorm recompute |
| `src/app/api/admin/changelog/route.ts` | GET batch list |
| `src/app/api/admin/changelog/[batchId]/route.ts` | GET batch detail |
| `src/app/api/admin/changelog/[batchId]/undo/route.ts` | POST undo |
| `src/app/admin/changelog/page.tsx` | Global changelog page |
| `src/hooks/useChangelog.ts` | React Query hooks |
| `src/components/admin/EntityHistoryCard.tsx` | Reusable per-entity history card |

### Modified files (~28)

| File | Change |
| ---- | ------ |
| `prisma/schema.prisma` (in ligneous-prisma) | Add `ChangeLog` model + `User` relations |
| `src/config/admin-nav.ts` | Add changelog nav item |
| `lib/admin/admin-individual-editor-apply.ts` | Thread `ChangeCtx`, add log calls in all sub-operations |
| `lib/admin/admin-individual-names.ts` | Thread `ChangeCtx`, log name form changes |
| `lib/admin/admin-individual-key-events.ts` | Thread `ChangeCtx`, log birth/death upserts |
| `lib/admin/admin-individual-families.ts` | Thread `ChangeCtx` |
| `lib/admin/admin-family-membership.ts` | Thread `ChangeCtx`, log add/remove parent/child |
| `lib/admin/admin-family-delete.ts` | Thread `ChangeCtx`, log cascade deletes |
| `lib/admin/admin-family-marriage.ts` | Thread `ChangeCtx`, log marriage/divorce upserts |
| `lib/admin/admin-event-create.ts` | Thread `ChangeCtx`, log date/place creation |
| `lib/admin/admin-note-links.ts` | Thread `ChangeCtx`, log note + junction changes |
| `src/app/api/admin/individuals/route.ts` | Create `ChangeCtx`, pass to create function |
| `src/app/api/admin/individuals/[id]/route.ts` | Create `ChangeCtx`, pass to apply/delete functions |
| `src/app/api/admin/families/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/families/[id]/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/families/[id]/membership/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/events/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/events/[id]/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/notes/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/notes/[id]/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/sources/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/sources/[id]/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/media/route.ts` | Create `ChangeCtx` |
| `src/app/api/admin/media/[id]/route.ts` | Create `ChangeCtx` |
| `src/app/admin/individuals/[id]/page.tsx` | Add EntityHistoryCard |
| `src/app/admin/families/[id]/page.tsx` | Add EntityHistoryCard |
| `src/app/admin/events/[id]/page.tsx` | Add EntityHistoryCard |
| `src/app/admin/notes/[id]/page.tsx` | Add EntityHistoryCard |
| `src/app/admin/media/[id]/page.tsx` | Add EntityHistoryCard |

---

## 11. Implementation Order

| Step | What | Depends on | Estimated size |
| ---- | ---- | ---------- | -------------- |
| 1 | Schema: add `ChangeLog` model + User relations + run migration | — | Small |
| 2 | `lib/admin/changelog.ts`: `ChangeCtx`, all `log*` functions, `newBatchId`, `setBatchSummary` | Step 1 | Medium |
| 3 | `lib/admin/changelog-undo.ts`: `undoBatch`, entity-table map, denorm recompute | Step 2 | Large |
| 4 | Thread `ChangeCtx` through `applyIndividualEditorPayload` and all its sub-functions | Step 2 | Large |
| 5 | Thread `ChangeCtx` through `admin-family-membership.ts` functions | Step 2 | Medium |
| 6 | Instrument Individual POST / PATCH / DELETE route handlers | Steps 4-5 | Medium |
| 7 | Instrument Family POST / PATCH / DELETE + membership route handlers | Steps 4-5 | Medium |
| 8 | Instrument Event POST / PATCH / DELETE route handlers | Step 2 | Medium |
| 9 | Instrument Note, Source, Media route handlers | Step 2 | Small each |
| 10 | API routes: GET changelog list, GET batch detail, POST undo | Steps 2-3 | Medium |
| 11 | React Query hooks: `useChangelogBatches`, `useChangelogForEntity`, `useChangelogBatchDetail`, `useUndoBatch` | Step 10 | Small |
| 12 | Global changelog page + nav entry | Step 11 | Medium |
| 13 | Per-entity history cards on detail pages | Step 11 | Medium |
| 14 | Undo confirmation dialog + cache invalidation | Steps 11-12 | Small |

Steps 4-9 are the bulk of the work but follow a repetitive pattern — once individuals are done, the rest use the same template.

---

## 12. Relationship to Existing `Activity` Model

The schema already has an `Activity` model (table 33) intended as a user-facing social feed. It is **unused** by admin mutations today and serves a different purpose than the changelog:

| Concern | `Activity` | `ChangeLog` |
| ------- | ---------- | ----------- |
| Audience | End users / collaborators | Administrators |
| Granularity | One entry per user action | One entry per row-level change |
| Undo support | No | Yes (batch undo) |
| Data stored | Human-readable description + optional metadata | Structured before/after diffs |

The two tables are kept separate. Optionally, a single `Activity` row could be written per changelog batch as a human-readable summary for the social feed, but that is a future enhancement.
