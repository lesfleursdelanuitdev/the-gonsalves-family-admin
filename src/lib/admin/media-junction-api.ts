/**
 * ## Admin media junction API (contract)
 *
 * All routes live under **`/api/admin/media/:mediaId/...`**, require admin auth, and scope GEDCOM rows to the
 * current tree via **`getAdminFileUuid()`** (`fileUuid`). Albums and tags use user-owned tables where noted.
 *
 * ### Create link — `POST` JSON bodies
 *
 * | Route segment | Body | Notes |
 * |---------------|------|--------|
 * | **`individual-media`** | `{ individualId: string }` | Required. |
 * | **`family-media`** | `{ familyId: string }` | Required. |
 * | **`event-media`** | `{ eventId: string }` | Required. |
 * | **`source-media`** | `{ sourceId: string }` | Required. |
 * | **`place-media`** | **`placeId`** *or* **`place`** | If `placeId` (string) is set, links that place. Otherwise `place` must be an object parsed by `parsePlaceInput`; server may **find-or-create** a place. |
 * | **`date-media`** | **`dateId`** *or* **`date`** | Same pattern as places: `dateId` or object for `parseDateInput` + find-or-create. |
 * | **`app-tags`** | `{ tagId: string }` | Tag must be global or owned by the user (`assertTagUsableByUser`). |
 * | **`album-links`** | `{ albumId: string }` | Album must belong to the current user. |
 *
 * ### Typical HTTP status codes
 *
 * - **`201`** — Created; response includes the junction row (e.g. `{ placeMedia }`, `{ individualMedia }`).
 * - **`400`** — Missing/invalid body, empty parsed payload, or tag not allowed.
 * - **`404`** — Media, target entity, or album not found for this tree/user.
 * - **`409`** — Duplicate link (unique constraint), or tag “already applied” for that user.
 *
 * ### Delete link
 *
 * **`DELETE /api/admin/media/:mediaId/<segment>/:linkId`** — removes that junction row. Exact behavior and
 * status codes are defined per route file; callers should handle **`404`** if the link is already gone.
 *
 * ### Changelog policy (Phase 3.2)
 *
 * Successful **`POST`** (create link) and **`DELETE`** (remove link) on these junction routes write to
 * **`change_log`** in the **same Prisma transaction** as the mutation:
 *
 * - **`link`** — after insert; `entityType` is the junction key used by undo (e.g. `individual_media`,
 *   `media_place`, `media_app_tag`, `album_gedcom_media`). `changeset.row` is a JSON snapshot of the new row.
 * - **`unlink`** — before delete; same `entityType` and a snapshot of the row being removed.
 *
 * Each request uses a fresh **`batchId`** and **`setBatchSummary`** so the admin changelog UI shows one line per
 * user action. Undo support relies on **`ENTITY_TABLE_MAP`** in `lib/admin/changelog-undo.ts` mapping those
 * `entityType` strings to Prisma delegates. Helpers: `lib/admin/media-junction-changelog.ts`.
 *
 * ### Media delete vs junctions (Phase 3.3)
 *
 * **`DELETE /api/admin/media/:mediaId`** deletes the **`gedcom_media_v2`** row only. All junction tables that
 * reference that media id use **`onDelete: Cascade`** in `packages/ligneous-prisma/prisma/schema.prisma`
 * (`GedcomIndividualMedia`, `GedcomFamilyMedia`, `GedcomSourceMedia`, `GedcomEventMedia`, `GedcomMediaPlace`,
 * `GedcomMediaDate`, `AlbumGedcomMedia`, `GedcomMediaAppTag`). The route does **not** call `deleteMany` on those
 * tables — the database is the single source of truth. If you add a new media junction, give it **`onDelete:
 * Cascade`** toward `GedcomMedia` (or extend the delete handler explicitly; avoid duplicating both).
 *
 * @module media-junction-api
 */

export {};
