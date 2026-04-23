# The Gonsalves Family Admin (Project Plan)

## Goal
Create a new Next.js app: `the-gonsalves-family-admin` that provides an **administration area** for the `the-gonsalves-family` project.

Admin users must be **scoped to a single tree** (the same tree used by `the-gonsalves-family`).

Admin UI must support full CRUD on:
1. Individuals (names, events, notes, media, and user links)
2. Families (members/roles, events, notes, media)
3. User accounts and messaging (profile, login-related operations, messages)

We will prototype the UI quickly using **shadcn** components.

This document is planning-only (no coding).

---

## 1) First principles (important for “delete”)
GEDCOM data is stored using:
1) “Core” shared tables (e.g. `GedcomEvent`, `GedcomDate`, `GedcomPlace`, `GedcomMedia`, name registries, etc.)
2) “Junction” tables (e.g. `GedcomIndividualEvent`, `GedcomIndividualNote`, `GedcomFamilyEvent`, `GedcomIndividualMedia`, etc.)

Because many junction rows can point at the same shared row, **delete operations must be careful**:
- Delete a *junction row* first when removing an association (e.g. remove an event from an individual by deleting `GedcomIndividualEvent`).
- Only delete the *shared* target row (e.g. `GedcomEvent`, `GedcomDate`, `GedcomPlace`, `GedcomMedia`) when it becomes orphaned (no remaining junction rows reference it).
- If the admin workflow is “always create new objects rather than reusing existing shared ones”, deletes are simpler (we still prefer junction-first, but orphan detection is easier).

### Safety rule for delete (recommended)
Implement deletions using a two-phase strategy:
1. **Association delete**: remove from junction tables.
2. **Orphan cleanup**: check for remaining references; delete only if safe.

This should be applied consistently across:
- Individuals: `GedcomIndividualEvent`, `GedcomIndividualNote`, `GedcomIndividualMedia`, `UserIndividualLink`
- Families: `GedcomFamilyEvent`, `GedcomFamilyNote`, `GedcomFamilyMedia`, and spouse/union mapping

---

## 2) Scope model: “Admin scoped to one Tree”
We need a consistent concept of “admin is allowed to edit exactly one tree”.

### 2.1 Tree selection strategy
There should be **exactly one** tree in the admin configuration:
- Admin UI always loads and writes using that tree’s identifiers (e.g. the tree `fileId` / linked `GedcomFile`).

### 2.2 Authorization strategy (recommended)
Even if the DB user has write privileges, the app should enforce write authorization:
- Admin routes/services should require the user to have permission for this specific `Tree` resource.

Use the existing authorization primitives in the schema:
- `TreeOwner`, `TreeMaintainer`, `TreeContributor`
- `Permission` (and optionally `AccessRequest` if you want a workflow)

For an MVP, you can hard-scope the admin UI to the single tree and assume “admins are pre-approved users”.

For correctness, still check permissions in the admin backend.

---

## 3) Admin app architecture (high-level)
### 3.1 UI
shadcn-based pages:
- Login/Session gating
- Tree header (shows “Editing Tree: …”)
- Entity browsing and editing:
  - Tab: Individuals
  - Tab: Families
  - Tab: Users & Messaging

### 3.2 Editing UX (repeatable form patterns)
Use the same UI pattern for each editable “section”:
1. Left: list / search results (table)
2. Right: editor panel (or modal dialog)
3. Editor panel includes:
   - “Add” actions
   - “Edit existing” actions
   - “Delete” actions (with confirmation)

### 3.3 Validation approach
Use zod-style validation rules (or equivalent) for:
- required fields (event type, date, etc.)
- formatting constraints (e.g. xrefs, UUIDs)
- controlled vocab inputs (event types/tags) if you support standard/custom types

Even in rapid prototyping, validation prevents corrupt GEDCOM references.

---

## 4) CRUD mapping (forms + backend operations)
Below is the “what the form edits” mapped to the tables that need writes.

### 4.1 Individuals

#### A) Names
What admins edit:
- Given names (and optionally name types like birth/aka)
- Surnames

Form sections:
- Name Forms (repeatable):
  - name form type (`nameType` if applicable)
  - given names list
  - surnames list

Tables to write (typical):
- `GedcomIndividualNameForm`
- `GedcomNameFormGivenName`
- `GedcomNameFormSurname`
- If you allow new registry terms:
  - `GedcomGivenName`, `GedcomSurname` (with dedupe strategy per file)

Delete strategy:
- Delete junction rows first (`GedcomNameFormGivenName` / `GedcomNameFormSurname`).
- Remove `GedcomIndividualNameForm` if it becomes empty (optional).
- Only delete registry terms if orphaned.

#### B) Events (birth/death/other)
Form:
- Event list for the individual
- “Add event” dialog:
  - event type (standard/custom)
  - role (if your GEDCOM junction uses `role`)
  - date + date granularity
  - place
  - value/cause/agency

Tables to write:
- `GedcomIndividualEvent` (junction + role)
- `GedcomEvent` (event record)
- `GedcomDate`, `GedcomPlace` (through `GedcomEvent.dateId/placeId`)

Delete strategy:
- Delete `GedcomIndividualEvent` association.
- If the underlying `GedcomEvent` becomes orphaned (no other junction rows reference it), delete it.
- Then orphan-clean `GedcomDate` / `GedcomPlace` if needed.

#### C) Notes (per person)
Form:
- Notes list or editor (depending on your UI)
- “Add note” / “Edit note” / “Delete note”

Tables:
- `GedcomIndividualNote` (junction)
- `GedcomNote` (content + metadata)

Delete strategy:
- Delete `GedcomIndividualNote`.
- Orphan-delete `GedcomNote` if no longer referenced.

#### D) Media relating to an individual
Form:
- Media list
- “Add media” (upload or select from existing media)

Tables:
- `GedcomIndividualMedia` (junction)
- `GedcomMedia` (media object)

Delete strategy:
- Delete junction.
- Orphan-clean `GedcomMedia` if desired/appropriate.

#### E) Users linked to this individual
Form:
- List of linked users for this individual
- Link/unlink users (verified toggle)

Tables:
- `UserIndividualLink`

Delete strategy:
- Delete association row (junction).

---

### 4.2 Families

#### A) Who is in a family and what role
Form:
- For prototype, you can provide husband/wife selects (matching:
  - `GedcomFamily.husbandId`
  - `GedcomFamily.wifeId`)
- If you want more general unions, support `GedcomSpouse` relations as well (advanced mode).

Tables:
- `GedcomFamily` (primary spouse slots)
- Potentially `GedcomSpouse` (if modeling additional union representations)

Delete strategy:
- Usually “remove spouse from family” is an update (set husbandId or wifeId to null), not a delete.
- If spouse modeling uses `GedcomSpouse`, then delete those junction rows and orphan-clean if needed.

#### B) Family events
Form:
- Add/edit/delete family events

Tables:
- `GedcomFamilyEvent` (junction)
- `GedcomEvent` (+ date/place)

Delete strategy:
- Junction-first deletion, orphan cleanup.

#### C) Family notes (as a whole)
Tables:
- `GedcomFamilyNote` (junction)
- `GedcomNote`

Delete strategy:
- Junction-first and orphan cleanup.

#### D) Family media
Tables:
- `GedcomFamilyMedia` (junction)
- `GedcomMedia`

Delete strategy:
- Junction-first and orphan cleanup.

---

## 5) User accounts + messages
### 5.1 What “admin edit login information” should mean
Direct edits to login credentials are risky.

Recommended MVP approach:
- Allow admins to manage:
  - `UserProfile`
  - `User.isActive` and safe account flags
  - reset password flow by creating `PasswordResetToken` (not editing `passwordHash`)

If you truly need password reset:
- Provide “Send password reset” button.

### 5.2 Messages UI
Form/UX:
- Inbox-like view scoped to:
  - recipients, threads/groups you support, and/or tree-related messages

Tables:
- `Message`
- `MessageGroup`

Ops:
- “Compose new message”
- “Mark read” (update `isRead` / `readAt`)
- “Delete message” is optional for MVP (deletions should be handled carefully due to audit expectations)

---

## 6) shadcn rapid prototyping plan
### 6.1 Seed the admin UI
Pages (suggested order):
1. `/admin` dashboard
2. `/admin/individuals` (search + list)
3. `/admin/individuals/[id]` (editor panel with tabs)
4. `/admin/families`
5. `/admin/families/[id]`
6. `/admin/users` and `/admin/messages`
7. **Read-only reference catalogs** (§6.4): `/admin/places`, `/admin/dates`, `/admin/given-names`, `/admin/surnames` — **view-only**; no add/edit/delete on these pages

### 6.2 Components to prioritize
- `Card`, `Tabs`, `Table`/`DataTable`, `Dialog`
- `Form` patterns with repeatable sections
- `ConfirmDialog` for delete actions

### 6.3 Deletion confirmation UX
Every delete button should:
- show what association is deleted (junction vs underlying object if applicable)
- show irreversible warning
- optionally show “orphan cleanup will occur”

### 6.4 Reference catalogs: Places, canonical dates, given names, surnames (read-only UI)

Add **DataViewer-style** list pages (and optional **`[id]` detail** pages for context) for deduplicated per-file registry rows:

| Admin area | Prisma model | Table / map |
|------------|--------------|-------------|
| Places | `GedcomPlace` | `gedcom_places_v2` |
| Dates (canonical) | `GedcomDate` | `gedcom_dates_v2` |
| Given names | `GedcomGivenName` | `gedcom_given_names_v2` |
| Surnames (last names) | `GedcomSurname` | `gedcom_surnames_v2` |

**Product rule — no direct mutation from these screens:**

- Do **not** offer **Add**, **Edit**, or **Delete** on these four entity types in the admin catalog UI (table, cards, toolbar, row menus, or bulk actions).
- **View** (and read-only detail, if implemented) is allowed: browse, search/filter, sort, open a detail page that shows fields and **where-used** / linkage context if useful.
- **Changing** place text, date structure, or name registry entries remains **indirect**: only through editing **Individuals**, **Families**, **Events**, and other workflows that already create or repoint `GedcomDate`, `GedcomPlace`, `GedcomGivenName`, and `GedcomSurname` according to existing junction and orphan rules (see §1 and §4).

Suggested routes (align with existing `/admin/notes`, `/admin/events` patterns): `/admin/places`, `/admin/dates`, `/admin/given-names`, `/admin/surnames` (exact paths are a product choice).

---

## 7) Next steps after project scaffolding
1. Decide the “single tree” ID wiring mechanism (config/env)
2. Confirm which admin operations are “create registry entries” vs “reference existing”
3. Define the exact backend endpoints/services needed for each CRUD screen
4. Implement DB privilege list for the admin DB user (write only what is needed)
5. Build UI iteratively, starting with “edit existing” then “add new” then “delete”

---

## 8) Individuals list: accordion filters & search (spec)

This section records the intended behavior for **`/admin/individuals`** (or equivalent list view): an **accordion** that holds advanced criteria so the default list stays uncluttered. Expanding the accordion reveals filters and search fields. Criteria combine in the usual way: **only show individuals that satisfy every criterion that the user has set** (empty / “any” fields do not restrict).

### 8.1 Accordion

- A single collapsible region (e.g. label: **Filters & search** or **Advanced search**).
- When collapsed: the table/card list uses whatever global behavior you keep (e.g. simple search bar outside the accordion, or no search until expanded—product choice).
- When expanded: show the controls in **8.2**–**8.4**.

### 8.2 Filters (categorical)

- **Gender** — Restrict by stored sex / gender (e.g. male, female, unknown, other), with an **all / any** option so no selection means no filter.
- **Living status** — Restrict to **living**, **deceased**, or **all** (using the same notion of living/deceased as elsewhere in the app, e.g. `isLiving` and/or presence of death data).

### 8.3 Given name search (first name)

- **Semantics: “contains”** — The user types a substring; match if the individual’s **given name side** (structured given names and/or display rules you define) **contains** that substring, typically **case-insensitive**.
- This is **not** required to be prefix-only: e.g. `ann` can match `Joann` or `Ann` depending on how names are concatenated for search.

### 8.4 Surname search (last name) — **prefix on GEDCOM-normalized surnames**

This is **different** from the given-name field:

- **Semantics: “starts with” / prefix** — The user types one or more characters (e.g. **`R`**). An individual matches if **at least one** of their surnames (in the sense you query—e.g. primary name form, or all name forms—product choice) has a **logical surname** that **begins with** that string, **case-insensitive**.

- **GEDCOM slashes** — Stored surnames often appear in GEDCOM form with slashes, e.g. **`/Rodrigues/`**, **`/Roman/`**. The user does **not** type slashes. Matching must:
  1. **Normalize** the stored value for comparison (e.g. strip `/`, trim spaces, optionally lowercase).
  2. Apply **prefix matching** on that normalized surname text.

**Examples:**

| User enters | Should match (examples) | Should not match (examples) |
|-------------|-------------------------|-----------------------------|
| `R` | `/Rodrigues/`, `/Roman/`, `Rodriguez` (if stored without slashes but starting with R) | `/OReilly/` as a surname starting with `O` (not `R`); `/Brooks/` (starts with `B`) |
| `Ro` | `/Rodrigues/`, `/Roman/` | `/Reyes/` only if `Reyes` does not start with `Ro` (it doesn’t) |

So **`R` means “surname starts with R”**, not “the letter R appears anywhere in the surname string.” That avoids odd matches inside longer tokens unless you later add a separate “contains” mode for surnames.

### 8.4.1 Where this behavior already lives (genealogy-visualization-engine + public tree)

**Important:** The **`@genealogy-visualization-engine`** package does **not** implement surname matching by itself. It only:

- Collects **given name** and **last name** search strings (with debouncing) in **`src/hooks/useChartSearch.ts`**.
- Passes them to an **injected** `useTreeIndividuals` function (provided by the host app).

The host app (**`the-gonsalves-family`**) implements that hook in **`src/hooks/useTreeData.ts`**: it forwards `givenName` and `lastName` as query parameters to **`GET /api/tree/individuals`**.

The **actual GEDCOM slash-aware, prefix-on-surname** logic is in the **public tree API**:

- **`the-gonsalves-family/src/app/api/tree/individuals/route.ts`**
- **`surnamePrefixRegexPattern(lastNameInput)`** builds a PostgreSQL regex that matches a **literal `/`** followed by the user’s prefix (escaped, lowercased), and the query uses **`full_name_lower ~*`** (case-insensitive). That is exactly “surname token after a slash **starts with** what the user typed”—e.g. **`R`** matches names whose GEDCOM-style `full_name` contains **`/rodrigues/`**, **`/roman/`**, etc., after lowercasing.
- **Given name only:** uses **`givenNameLower` `contains`** on structured given names (not prefix-only).
- **Given + last together:** uses **`full_name_lower LIKE givenPrefix%`** **and** the same surname regex—so in that combined branch, the “given” side is tied to the **start of the stored `full_name` string**, which is a slightly different rule than given-only search; admin UI can choose to mirror this exactly or to use “contains” for given in all modes (product decision).

**For admin `/admin/individuals`:** Reuse or share the **same surname-prefix + slash-aware** approach as this route (or call shared library/SQL) so tree search and admin search stay consistent. The visualization engine is the **UI wiring** reference; the **authoritative surname semantics** are in **`GET /api/tree/individuals`**.

### 8.5 Birth and death ranges

- **Birth in range** — Min/max (typically **years**, or full dates if you extend the spec). Include only individuals whose **birth** falls in the interval; define behavior for **unknown birth** (e.g. exclude from positive ranges unless explicitly included).
- **Death in range** — Same for **death**; define behavior for **living** (no death) vs **unknown death**.

### 8.6 Backend vs UI

For large files, these criteria should be enforced **server-side** (query params + DB or search layer) so pagination and “total count” stay correct—not only by filtering the current client-loaded page.

---

## Open questions
1. When admin edits an event/date/place/media, do you want:
   - “edit in place” (update shared tables) or
   - “create new records and repoint junctions” (simpler delete/orphan story)?
2. For family “roles beyond husband/wife” do you need a full union-role model immediately, or is spouse slots enough for MVP?
3. For user admin: should admins be allowed to change `passwordHash` directly, or strictly use password reset tokens?

