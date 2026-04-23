# DataViewer Component — Design

## Purpose

A **single reusable component** that displays any admin record type (Individuals, Families, Users, Media, Events, Messages) in either **table view** (shadcn Data Table) or **card view**, with consistent **actions**: view, edit, delete, add.

## Record types in scope

| Entity    | Description                          |
|----------|--------------------------------------|
| Individuals | People in the tree                   |
| Families | Family units (spouse/child links)     |
| Users    | Accounts and tree access              |
| Media    | Media items (linked to individuals/families) |
| Events   | Events (birth, death, etc.; linked to individuals/families) |
| Notes    | Free-text notes (linked to individuals/families/events/sources) |
| Sources  | Citations and source records (linked to individuals/families/events) |
| Messages | User messages                        |

---

## 1. Component API

### 1.1 DataViewer (main component)

```tsx
interface DataViewerProps<TRecord, TRecordId = string> {
  /** Entity configuration: columns, card renderer, labels, actions */
  config: DataViewerConfig<TRecord, TRecordId>;

  /** Data to display */
  data: TRecord[];

  /** Loading state (optional; shows skeleton or spinner) */
  isLoading?: boolean;

  /** Initial view mode (optional; default "table") */
  defaultViewMode?: "table" | "cards";

  /** Persist view mode (e.g. in URL or localStorage) — optional */
  viewModeKey?: string;

  /** Optional: global search is handled by parent (controlled filter) */
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
}
```

- **Generic `TRecord`**: the shape of one row (e.g. `IndividualRow`, `FamilyRow`).
- **Generic `TRecordId`**: optional; used when IDs are not strings (e.g. UUID type). Default `string`.
- **Single source of truth**: `config` defines how this entity is rendered in both views and which actions exist.

---

## 2. DataViewerConfig<TRecord, TRecordId>

This is the **entity descriptor** passed per record type. It drives both table and card view and all actions.

```tsx
import type { ColumnDef } from "@tanstack/react-table";

interface DataViewerConfig<TRecord, TRecordId = string> {
  /** Unique key for this entity (e.g. "individuals", "families") */
  id: string;

  /** Labels for UI */
  labels: {
    singular: string;   // "Individual"
    plural: string;       // "Individuals"
  };

  /** Stable id for each row (required for keys, selection, and actions) */
  getRowId: (row: TRecord) => TRecordId;

  // ─── Table view ─────────────────────────────────────────────────────
  /** TanStack Table column definitions. Include an "actions" column or add it automatically. */
  columns: ColumnDef<TRecord, unknown>[];

  /** Optional: which column to use for global filter (e.g. "name", "email") */
  globalFilterColumnId?: string;

  /** Optional: default sort [{ id: "name", desc: false }] */
  defaultSorting?: SortingState;

  /** Enable row selection (checkboxes) for bulk actions (e.g. bulk delete) */
  enableRowSelection?: boolean;

  // ─── Card view ──────────────────────────────────────────────────────
  /** Render one record as a card. Receives the record and action callbacks. */
  renderCard: (props: {
    record: TRecord;
    onView?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
  }) => React.ReactNode;

  // ─── Actions ────────────────────────────────────────────────────────
  actions: {
    add?: {
      label: string;   // "Add individual"
      handler: () => void;  // open dialog / navigate to create
    };
    view?: {
      label: string;
      handler: (record: TRecord) => void;  // open detail drawer / navigate
    };
    edit?: {
      label: string;
      handler: (record: TRecord) => void;  // open edit form / navigate
    };
    delete?: {
      label: string;
      handler: (record: TRecord) => void;  // open confirm dialog, then delete
      /** Optional: support bulk delete (when enableRowSelection is true) */
      bulkHandler?: (ids: TRecordId[]) => void;
    };
  };
}
```

- **Table**: Uses `columns` with TanStack Table. If `actions.view` / `actions.edit` / `actions.delete` are present, DataViewer can **append an actions column** (dropdown with View / Edit / Delete) so each page doesn’t repeat that column definition. Alternatively, the config can supply its own actions column for full control.
- **Cards**: Renders a grid; each item is `renderCard({ record, onView, onEdit, onDelete })`. DataViewer provides the callbacks from `actions`.
- **Add**: Single “Add” button in the toolbar; label and handler from `actions.add`.

---

## 3. UI structure

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                          │
│  [Search input (optional)]  [View: Table | Cards]  [Add]         │
│  (optional: column visibility when in table mode)                │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  Table view:                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Col1    │ Col2    │ Col3    │ Actions (⋮)                 │  │
│  │ ...     │ ...     │ ...     │ View / Edit / Delete         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [Pagination]  [Optional: "N of M selected" + bulk Delete]      │
│                                                                  │
│  Card view:                                                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                            │
│  │ Card 1  │ │ Card 2  │ │ Card 3  │  ...                        │
│  │ [View]  │ │ [View]  │ │ [View]  │                            │
│  │ [Edit]  │ │ [Edit]  │ │ [Edit]  │                            │
│  │ [Del]   │ │ [Del]   │ │ [Del]   │                            │
│  └─────────┘ └─────────┘ └─────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Toolbar

- **Search** (optional): Single input; filters using `globalFilterColumnId` or a custom filter function (can be part of config later).
- **View toggle**: Segmented control or icon toggle — “Table” vs “Cards”. State can be internal or controlled via `viewModeKey` (e.g. `?view=cards` or `localStorage`).
- **Add button**: Rendered only if `config.actions.add` is set; calls `handler()`.
- **Column visibility** (table only): Optional dropdown to show/hide columns (shadcn pattern).

### 3.3 Table view

- Uses shadcn **Table** (TableHeader, TableBody, TableRow, TableCell) + **TanStack Table** (`useReactTable`, `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`, `getPaginationRowModel`).
- **Actions column**: If config has `view` / `edit` / `delete`, DataViewer adds a column with a dropdown (e.g. “⋮”) with “View”, “Edit”, “Delete” that call the corresponding handlers with `row.original`.
- **Row selection**: If `enableRowSelection` is true, add a checkbox column and show “N selected” + optional bulk Delete in the toolbar or footer.
- **Empty state**: “No results.” when `data.length === 0` (and not loading).

### 3.4 Card view

- **Grid**: CSS grid (e.g. responsive: 1 col mobile, 2–3 cols tablet, 4+ desktop). Each cell is `config.renderCard({ record, onView, onEdit, onDelete })`.
- **Card content**: Fully defined by the consumer; DataViewer only provides the wrapper grid and the action callbacks. Cards can show a thumbnail, title, subtitle, and action buttons/links.
- **Empty state**: Same as table.

### 3.5 Loading state

- When `isLoading === true`, show either a table skeleton (rows with placeholders) or a card grid skeleton. Optional prop; if omitted, no loading UI.

---

## 4. Actions summary

| Action | Where it appears           | Behavior |
|--------|----------------------------|----------|
| **Add** | Toolbar                    | Single button; calls `config.actions.add.handler()`. |
| **View** | Table: row actions dropdown; Cards: on card | Calls `config.actions.view.handler(record)`. |
| **Edit** | Table: row actions dropdown; Cards: on card | Calls `config.actions.edit.handler(record)`. |
| **Delete** | Table: row actions dropdown; Cards: on card; optional bulk | Calls `config.actions.delete.handler(record)` or `bulkHandler(ids)`. |

- View = read-only detail (drawer or page).
- Edit = form (dialog or page).
- Delete = confirmation dialog then delete (and optional refetch).

---

## 5. Optional extensions (later)

- **Filtering**: Besides global search, optional per-column filters (e.g. status dropdown) via TanStack Table `filterFn` and filter state.
- **Sorting**: Already supported via column definitions (`enableSorting`, header click).
- **Pagination**: Built-in with `getPaginationRowModel()`; page size selector optional.
- **URL state**: Persist `viewMode`, `sort`, `page`, `filter` in URL so “Individuals” page is shareable and back/forward work.
- **Export**: Toolbar “Export” (CSV/Excel) using current filter/sort; can be a separate prop or callback.

---

## 6. File structure (suggested)

```
src/
  components/
    data-viewer/
      DataViewer.tsx          # Main component
      DataViewerToolbar.tsx   # Search, view toggle, Add, column visibility
      DataViewerTable.tsx     # Table + TanStack Table wiring
      DataViewerCardGrid.tsx  # Card grid layout
      types.ts                # DataViewerConfig, DataViewerProps
      useDataViewerTable.ts   # useReactTable + default actions column
  app/admin/
    individuals/
      page.tsx                # Uses DataViewer with individuals config
    families/
      page.tsx                # Uses DataViewer with families config
    ...
  lib/
    data-viewer-configs/      # Optional: shared config builders
      individuals.ts
      families.ts
      ...
```

---

## 7. Example: Individuals config (sketch)

```tsx
const individualsConfig: DataViewerConfig<IndividualRow> = {
  id: "individuals",
  labels: { singular: "Individual", plural: "Individuals" },
  getRowId: (row) => row.id,
  columns: [
    { accessorKey: "xref", header: "XREF" },
    { accessorKey: "displayName", header: "Name" },
    { accessorKey: "birthYear", header: "Birth" },
    // actions column can be auto-added by DataViewer
  ],
  globalFilterColumnId: "displayName",
  defaultSorting: [{ id: "displayName", asc: true }],
  enableRowSelection: true,
  renderCard: ({ record, onView, onEdit, onDelete }) => (
    <IndividualCard
      individual={record}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  ),
  actions: {
    add: { label: "Add individual", handler: () => openAddDialog() },
    view: { label: "View", handler: (r) => openDetail(r.id) },
    edit: { label: "Edit", handler: (r) => openEditDialog(r.id) },
    delete: { label: "Delete", handler: (r) => confirmDelete(r.id), bulkHandler: (ids) => bulkDelete(ids) },
  },
};
```

---

## 7.1 Read-only reference catalogs (Places, Dates, Given names, Surnames)

For **deduplicated per-file registries** (`GedcomPlace`, `GedcomDate`, `GedcomGivenName`, `GedcomSurname`), reuse **DataViewer** for **consistent list/card UX** (search, filters, sorting, pagination) but configure them as **read-only**:

- **Do not** wire `actions.add`, `actions.edit`, or `actions.delete` (no toolbar “Add”, no row edit/delete, no bulk delete).
- Prefer **`actions.view`** only (navigate to a read-only detail route or modal), or omit destructive/authoring affordances entirely if detail is unnecessary.
- Set **`enableRowSelection: false`** when there is no bulk action; hide selection checkboxes.
- **Card and table renderers** should not show edit/delete buttons; primary action is **view** or plain display.

Registry rows are still created or updated **only** through higher-level editors (individuals, families, events, name forms), not through these catalog pages. See **`ADMINISTRATION_PLAN.md` §6.4**.

---

## 8. Dependencies

- **shadcn**: Add `table`, `dropdown-menu`, `checkbox`, `input` (if not already present).
- **@tanstack/react-table**: Required for table view.
- Existing: `button`, `card` (for card view structure; actual card content is custom per entity).

---

## 9. Summary

| Concern | Approach |
|--------|----------|
| **One component for all record types** | DataViewer generic over `TRecord`; behavior comes from `DataViewerConfig<TRecord>`. |
| **Table + card view** | `defaultViewMode` + view toggle; table uses `columns`, cards use `renderCard`. |
| **Table implementation** | shadcn Table + TanStack Table; optional auto actions column. |
| **Actions** | add (toolbar), view/edit/delete (per row + per card) via config callbacks — **except** read-only registries (§7.1), which expose **view only**. |
| **Media & Events** | Supported by defining a `DataViewerConfig` for each (e.g. `MediaRow`, `EventRow`) with their own columns and `renderCard`. |
| **Places / Dates / Given names / Surnames** | Same DataViewer shell; **no** add/edit/delete; optional view-only detail. |

This design keeps a single DataViewer component and pushes entity-specific details into configs and card renderers, so we can add Individuals, Families, Users, Media, Events, and Messages with minimal duplication.
