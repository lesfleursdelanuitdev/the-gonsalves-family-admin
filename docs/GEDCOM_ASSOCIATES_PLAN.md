# GEDCOM 5.5 Associates (ASSO) — Implementation Plan

This document describes how **GEDCOM 5.5 associations** map to our stack and proposes phased work across **Prisma**, **`gedcom-go`** (core library), and **`the-gonsalves-family-admin`**. It is a planning artifact only; implementation should follow the workspace **API thin shell** rule (business logic and persistence in the core library, API as HTTP routing + formatting).

---

## 1. What the standard defines

### 1.1 `ASSOCIATION_STRUCTURE` (GEDCOM 5.5 lineage-linked)

Under records that allow it (including **`INDI`**), the structure is:

| Line | Tag | Cardinality | Role |
|------|-----|----------------|------|
| `n` | `ASSO` | `{0:M}` | Pointer to the **associated entity** (the associate). |
| `n+1` | `TYPE` | `{1:1}` | **`RECORD_TYPE`**: `[ FAM \| INDI \| NOTE \| OBJE \| REPO \| SOUR \| SUBM \| SUBN ]` — identifies **what kind of record** the `ASSO` pointer references when it is not only another person. |
| `n+1` | `RELA` | `{1:1}` | **`RELATION_IS_DESCRIPTOR`** — short text: how the **subject** of the enclosing record relates to the associate (e.g. godfather, neighbor, witness). User-facing descriptive text, not a closed vocabulary in the standard. |
| `n+1` | `<<NOTE_STRUCTURE>>` | `{0:M}` | Optional notes on this association. |
| `n+1` | `<<SOURCE_CITATION>>` | `{0:M}` | Optional source citations on this association. |

The standard illustrates associations beyond **INDI→INDI**, for example:

- **`INDI`** with **`ASSO @F1@`**, **`TYPE FAM`**, **`RELA`** describing the role (e.g. witness at marriage).
- **`INDI`** with **`ASSO @SUBM@`**, **`RELA`** text.

**Intent:** **`ASSO`** is for relationships **not** expressed by normal lineage links. Parent/child/spouse topology belongs in **`FAMC` / `FAMS` / `FAM`**, not replaced by associates.

### 1.2 Event-level `ASSO`

In real GEDCOM files, **`ASSO`** may appear **under an event** (e.g. under **`BIRT`**) with **`RELA`** (e.g. witness). That is **semantically different** from an **`INDI`-level** association: the owner context is the **event**, not only the person record.

The repo’s **`ligneous-gedcom-lib`** already models enriched **`AssociateEdge`** semantics (including event-scoped associations) in parse/enrich/export tests; persistence in Postgres is the gap.

---

## 2. Current state

### 2.1 Prisma (`packages/ligneous-prisma/prisma/schema.prisma`)

**`GedcomIndividual`** includes families, parents/children, spouses, events, notes, sources, media, etc. There is **no** table for **`ASSO`** edges at individual or event level.

### 2.2 Core / GEDCOM library

**`ligneous-gedcom-lib`** (see `gonsalves-genealogy/ligneous-gedcom-lib`) already:

- Extracts **`ASSO` / `RELA`** in JSON export paths (`Associates` on individuals).
- Validates **`ASSO`** targets (e.g. xref existence, **`RELA`** warnings).
- Exports **`ASSO`/`RELA`** from enriched documents.

**`gedcom-go`** (per workspace rules at `/apps/temp-family-tree-code/gedcom-go`) must own **database-backed** queries, import/export from storage, and graph updates—**not** the admin API handlers.

### 2.3 Admin UI

The individual editor (`IndividualEditForm` / person editor nav) has **no** “Associates” section today.

---

## 3. Target architecture

### 3.1 Data model (conceptual)

Introduce a persisted association edge with at minimum:

- **Subject:** one **`GedcomIndividual`** (owner INDI).
- **Relationship text:** maps to **`RELA`**.
- **Target:** MVP can be **another individual only** (`TYPE INDI` implicit); full 5.5 adds **`TYPE`** + polymorphic target (**`FAM`**, **`SUBM`**, …).
- **Scope:** **record-level** (under person) vs **event-level** (optional later): e.g. `context = individual_record | individual_event` + optional **`event_id`** FK.

Optional parity fields:

- Links to **notes** / **source citations** mirroring **`<<NOTE_STRUCTURE>>`** / **`<<SOURCE_CITATION>>`** under **`ASSO`**.

**Constraints (to decide in implementation):**

- Uniqueness: allow duplicate subject→target with **different** **`RELA`**, or enforce one row per pair—product decision.
- **Delete behavior:** cascade or block when associate **`GedcomIndividual`** is deleted.

### 3.2 API surface

- Admin REST routes under `/api/admin/...` for CRUD on associations **by individual id**, implemented as thin handlers calling **`gedcom-go`** (or shared library used by both CLI and API).

### 3.3 Import / export

- **Import:** map parsed **`ASSO`** edges into new tables; resolve xrefs to internal UUIDs.
- **Export:** emit **`ASSO`**, **`TYPE`** when required, **`RELA`**, optional NOTE/SOUR—matching the chosen phase scope.

---

## 4. Phased delivery

| Phase | Scope | Prisma | Library | Admin UI |
|-------|--------|--------|---------|----------|
| **1 — MVP** | **INDI → INDI** only, **record-level** **`ASSO`**; **`RELA`** required in UI | Junction table: subject `individual_id`, associate `individual_id`, `rela`, `file_uuid`, timestamps | Import/export + list/create/update/delete in **`gedcom-go`** | New **Associates** section on individual **edit** + **view**; picker for existing person; create flow: save person first or defer |
| **2** | **`TYPE`** + non-INDI targets (**`FAM`**, **`SUBM`**, …) | Polymorphic FKs or `(target_type, target_id)` pattern consistent with xref rules | Extend import/export | Form fields for **type** + entity picker by type |
| **3** | **Event-scoped** **`ASSO`** | Associate rows keyed by **`individual_event_id`** (or equivalent) | Map event subtree **`ASSO`** | Surface under relevant event in individual timeline / event editor |
| **4** | Full structure parity | Optional join rows for notes/sources under an association | Emit/consume NOTE/SOUR under **`ASSO`** | Optional citation UI |

---

## 5. Admin UI checklist (`the-gonsalves-family-admin`)

- [ ] Add **`person-associates`** (or similar) to **`PERSON_EDITOR_NAV`** / **`PersonEditorSectionId`**.
- [ ] New section in **`IndividualEditForm`**: list associates (link to other individual, **`RELA`** label, remove).
- [ ] Add associate: **IndividualSearchPicker** (or existing pattern) + **`RELA`** input; validate non-empty **`RELA`** for MVP.
- [ ] Individual **profile** page: read-only list of associates.
- [ ] Empty states and copy clarifying **non-lineage** links (godparent, neighbor, duplicate-record hint, etc.).
- [ ] **Create individual** mode: same pattern as other features—no associate targets until a persisted **`individualId`** exists.

---

## 6. Prisma / migration checklist

- [ ] Design **`GedcomIndividualAssociation`** (name TBD) model + indexes + `@@map`.
- [ ] Migration + backfill strategy (likely **none** for legacy rows until re-import or one-off script).
- [ ] Relation hooks from **`GedcomIndividual`** for query ergonomics.

---

## 7. Risks and decisions

- **Bidirectionality:** GEDCOM **`ASSO`** is **directed** (from owner INDI to associate). Do **not** auto-mirror unless product explicitly wants reciprocal edges.
- **RELATION_IS_DESCRIPTOR length:** schema uses `{1:25}` in 5.5 for **`RELA`**—some files exceed this; store as **`Text`** if needed.
- **Compatibility:** exports should remain readable by other tools; prefer emitting **`TYPE`** whenever the target is not **`INDI`**.
- **Thin shell:** avoid embedding association SQL in Next.js route handlers—centralize in **`gedcom-go`**.

---

## 8. References

- GEDCOM 5.5: **`ASSOCIATION_STRUCTURE`**, **`INDI`** record definition (Appendix structures).
- In-repo: **`ligneous-gedcom-lib`** (`exporter/json.go`, `validator/validator.go`, `exporter/from_enriched_test.go` for **`ASSO`**/**`RELA`** behavior).

---

## Document history

| Date | Change |
|------|--------|
| 2026-05-04 | Initial plan from GEDCOM 5.5 spec review and schema gap analysis |
