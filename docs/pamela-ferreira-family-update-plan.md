# Database Update Plan: Pamela Gonsalves (@I0143@) — Marriage & Family

This document describes all database changes required to record Pamela Gonsalves’s marriage to Joseph Ferreira, their two children, and the associated events (marriage, births) with dates and places. **No code is included; this is a specification only.**

---

## Context

- **Existing individual:** Pamela Gonsalves, xref `@I0143@`, born 5 NOV 1987, Georgetown, Guyana; living.
- **Goal:** Add her married name (Pamela Ferreira), create her spouse (Joseph Ferreira, with birth 7 APR 1987 in Richmond, California), create their two children, create one family record, and create events with dates and places for marriage and all births (including Joseph’s birth event).
- **Important:** The the-gonsalves-family app uses a **read-only** database user. These changes require **write access** (e.g. the main Ligneous application or a write-capable database user).

---

## 1. Update Pamela Gonsalves (@I0143@)

### 1.1 Married name

- Add a **second name form** for Pamela so she is also known as **Pamela Ferreira** (married name).
- **Table: GedcomIndividualNameForm**
  - Insert one row: `individualId` = Pamela’s UUID, `nameType` = `"married"` (or equivalent), `isPrimary` = false, `sortOrder` as needed.
- **Tables: GedcomNameFormGivenName, GedcomNameFormSurname** (and related)
  - Link this name form to:
    - Given name: **Pamela** (use existing GedcomGivenName for this file if it exists).
    - Surname: **Ferreira** (use existing GedcomSurname for this file, or create and link).
- **Optional:** Update `GedcomIndividual.fullName` / `fullNameLower` for Pamela to reflect married name for display, or leave as birth name and rely on name forms.

### 1.2 Flags

- **Table: GedcomIndividual**
  - On Pamela’s row: set `hasSpouse` = true, `hasChildren` = true.

---

## 2. Create Joseph Ferreira (new individual)

- **Table: GedcomIndividual**
  - Insert one row:
    - `fileUuid` = same as the Gonsalves tree file.
    - `xref` = new unique xref (e.g. `@I0XXX@`); must not duplicate any existing xref in this file.
    - `fullName` = e.g. `"Joseph /Ferreira/"`; `fullNameLower` = normalized equivalent.
    - `sex` = M.
    - `isLiving` = true.
    - `hasSpouse` = true, `hasChildren` = true.
    - `birthDateDisplay` = **"7 APR 1987"**; `birthDateId` = **required** — set to the Joseph birth date id (create the date in section 7 first).
    - `birthPlaceDisplay` = **"Richmond, California"**; `birthPlaceId` = **required** — set to the Richmond, California place id (create the place in section 6 first).
- **Name**
  - One **GedcomIndividualNameForm** (e.g. `nameType` = `"birth"`, `isPrimary` = true) with given name **Joseph** and surname **Ferreira**, using GedcomGivenName / GedcomSurname and the name-form junction tables (GedcomNameFormGivenName, GedcomNameFormSurname).

---

## 3. Create Olivia Paige Ferreira (new individual)

- **Table: GedcomIndividual**
  - Insert one row:
    - Same `fileUuid`.
    - New unique xref (e.g. `@I0XXX@`).
    - `fullName` = e.g. `"Olivia Paige /Ferreira/"`.
    - `sex` = F.
    - `isLiving` = true.
    - `birthDateDisplay` = **"9 MAR 2019"**; `birthDateId` = **required** — set to the Olivia birth date id (create the date in section 7 first).
    - `birthPlaceDisplay` = **"Walnut Creek, California"**; `birthPlaceId` = **required** — set to the Walnut Creek, California place id (create the place in section 6 first).
    - `hasParents` = true.
- **Name**
  - One name form: given names **Olivia**, **Paige**; surname **Ferreira** (via GedcomGivenName, GedcomSurname, and junction tables).

---

## 4. Create Lucas Peter Gonsalves (new individual)

- **Table: GedcomIndividual**
  - Insert one row:
    - Same `fileUuid`.
    - New unique xref (e.g. `@I0XXX@`).
    - `fullName` = e.g. `"Lucas Peter /Gonsalves/"`.
    - `sex` = M.
    - `isLiving` = true.
    - `birthDateDisplay` = **"26 NOV 2020"**; `birthDateId` = **required** — set to the Lucas birth date id (create the date in section 7 first).
    - `birthPlaceDisplay` = **"Walnut Creek, California"**; `birthPlaceId` = **required** — set to the Walnut Creek, California place id (create the place in section 6 first).
    - `hasParents` = true.
- **Name**
  - One name form: given names **Lucas**, **Peter**; surname **Gonsalves** (via GedcomGivenName, GedcomSurname, and junction tables).

---

## 5. Create the family (Pamela + Joseph)

- **Table: GedcomFamily**
  - Insert one row:
    - Same `fileUuid`.
    - New unique family xref (e.g. `@F0XXX@`).
    - `husbandId` = Joseph’s individual UUID; `husbandXref` = Joseph’s xref.
    - `wifeId` = Pamela’s individual UUID; `wifeXref` = `@I0143@`.
    - `marriageDateDisplay` = **"29 APR 2017"** (and `marriageDateId` after section 7).
    - `marriagePlaceDisplay` = **"Brentwood, California"** (and `marriagePlaceId` after section 6).
    - `childrenCount` = 2.
    - `isDivorced` = false.

---

## 6. Create places

- **Table: GedcomPlace**
  - Insert **three** rows (same `fileUuid`):
    1. **Brentwood, California** — for marriage. Set at least `original` = `"Brentwood, California"`; optionally `name`, `state` = `"California"`, `country` = `"USA"` (or equivalent).
    2. **Walnut Creek, California** — for both children’s births. Set at least `original` = `"Walnut Creek, California"`; optionally `name`, `state` = `"California"`, `country` = `"USA"`.
    3. **Richmond, California** — for Joseph’s birth. Set at least `original` = `"Richmond, California"`; optionally `name`, `state` = `"California"`, `country` = `"USA"`.

Use these place IDs when setting `marriagePlaceId`, `birthPlaceId`, and event `placeId` below.

---

## 7. Create dates

- **Table: GedcomDate**
  - Insert **four** rows (same `fileUuid`):
    1. **Marriage:** 29 APR 2017 — e.g. `year` = 2017, `month` = 4, `day` = 29, `dateType` = EXACT (or schema equivalent).
    2. **Joseph birth:** 7 APR 1987 — e.g. `year` = 1987, `month` = 4, `day` = 7.
    3. **Olivia birth:** 9 MAR 2019 — e.g. `year` = 2019, `month` = 3, `day` = 9.
    4. **Lucas birth:** 26 NOV 2020 — e.g. `year` = 2020, `month` = 11, `day` = 26.

Use these date IDs when setting `marriageDateId`, `birthDateId`, and event `dateId` below.

---

## 8. Create events (marriage and births)

- **Table: GedcomEvent**
  - Insert **four** rows (same `fileUuid`):
    1. **Marriage (MARR):** `eventType` = MARR, `dateId` = marriage date id, `placeId` = Brentwood, California place id.
    2. **Joseph birth (BIRT):** `eventType` = BIRT, `dateId` = Joseph birth date id, `placeId` = Richmond, California place id.
    3. **Olivia birth (BIRT):** `eventType` = BIRT, `dateId` = Olivia birth date id, `placeId` = Walnut Creek, California place id.
    4. **Lucas birth (BIRT):** `eventType` = BIRT, `dateId` = Lucas birth date id, `placeId` = Walnut Creek, California place id.

Set any other required fields (e.g. `sortOrder`).

---

## 9. Link family and individuals to events

- **Table: GedcomFamilyEvent**
  - Insert **one** row: `familyId` = new family id, `eventId` = marriage (MARR) event id (plus `fileUuid` if required).

- **Table: GedcomIndividualEvent**
  - Insert **three** rows:
    - Joseph’s individual id ↔ Joseph’s birth (BIRT) event id.
    - Olivia’s individual id ↔ Olivia’s birth (BIRT) event id.
    - Lucas’s individual id ↔ Lucas’s birth (BIRT) event id.
  - Include `fileUuid` if required.

---

## 10. Link family to children

- **Table: GedcomFamilyChild**
  - Insert **two** rows:
    - One: `familyId` = new family, `childId` = Olivia’s id, `childXref` = Olivia’s xref, `birthOrder` = 1.
    - One: `familyId` = new family, `childId` = Lucas’s id, `childXref` = Lucas’s xref, `birthOrder` = 2.

---

## 11. Link parents to children

- **Table: GedcomParentChild**
  - Insert **four** rows (each with `familyId` = new family, and `relationshipType` as per schema, e.g. biological):
    - Joseph → Olivia (e.g. `parentType` = father or equivalent).
    - Pamela → Olivia (e.g. `parentType` = mother).
    - Joseph → Lucas.
    - Pamela → Lucas.

---

## 12. Link spouses

- **Table: GedcomSpouse**
  - Insert **two** rows:
    - One: `individualId` = Joseph, `spouseId` = Pamela, `familyId` = new family.
    - One: `individualId` = Pamela, `spouseId` = Joseph, `familyId` = new family.

---

## 13. Optional: set date/place IDs on family (if not set at creation)

- **GedcomFamily:** set `marriageDateId` to the marriage date id, `marriagePlaceId` to the Brentwood, California place id (if not already set in step 5).

**Note:** For individuals, `birthDateId` and `birthPlaceId` are **required** (not optional). Joseph, Olivia, and Lucas must have these set when they are created in steps 2–4, using the date and place ids from steps 6 and 7. No follow-up update is needed for their birth date/place ids.

---

## Summary: what we have to do

| # | Action | Table(s) | Count |
|---|--------|----------|--------|
| 1 | Update Pamela: married name + flags | GedcomIndividual, GedcomIndividualNameForm, name-form junction tables | 1 individual updated, 1 name form + links |
| 2 | Create Joseph | GedcomIndividual, GedcomIndividualNameForm, junction tables | 1 individual, 1 name form + links |
| 3 | Create Olivia | GedcomIndividual, name form + links | 1 individual, 1 name form + links |
| 4 | Create Lucas | GedcomIndividual, name form + links | 1 individual, 1 name form + links |
| 5 | Create family (Pamela + Joseph) | GedcomFamily | 1 family |
| 6 | Create places | GedcomPlace | 3 (Brentwood CA, Walnut Creek CA, Richmond CA) |
| 7 | Create dates | GedcomDate | 4 (marriage, Joseph birth, Olivia birth, Lucas birth) |
| 8 | Create events | GedcomEvent | 4 (MARR, BIRT Joseph, BIRT Olivia, BIRT Lucas) |
| 9 | Link events to family/individuals | GedcomFamilyEvent, GedcomIndividualEvent | 1 + 3 rows |
| 10 | Link family to children | GedcomFamilyChild | 2 rows |
| 11 | Link parents to children | GedcomParentChild | 4 rows |
| 12 | Link spouses | GedcomSpouse | 2 rows |
| 13 | Set date/place IDs on family and individuals | GedcomFamily, GedcomIndividual | optional consistency |

**Execution order (required):**  
1 → **6 (places)** → **7 (dates)** → 2, 3, 4 (individuals, with `birthDateId` and `birthPlaceId` set from 6 & 7) → 5 (family) → 8 (events) → 9 (event links) → 10, 11, 12 (family-child, parent-child, spouses) → 13 if needed (family marriage date/place ids).

**Why:** `birthDateId` and `birthPlaceId` are **required** on GedcomIndividual (not optional). New individuals must have valid date and place ids at creation, so places and dates must exist before creating Joseph, Olivia, and Lucas.

---

## Data reference (quick copy)

| Item | Value |
|------|--------|
| Pamela xref | @I0143@ |
| Marriage date | 29 APR 2017 |
| Marriage place | Brentwood, California |
| Joseph birth | 7 APR 1987, Richmond, California |
| Olivia birth | 9 MAR 2019, Walnut Creek, California |
| Lucas birth | 26 NOV 2020, Walnut Creek, California |
| Joseph | Joseph Ferreira (new) |
| Olivia | Olivia Paige Ferreira (new) |
| Lucas | Lucas Peter Gonsalves (new) |

No coding is to be done until you approve this plan or request changes.
