# Individual edit form — implementation plan

This document specifies behavior and architecture for a reusable **individual create/edit** experience in `the-gonsalves-family-admin`. It is a **plan only**; implementation comes later.

**Related schema:** `packages/ligneous-prisma/prisma/schema.prisma` (`GedcomIndividual`, name forms, events, dates, places, `GedcomFamily`, `GedcomFamilyChild`, `GedcomParentChild`, `GedcomSpouse`, `UserIndividualLink`).

---

## 1. Goals

- **Reusable `IndividualEditForm`** used for **create** and **edit** (same shell, different data loading and submit targets).
- Sections (high level):
  1. **Names** — given names and surnames, ordering, name-type semantics, live **effective display name**.
  2. **Key events** — birth, death, living status (with strict event rules below).
  3. **Families** — attach this person to **existing** families **as a spouse** or **as a child** (see §6).
  4. **Link to user** (especially on **create**) — search by username, single selection, create `UserIndividualLink` when appropriate.
- **Persistence** must keep **GEDCOM-shaped tables**, **denormalized individual columns**, and **event graph** consistent.

---

## 2. Layering (API thin shell)

- **HTTP routes** in the admin app should validate auth, parse JSON, map errors to status codes.
- **Business logic** (name upserts, BIRT/DEAT upsert, date/place find-or-create, 120-year and `isLiving` computation, transactions) should live in **shared modules** under the admin app (e.g. `lib/admin-individual-*.ts`), callable from POST/PATCH handlers—mirroring how admin **events** reuse date/place helpers rather than duplicating logic in handlers.

---

## 3. Names section

### 3.1 Schema recap

- **`GedcomIndividualNameForm`** — one logical “NAME” bundle per person: `nameType` (e.g. birth, married, maiden), `isPrimary`, `sortOrder`, unique on `(fileUuid, individualId, nameType)`.
- **`GedcomNameFormGivenName`** — links a name form to **`GedcomGivenName`** with **`position`** (order of given-name pieces).
- **`GedcomNameFormSurname`** — links to **`GedcomSurname`** with **`position`** (order of surname pieces).
- **Catalog rows** `GedcomGivenName` / `GedcomSurname` are per-**file**, deduplicated by normalized text—not owned directly by the individual.

### 3.2 UI (target)

- **Top of section:** **Effective display name** — string derived from current form state (same conventions as list/detail views: primary form, ordered given + surnames, slash stripping, fallbacks). Updates on every relevant change (client state).
- **Subsection: Given names** — list, **add**, **reorder** (maps to `position`).
- **Subsection: Last names** — list, **add**, **reorder**; **maiden / married / …** must map to schema:
  - **Preferred v1:** treat **name “kind”** as **`GedcomIndividualNameForm.nameType`** (multiple forms: birth, married, maiden, etc.), not a per-surname enum on the junction—unless we add a future migration for `GedcomNameFormSurname.role`.
- **Save strategy:** define whether v1 allows **only** `birth` or **multiple** `nameType` rows in the first release; document in implementation tickets.

### 3.3 Create vs edit

- **Edit:** load `individualNameForms` with nested junctions and catalog text.
- **Create:** default one name form (e.g. `nameType: birth`, `isPrimary: true`); empty or placeholder given/surname rows as needed.

---

## 4. Key events: birth and death

### 4.1 Strict “one BIRT / one DEAT per person” rule

**Invariant (per `fileUuid` + `individualId`):**

- At most **one** `GedcomEvent` of type **`BIRT`** linked to that individual via **`GedcomIndividualEvent`** (principal role).
- At most **one** `GedcomEvent` of type **`DEAT`** under the same conditions.

**Upsert behavior on save:**

1. Resolve the individual’s `fileUuid` and `id`.
2. For **BIRT** (and separately **DEAT**):
   - **Find** an existing event: join `gedcom_individual_events_v2` → `gedcom_events_v2` where `individual_id` matches, `event_type` is `BIRT` or `DEAT`, and `file_uuid` matches.
   - If **found:** **update** that event’s `date_id`, `place_id`, and any other fields; do **not** create a second row.
   - If **not found:** **create** `GedcomEvent` + **`GedcomIndividualEvent`** row.
3. If the user **clears** birth or death in the UI:
   - Clear the corresponding **individual** FKs and display fields (see §4.2).
   - **Policy for the event row:** either **delete** the BIRT/DEAT event (and junction) when fully cleared, or **null** date/place on the event—pick one and apply consistently; prefer **delete** orphan BIRT/DEAT with no date/place/value if product allows empty events to be removed.

**Legacy data:** if duplicates already exist (pre-rule), a **one-time repair** script or admin tool can merge/delete extras; out of scope for the form MVP but worth a follow-up ticket.

### 4.2 Individual denormalized fields (must stay in sync)

`GedcomIndividual` carries **both** FKs and **display / search** fields:

- Birth: `birthDateId`, `birthPlaceId`, `birthDateDisplay`, `birthPlaceDisplay`, `birthYear`, …
- Death: `deathDateId`, `deathPlaceId`, `deathDateDisplay`, `deathPlaceDisplay`, `deathYear`, …

**On every successful birth/death save:**

- Update **`GedcomDate` / `GedcomPlace`** via the same **find-or-create** approach as admin **event** create/patch (hash-based dedupe per file).
- Point the **BIRT/DEAT event** at those ids.
- **Recompute and write** the individual’s denormalized birth/death fields from the resolved date/place records (and/or structured form input) so lists, timelines, and SQL that rely on `birth_year` / `death_year` stay correct.

### 4.3 UI parity with event editor

- Birth and death blocks should reuse the **same conceptual model** as `EventForm`: date specifier, structured Y/M/D, range where applicable, place fields, optional original text.
- **Implementation plan:** factor shared **date/place payload → persist** helpers used by both **events** and **individual key facts** (single module, two call sites).

---

## 5. Living status

### 5.1 Stored field

- **`GedcomIndividual.isLiving`** is the persisted boolean the rest of the app reads.

### 5.2 Inputs (conceptual)

1. **Death signal** — presence of a **DEAT** event (or linked death date / denormalized death year—define one canonical “death known” predicate aligned with §4).
2. **120-year rule** — automatic inference when death is unknown (see §5.3).
3. **Manual override** — user can force living / deceased (or “automatic” mode that recomputes on save—product choice).

**Precedence (recommended):**

1. If **manual override** is **living** or **deceased** (not “auto”), persist that value and **do not** overwrite with automation on save—**or** only recompute when in “auto”; document the chosen UX.
2. Else if **death is known** → `isLiving = false`.
3. Else apply **§5.3 120-year rule** → if triggered, `isLiving = false`.
4. Else → `isLiving = true`.

### 5.3 120-year rule — typical algorithm

**Reference date:** **UTC calendar date** for “today” at save time (`YYYY-MM-DD` in UTC). Using UTC keeps behavior reproducible across servers; if the product later needs a specific timezone, switch the reference to that zone explicitly in code and update this doc.

**Death known:** Use the same predicate as for §5.2 step 2 (e.g. `deathDateId` set, or `DEAT` event with a non-null date link, or `deathYear` not null—**pick one canonical source** in implementation to avoid drift).

**Birth data:** Read structured birth from the **primary birth date record** attached to the individual (or to the BIRT event after sync)—`year`, `month`, `day` nullable integers.

**Algorithm (automatic inference only; skipped if death known or manual override applies):**

1. Let `Y`, `M`, `D` be birth year / month / day (each nullable).
2. If **`Y` is null:** **cannot** infer from age → treat as **living** for this rule (no change from 120-year branch).
3. If **`Y`, `M`, and `D` are all set:**  
   Compute **age in completed years** on the reference date using the usual birthday rule (if birthday has not yet occurred this year, age is previous year’s count).  
   **If age ≥ 120 → inferred deceased** (`isLiving = false`). **Else living** for this branch.
4. If **`Y` and `M` set, `D` missing:**  
   Use **day 1** of that month as the birth date for the same age calculation (documented conservative choice). Then same **≥ 120** test.
5. If **only `Y` set** (year-only birth):  
   Use the **simple year gap** used in many genealogy systems:  
   `referenceYear - Y >= 120` → **inferred deceased**;  
   `referenceYear - Y < 120` → not inferred deceased by this rule.  
   (This avoids false “deceased” when the 120th birthday has not yet occurred in the reference year but we lack month/day—at the cost of marking some year-only centenarians a year early; acceptable for a **privacy-style** default.)

**Rounding:** All comparisons use integers; no floating-point ages.

**UI:** Show the user how `isLiving` was derived when in **auto** mode (e.g. “Inferred deceased: birth more than 120 years ago” / “Death recorded” / “Manual”).

---

## 6. Families — spouse vs child (existing families only)

### 6.1 Scope (v1)

- **Only existing families** may be attached. **No** “create new family from this form” in the first release (defer to a dedicated family editor or a later iteration).
- Each attachment is **search → pick from results → chip in list**, same **interaction model** as linking records on **notes** and **events**.

### 6.2 UI pattern (reuse)

- Reuse **`NoteLinkedRecordsPicker`** (or a thin wrapper) with **`allowedLinkKinds={["family"]}`** so the experience matches **note** and **event** linking: independent search blocks, partner name filters for family scope, result rows, selected chips with remove.
- Split into **two** subsections so intent is unambiguous:
  1. **Families as spouse** — families where this person should appear as **husband** or **wife** on `GedcomFamily`.
  2. **Families as child** — families where this person should appear as a **child** via **`GedcomFamilyChild`** (and related parent–child graph). For each family added here, the user must be able to set **pedigree / relationship type** (e.g. birth/biological, adopted, foster, step, sealing—aligned with **`lib/pedigree-display.ts`**) and optionally **custom pedigree text** (maps to **`GedcomParentChild.pedigree`** when non-empty). UX pattern: after picking a family (same search UI as notes/events), show a **row** or **expanded chip** with a **select** (and optional text field), not merely a bare chip.

Each subsection maintains its **own** list of selected families (separate state / separate chip lists); the same family could theoretically appear in both lists only if the data model allows it (usually avoided; **implementation should reject** duplicate family id across the two lists on save with a clear error, or filter the second picker—product choice).

### 6.3 Schema behavior — spouse

- **`GedcomFamily`** has optional **`husbandId`** and **`wifeId`** (same `fileUuid` as the individual).
- **Assigning this person as a spouse** means updating **one** of those FKs to the current individual’s id (and clearing/replacing policy if a slot is already taken—see below).
- **`GedcomSpouse`** rows (and any denormalized flags such as **`hasSpouse`** on **`GedcomIndividual`**) must stay **consistent** with whatever the rest of the admin app and import pipeline expect—**centralize** updates in the same **lib** used by other family/individual mutations so behavior matches **family detail** and **individual detail** pages.

**Slot rules (must be specified in implementation):**

- If the chosen family has **both** partners set and **neither** is this person → **reject** with a clear message (“Family already has two partners”).
- If **one** slot is empty → assign this person to the empty role **or** let the user choose **husband** vs **wife** when both slots are empty.
- If this person is **already** one of the partners → no-op for that family.
- Replacing an existing partner from the individual form is **out of scope for v1** unless explicitly added (prefer editing the **family** record to change partners).

### 6.4 Schema behavior — child

- **`GedcomFamilyChild`** links **`familyId`** + **`childId`** (unique per `fileUuid`, family, child). Optional **`birthOrder`**, **`childXref`**. It does **not** store pedigree type; that lives on **`GedcomParentChild`**.
- **`GedcomParentChild`** links **each parent** to **each child** with optional **`familyId`**, **`relationshipType`** (string, default **`biological`** in schema), and optional **`pedigree`** (free-text GEDCOM-style or UI label). This is where **birth vs adopted vs foster vs step**, etc., are persisted **per parent–child edge** (two rows per child in a two-parent family when both parents are in the tree).

**Pedigree / relationship when adding “as child”:**

- On save, for each selected **family + child** link:
  1. Upsert **`GedcomFamilyChild`** as today.
  2. For **each parent** currently set on that family (**`husbandId`** / **`wifeId`**), upsert **`GedcomParentChild`** with **`childId`** = this individual, **`parentId`** = that parent, **`familyId`** = the family, and the user-chosen **`relationshipType`** (and optional **`pedigree`** text).
- If only **one** parent is set, only one **`GedcomParentChild`** row is required for that link; the UI still offers the same type (it applies to the link in context; document whether a second parent added later should default to the same type or `biological`).
- **Default** for new links: **`biological`** (or **`birth`**) consistent with **`formatPedigreeRelationship`** in **`lib/pedigree-display.ts`** so family detail and individual pages show **Birth**, **Adopted**, etc., predictably.

The individual edit save path must **align** with how **`GET /api/admin/families/[id]`** and **`GET /api/admin/individuals/[id]`** build trees today (merge of `familyChildren` vs `parentChildRels` if applicable)—**do not** write only one junction if the app expects both; follow existing **`lib/admin-family-children-merge`** (or equivalent) semantics.

**Rules:**

- **Reject** adding the same child twice to the same family (unique constraint).
- Validate **`fileUuid`** matches the admin tree for both individual and family.
- When **editing** an existing child link, changing the pedigree control updates **`relationshipType` / `pedigree`** on the relevant **`GedcomParentChild`** rows (both parents if two exist), unless a future enhancement allows per-parent types in the UI.

### 6.5 API shape (conceptual)

- Either extend **PATCH individual** with structured payloads:
  - `familiesAsSpouse: { familyId: string; role: "husband" | "wife" }[]` (minimal), and/or **add/remove** ids with explicit operations.
  - `familiesAsChild: { familyId: string; birthOrder?: number | null; relationshipType: string; pedigree?: string | null }[]`  
    (`relationshipType` uses the same vocabulary as elsewhere—e.g. `biological`, `adopted`, `foster`, `step`, `sealing`, `birth`—with server validation against an allowlist.)
- Or dedicated endpoints: **`POST/DELETE .../individuals/[id]/families-as-spouse`** and **`.../families-as-child`** for clearer semantics.

**Server:** validate ids belong to the admin file, apply spouse/child rules, run in a **transaction** with the rest of the individual save (if combined) or independently (if split endpoints).

### 6.6 Edit vs create

- **Edit:** preload chips from current data (families where this id is husband/wife; families where this id appears in `familyChildren` / child relations). For **child** links, preload **relationship type** (and **pedigree** text if present) from **`parentChildRels`** for that child in that family—use a **single** display value when both parents share the same type (common case); if parents differ, show a warning or “mixed” until unified editing exists. **Removing** a chip means removing **`GedcomFamilyChild`** and the **`GedcomParentChild`** rows for that child in that family (and any merge rules required by **`admin-family-children-merge`**). **Removing** a spouse chip follows spouse rules (FK / `GedcomSpouse`).
- **Create:** individual must **exist** (have an id) before spouse/child links that require FKs can be saved—either **save draft individual first** or **disable** family sections until after first successful create; document the chosen flow.

### 6.7 Cache invalidation (addition)

- Invalidate **`["admin", "families", "detail", familyId]`** and **`["admin", "families", "events", familyId]`** for every family touched, plus spouse individuals’ caches if partner slots change.

---

## 7. Link to user account (create flow)

- **UI:** “Link to user” → **Add link** → search **username** (admin-only), **single select**, confirm.
- **Schema:** `UserIndividualLink` uses `userId`, `treeId`, `individualXref` (and uniqueness on `(userId, treeId, individualXref)`).
- **Requirements:** After the individual exists with a stable **`xref`** and the admin tree’s **`treeId`** is known, insert the link. Handle duplicate / conflict errors in the UI.
- **API:** Ensure an admin **user search** endpoint (or query params on existing list) supports substring match on username with sane limits.

---

## 8. Transactions and cache invalidation

- **Transaction:** Name form writes + BIRT/DEAT upserts + individual column updates + `isLiving` + **family relationship deltas** (§6) should commit **atomically** where the database allows.
- **React Query:** After save, invalidate individual detail, individuals list, **`GET .../individuals/[id]/events`**, **affected families** (detail + family events lists), and any user-link queries for this person.

---

## 9. Routing (planned)

- **`/admin/individuals/new`** — create, embed `IndividualEditForm`.
- **`/admin/individuals/[id]/edit`** — edit, load by id, same form.
- **Individuals list** — wire “Add individual” and “Edit” to these routes (replace placeholders).

---

## 10. Implementation phases (suggested)

1. **Decisions locked:** Manual override UX for `isLiving`; clearing birth/death behavior (delete vs null event); v1 scope for multiple `nameType` forms; **spouse slot rules** (§6.3); **create-before-links** vs partial save for new individuals (§6.6).
2. **Lib:** BIRT/DEAT upsert (strict one per person), date/place sync, denormalized field recompute, 120-year + `isLiving` helper.
3. **Lib:** Family attach/detach helpers (spouse FK + `GedcomSpouse` + flags; child **`GedcomFamilyChild`** + **`GedcomParentChild`** with **`relationshipType` / `pedigree`**, aligned with existing merge semantics).
4. **API:** POST create individual, PATCH update individual (or granular routes—choose one style), including §6 payloads or sub-routes.
5. **UI:** `IndividualEditForm` — names + display preview.
6. **UI:** Key events (birth/death/living) wired to lib.
7. **UI:** **Families** — two `NoteLinkedRecordsPicker` (family-only) subsections; **child** subsection adds **relationship type + optional pedigree** per selected family; wire to API; preload on edit.
8. **UI:** User link search + create link on create.
9. **QA checklist:** duplicate BIRT/DEAT impossible; list/detail birth year matches; living flips correctly for edge dates; **family detail + individual detail** show new links; **cannot** attach to family in another file; **child pedigree** matches **`parentChildRels`** and displays like existing family children list (**Birth** / **Adopted** / …).

---

## 11. Out of scope (for this plan)

- **Creating** new families from the individual form (only **link to existing** in v1).
- Merging **legacy** duplicate BIRT/DEAT rows in existing databases.
- Changing Prisma schema for per-surname “maiden/married” flags (optional future migration).

This file should be updated when implementation choices in §5.2, §4.2 clearing policy, §3.2 name-type scope, or §6.3/§6.6 family rules are finalized.
