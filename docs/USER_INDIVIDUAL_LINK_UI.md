# User–Individual Link UI — Design

## Purpose

Allow admins to **link users to individuals** in the tree. A link means "this user is associated with this person in the tree" (e.g. "this is me", or a family historian). Stored in `UserIndividualLink`: `userId`, `treeId`, `individualXref`, optional `verified`.

---

## 1. Data model (reference)

- **UserIndividualLink**: `userId`, `treeId`, `individualXref` (GEDCOM xref, e.g. `I1`), `verified` (boolean). Unique on `(userId, treeId, individualXref)`.
- Admin app is scoped to **one tree** (`ADMIN_TREE_ID` → `treeId`). All links are for that tree.
- Individuals are identified by **xref** within the tree’s GEDCOM file (e.g. `I1`, `I42`).

---

## 2. Where to put the UI

Two possible entry points; we can do one or both.

### Option A — User-centric (recommended first)

**Place:** When viewing or editing a **user** (e.g. user detail panel / slide-over / modal from the Users admin page).

- **Section:** "Linked individuals"
- **Shows:** List of current links for this user: individual **XREF** + **name** (from GedcomIndividual) + **verified** badge/toggle.
- **Actions:**
  - **Add link:** Open a picker to choose an individual from the tree (search by name or xref), then create a link.
  - **Remove link:** Delete the `UserIndividualLink` for that individual.

**Pros:** Matches the mental model "this user is linked to these people." One place to manage all links for a user.

### Option B — Individual-centric

**Place:** When viewing or editing an **individual** (e.g. individual detail in the Individuals admin page).

- **Section:** "Linked users"
- **Shows:** List of users linked to this individual (username, optional verified).
- **Actions:** Add link (pick user), remove link.

**Pros:** Useful when editing a person and asking "which accounts are linked to this record?"

**Recommendation:** Implement **Option A** first (user-centric). Add Option B later if needed; it uses the same APIs with different filters.

---

## 3. API surface

All under admin auth; `treeId` from `ADMIN_TREE_ID`.

| Method | Route | Purpose |
|--------|--------|--------|
| GET | `/api/admin/users/[id]` | Include `userIndividualLinks` for this user and this tree (with individual xref + resolve name from GedcomIndividual). |
| GET | `/api/admin/users/[id]/links` | Optional: list links for user (same data as above, if we prefer a dedicated endpoint). |
| POST | `/api/admin/users/[id]/links` | Body: `{ individualXref: string, verified?: boolean }`. Create link. Validate xref exists in tree’s GEDCOM. Return 409 if link already exists. |
| DELETE | `/api/admin/users/[id]/links/[linkId]` or `?individualXref=I1` | Remove one link. |

**Resolving individual name:** When listing links, join or query `GedcomIndividual` by `fileUuid` (from tree’s `gedcomFileId`) + `xref` to show "I1 – John Doe" instead of just "I1".

---

## 4. UI components (Option A)

1. **User detail context**  
   Need a way to "open" a user (e.g. row click, "View" action, or an edit panel). Current Users page has View/Edit as `alert(...)`. Replace with a **user detail panel/slide-over or modal** that shows:
   - User info (username, email, name, role, status)
   - **Linked individuals** section (see below)

2. **Linked individuals block (on user detail)**  
   - **List:** For each link: display name (from GedcomIndividual), xref (e.g. `I1`), optional "Verified" badge or toggle, and a "Remove" button.
   - **Empty state:** "No individuals linked. Add a link to associate this user with a person in the tree."
   - **Button:** "Link to individual" → opens the individual picker.

3. **Individual picker (add-link flow)**  
   - **Input:** Search by name or xref (call existing individuals list API with `q` or a dedicated lightweight search that returns `{ xref, fullName }`).
   - **Results:** List or combobox of matching individuals (xref + name). Only individuals that are **not already linked** to this user (or show "Already linked" and disable).
   - **Select:** On choose, call `POST /api/admin/users/[id]/links` with `{ individualXref }`, then refresh the linked-individuals list and close the picker.

4. **Verified flag (optional for v1)**  
   - In the link list: show "Verified" or "Unverified"; optionally make it editable (PATCH link or a small API to set `verified`).

---

## 5. Implementation order

1. **API**
   - Extend `GET /api/admin/users/[id]` to return `links: Array<{ id, individualXref, individualName?, verified }>` for the admin tree.
   - Add `POST /api/admin/users/[id]/links` (body: `individualXref`, optional `verified`). Validate xref exists in tree’s file; create `UserIndividualLink` with `userId`, `treeId`, `individualXref`.
   - Add `DELETE /api/admin/users/[id]/links/[linkId]` (or delete by userId + individualXref).

2. **User detail surface**
   - Replace the placeholder View/Edit on the Users page with a **user detail panel** (slide-over or modal) that loads user by id (e.g. `useAdminUser(userId)`), shows user fields and the **Linked individuals** section.

3. **Linked individuals section**
   - In the user detail panel: render the list from `user.links`, with remove button per row calling the delete-link API and invalidating the user query.

4. **Add-link flow**
   - "Link to individual" button → open a **picker modal**.
   - Picker: search input + call individuals list (or a dedicated search endpoint) with debounce; display results (xref + fullName); on select, POST create link, refresh, close.

5. **Optional**
   - Verified toggle per link (if we add PATCH for links).
   - Option B: "Linked users" on the individual side, reusing the same link APIs.

---

## 6. Edge cases

- **XREF validation:** Before creating a link, ensure the `individualXref` exists in the tree’s GEDCOM file (query `GedcomIndividual` by `fileUuid` + `xref`). Return 400 if not found.
- **Duplicate:** Unique on `(userId, treeId, individualXref)`; return 409 if link already exists.
- **Tree scope:** Always use the admin tree’s `treeId`; never expose or create links for another tree.

---

## 7. Summary

- **First step:** User-centric UI: when opening a user, show a "Linked individuals" section with list + "Link to individual" (picker) + remove per link.
- **APIs:** Extend GET user to include links (with names); add POST and DELETE for user links.
- **Picker:** Reuse tree individuals (search by name/xref), then create link by xref.

This keeps the implementation scoped and consistent with the existing admin patterns (list + detail panel + modal for add).
