# Sibling-View API Plan (Verified vs Schema & Descendancy API)

**Status:** Design only — no implementation yet.  
**Purpose:** Endpoint that returns exactly what the “Show siblings” UI needs: birth union, full-sibling trees (with recursion), and other unions where the person is a child (children only, no recursion). All access is scoped by **file_uuid** for “The Gonsalves Family.”

This plan has been checked against:
- **Prisma schema:** `packages/ligneous-prisma/prisma/schema.prisma`
- **Descendancy API:** `the-gonsalves-family/src/app/api/tree/descendancy/route.ts`
- **Helpers:** `lib/tree.ts`, `lib/tree-ancestry.ts`, `lib/individual-mapper.ts`

---

## 1. Schema Verification

### 1.1 Models and fields used

| Concept | Model | Key fields | Notes |
|--------|--------|------------|--------|
| Person by xref | `GedcomIndividual` | `fileUuid`, `xref`, `id` | `@@unique([fileUuid, xref])` |
| Family | `GedcomFamily` | `fileUuid`, `id`, `xref`, `husbandId`, `wifeId`, `husbandXref`, `wifeXref` | Use xref for API response |
| P is a child of family | `GedcomParentChild` | `fileUuid`, `childId`, `familyId`, `pedigree` | **`familyId` is optional** — filter to `familyId != null` |
| Family → children | Either table | — | Descendancy route uses **GedcomParentChild** (`familyId`, `childId`) and dedupes; could use **GedcomFamilyChild** (`familyId`, `childId`) for a 1:1 list. For consistency with descendancy, use GedcomParentChild and build `familyToChildIds` the same way. |
| Spouse / families of X | `GedcomSpouse` | `fileUuid`, `individualId`, `spouseId`, `familyId` | **`familyId` is optional** — filter to `familyId != null` to get “families where X is a spouse” |

### 1.2 Birth union (pedigree)

- **GedcomParentChild** has `pedigree` (String?, no map in schema — stored as text).
- To identify the **birth** union for person P: among rows where `childId = P.id` and `familyId` is not null, pick the family for which `pedigree === 'birth'` (or equivalent GEDCOM value). If none, fallback to a single family (e.g. first by xref) or document as “birth unknown.”

### 1.3 Relations

- **“Unions where P is a child”:** Query `GedcomParentChild` where `fileUuid` and `childId = P.id`, keep rows with `familyId` set; unique `familyId`s are the union set. One of them is the birth union (by `pedigree`).
- **“Families where X is a spouse”:** Query `GedcomSpouse` where `fileUuid` and (`individualId = X.id` OR `spouseId = X.id`), keep rows with `familyId` set; those `familyId`s are the families. Alternatively load all `GedcomFamily` for `fileUuid` and filter by `husbandId`/`wifeId`; using GedcomSpouse is consistent with `loadSpouseMap` and can include `familyId` in the same query.

---

## 2. Alignment with Descendancy API

### 2.1 Resolution and normalization

- **File scope:** Use `resolveTreeFileUuid()` from `lib/tree.ts` once; use returned `fileUuid` in **every** Prisma query (all GEDCOM tables use `fileUuid`).
- **Xref normalization:** Use the same `normalizeXref(xref)` as descendancy (trim, add `@` if missing) so that `person=@I123@` and `person=I123` both resolve.

### 2.2 Reused helpers

- **loadParentChildMaps(fileUuid)** — returns `{ childToParents, parentToChildren }`. Used for recursion via `getDescendantIds`. Note: it does **not** expose `familyId`; for “unions where P is a child” and “family → children” we do separate queries (see below).
- **loadSpouseMap(fileUuid)** — returns `Map<individualId, Set<spouseId>>`. Used by `getDescendantIds` to include spouses. For “other families of X/Y” we need family IDs: either query **GedcomSpouse** with `individualId = X.id` (and `familyId` not null), or derive from **GedcomFamily** by husbandId/wifeId.
- **getDescendantIds(startId, parentToChildren, maxDepth, spouseMap)** — returns `Map<depth, Set<id>>`. Call once per “root” we want to recurse from (e.g. each child of the birth union, each child of X’s other families, each child of Y’s other families).

### 2.3 Family → children map

- Descendancy builds **familyToChildIds** from `prisma.gedcomParentChild.findMany({ where: { fileUuid }, select: { familyId: true, childId: true } })` and dedupes by `childId` per family (only adds when `r.familyId` is present). Sibling-view should do the **same** (same query or reuse the same batch used for other steps) so union children lists match.

### 2.4 Response shape (same as descendancy)

- **rootId:** xref of the chosen root (e.g. birth father X).
- **rootUuid:** id of that individual.
- **people:** Array of `{ id, uuid, firstName, lastName, birthYear, deathYear, ... }` (same as descendancy; `id` is xref, `uuid` is GedcomIndividual.id). Use `mapIndividualRow` + same `INDIVIDUAL_SELECT` and `getYearFromDateString` as descendancy.
- **unions:** Array of `{ id, uuid, husb, wife, children }` where `id` is family xref, `uuid` is family id, `husb`/`wife` are xrefs, `children` is `[{ id: childXref, pedi: "birth" | ... }]`. Match descendancy structure so the chart can consume it without change.

---

## 3. Route and Parameters

- **Route:** `GET /api/tree/sibling-view?person=<xref>&depth=<n>` (same pattern as descendancy: `root` → person, `depth` → max recursion depth).
- **Parameters:**
  - `person` — required; individual xref (e.g. `@I123@`). Resolve with `fileUuid` and `normalizeXref(person)`.
  - `depth` — optional; default 10; cap e.g. 1–20 like descendancy.

---

## 4. Algorithm (steps)

1. **Resolve fileUuid** — `resolveTreeFileUuid()`; 404 if null.
2. **Resolve P** — `prisma.gedcomIndividual.findFirst({ where: { fileUuid, xref: normalizeXref(person) }, select: { id: true, xref: true } })`; 404 if not found.
3. **Unions where P is a child** — `prisma.gedcomParentChild.findMany({ where: { fileUuid, childId: P.id }, select: { familyId: true, pedigree: true } })`. Filter to rows where `familyId != null`. Unique `familyId`s = list of unions; use `pedigree === 'birth'` (or equivalent) to pick **birth union U**. If multiple families, one is U (X, Y); others are “other unions where P is child” (children only, no recursion).
4. **Load maps** — Same batch as descendancy where useful: `loadParentChildMaps(fileUuid)`, `loadSpouseMap(fileUuid)`. Also need **family → children**: same as descendancy, from `GedcomParentChild` with `fileUuid`, select `familyId`, `childId`, build `familyToChildIds` (only when `familyId` present).
5. **Birth union U** — Get X, Y from U (GedcomFamily: husbandId/wifeId or husbandXref/wifeXref). For each **child of U**, call `getDescendantIds(childId, parentToChildren, maxDepth, spouseMap)` and collect all descendant (and spouse) ids. Include U, X, Y, and all children of U in the people/union sets.
6. **X’s other families** — Families where X is spouse and family ≠ U: e.g. `GedcomSpouse.findMany({ where: { fileUuid, individualId: X.id }, select: { familyId: true } })` plus same for `spouseId: X.id`, then filter out U.id. For each such family, recurse from each of its children (same as step 5).
7. **Y’s other families** — Same as step 6 for Y.
8. **Other unions where P is child** — For each union in the list from step 3 that is not U: add that union and its **children only** (no recursion). I.e. union + people for that union’s husband, wife, children; do not call `getDescendantIds` for those children.
9. **Build response** — Collect all people ids and union ids; fetch individuals with same `INDIVIDUAL_SELECT` as descendancy; build `people` and `unions` arrays in the same shape as descendancy. Set `rootId`/`rootUuid` to X (birth father) so the chart can render with X as root.

---

## 5. Edge cases and notes

- **P has no parents / no birth union:** If there are no `GedcomParentChild` rows with `childId = P.id` and `familyId` set, return an empty or minimal payload (e.g. only P), or 404/400 depending on product choice.
- **Pedigree values:** Schema stores `pedigree` as text; GEDCOM uses values like `birth`, `adopted`, etc. Use case-insensitive or canonical `birth` to pick the birth union; document the convention.
- **Consistency with descendancy:** Use the same `familyToChildIds` source (GedcomParentChild, deduped) and same response shape so the frontend can use one parsing path for both descendancy and sibling-view.
- **Caching:** `loadParentChildMaps` and `loadSpouseMap` are already cached per fileUuid in `tree-cache`; sibling-view will benefit from that.

---

## 6. Implementation checklist (when coding)

- [ ] Add route `GET /api/tree/sibling-view` with `person` and `depth` query params.
- [ ] Use `resolveTreeFileUuid()` and `normalizeXref(person)`; resolve P by (fileUuid, xref).
- [ ] Query GedcomParentChild for childId = P.id; filter familyId not null; identify birth union by pedigree.
- [ ] Reuse loadParentChildMaps, loadSpouseMap; build familyToChildIds from GedcomParentChild (same as descendancy).
- [ ] Get X, Y from birth union (GedcomFamily by U.id).
- [ ] For birth union: recurse from each child via getDescendantIds; include U, X, Y, children in result.
- [ ] For X’s other families (via GedcomSpouse or GedcomFamily): recurse from each child.
- [ ] For Y’s other families: same.
- [ ] For other unions where P is child: add union + children only, no recursion.
- [ ] Fetch all involved individuals; build people/unions with mapIndividualRow and same shape as descendancy; return rootId = X.xref, rootUuid = X.id.
