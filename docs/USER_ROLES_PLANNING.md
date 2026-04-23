# User roles — planning

## 1. Roles (from schema)

Tree-level roles are represented by membership in one of three tables for a given tree. A user has **at most one** tree-level role per tree; "none" means no row in any of these tables.

| Role          | Schema table      | Description (intent) |
|---------------|-------------------|----------------------|
| **Owner**     | `TreeOwner`       | Full control of the tree. |
| **Maintainer**| `TreeMaintainer`  | Can manage content and add contributors; not full ownership. |
| **Contributor** | `TreeContributor` | Can author stories and other user-created content. |
| **None**      | (no row)          | No tree-level role; may still have granular `Permission` rows. |

The admin app already has **POST `/api/admin/users/[id]/role`** with body `{ role: "owner" | "maintainer" | "contributor" | "none" }`, which replaces the user’s tree role (clears all three tables for that tree, then creates the appropriate row if not "none").

---

## 2. What each role allows the user to do

Inferred from the schema and typical product behaviour. Exact behaviour depends on application logic elsewhere; this is the intended meaning for **documentation and UI copy**.

### Owner

- **Full control** of the tree: settings, visibility, and data.
- **Manage roles:** Add or remove other owners, maintainers, and contributors for this tree.
- **Manage content:** Everything maintainers and contributors can do (stories, media, discussions, etc.).
- **Invitations:** Can create invitation links (e.g. for read, write, maintainer, owner).
- **Access requests:** Can approve or reject access requests (including owner/maintainer/contributor requests).
- **User–individual links:** Can manage who is linked to which individuals (or delegate via maintainers).
- In the schema: `TreeOwner`; multiple owners per tree; optional `isPrimary` for display.

### Maintainer

- **Manage content** for the tree: stories, albums, discussions, and other user-generated content.
- **Add contributors:** Can grant the contributor role (add to `TreeContributor`).
- **Not:** Cannot add/remove owners or other maintainers; cannot change tree-level settings that are restricted to owners.
- Schema comment: maintainers are “added by” someone (`addedBy`); in practice, only owners (or other maintainers, if app logic allows) add maintainers.
- Invitation links: typically can create links for roles up to and including “maintainer” or “contributor”, depending on app policy.

### Contributor

- **Author content** tied to the tree: stories (and other user-created content) for that tree.
- Schema: “Contributors can author stories (and other user-created content) for a tree. Granted by Tree Owners and Maintainers.”
- **Not:** Cannot add or remove any tree-level roles; cannot change tree settings; limited to creating/editing their own content within the tree.
- May be able to request or receive **user–individual links** (“this is me”) and use features that depend on that link (e.g. “my profile” in the tree).

### None

- **No tree-level role:** No row in `TreeOwner`, `TreeMaintainer`, or `TreeContributor` for this tree.
- The user may still have **granular permissions** in the `Permission` table (read/write/delete/admin on specific resources: tree, individual, family, subtree). Those are separate from the “role” and can be used for fine-grained access (e.g. read-only for one subtree).
- In the admin UI, “Role” refers only to the tree-level role (owner / maintainer / contributor / none).

---

## 3. Summary for UI copy

Short descriptions suitable for a role selector or tooltip:

| Role        | One-line description |
|-------------|----------------------|
| **Owner**   | Full control of the tree: settings, roles, and all content. |
| **Maintainer** | Manage content and add contributors; cannot change owners or tree settings. |
| **Contributor** | Can author stories and other user-created content for the tree. |
| **None**    | No tree-level role (may still have other permissions). |

Longer “What can this role do?” text can use section 2 above (e.g. in a help panel or docs).

---

## 4. UI for setting a user’s role

- **Where:** In the **user detail** (e.g. when opening a user from the Users admin page), or inline on the users list if space allows.
- **Control:** A single **role selector**: dropdown or radio group with the four options (Owner, Maintainer, Contributor, None), plus optional short description or tooltip per option (using the table in §3).
- **Behaviour:** On change, call **POST `/api/admin/users/[id]/role`** with `{ role: "owner" | "maintainer" | "contributor" | "none" }`, then refresh the user (or list) so the new role is shown.
- **Hooks:** `useUpdateUserRole()` already exists; wire the selector’s `onChange` to that mutation.
- **Access:** Only users who are allowed to change roles (e.g. current user is owner or maintainer for the admin tree) should see or use this control; that authorization is assumed to be enforced elsewhere (e.g. admin route guard).

---

## 5. Optional: role explanation panel

For “What does each role do?” in the UI:

- **Inline:** Short tooltip or helper text next to the role dropdown (e.g. the one-line descriptions from §3).
- **Dedicated panel:** A “Roles explained” or “?” link that opens a small modal or slide-over with the §2 breakdown (Owner / Maintainer / Contributor / None) so admins can decide which role to assign.

---

## 6. Schema references (for implementers)

- **TreeOwner:** `schema.prisma` ~line 180  
- **TreeMaintainer:** ~line 267  
- **TreeContributor:** ~line 287 (comment: “Contributors can author stories… Granted by Tree Owners and Maintainers.”)  
- **Permission / PermissionType / ResourceType:** ~220–263 (granular permissions; separate from tree-level role.)  
- **AccessRequestType:** ~235 (basic_access, individual_link, contributor_role, maintainer_role, owner_role)  
- **Admin role API:** `POST /api/admin/users/[id]/role` with `{ role }`; implemented in `src/app/api/admin/users/[id]/role/route.ts`
