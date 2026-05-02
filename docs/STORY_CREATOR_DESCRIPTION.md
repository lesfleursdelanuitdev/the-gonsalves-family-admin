# Story Creator — Description and Capabilities

This document describes the **Story Creator** in the Gonsalves Family Admin app: what it is for, how it stores data, and everything the current implementation can do. The live editor lives under **`/admin/stories`** (Next.js). A separate static HTML/React prototype, **`/apps/Story Creator.html`**, exists at the workspace root as a design playground (themes, layout experiments); behavior and data model should be taken from the **admin app** unless noted otherwise.

---

## Purpose

Story Creator is a **block-based authoring environment** for long-form family content: narratives, articles, and short posts. It combines:

- A **hierarchical outline** (sections and nested sections) for chapters and groupings.
- **Composable blocks** inside each section: rich text, media, embeds, two-column layouts, dividers, and layout containers.
- **Story-level metadata** (title, author, excerpt, tags, linked people/families/events, albums, cover/profile images).
- **TipTap** for rich text inside **rich text** blocks, with tables, links, highlights, alignment, font size, and **dynamic story fields** (title / subtitle / author chips that resolve from document metadata).

The product direction (from internal planning) is to treat stories as **structured compound media** with a JSON document as source of truth, optional rendered HTML for delivery, and relational junctions when synced to the database. Today, **drafts are stored only in the browser** (`localStorage`); server-backed stories and public URLs are planned.

---

## Where to find it

| Location | Description |
|----------|-------------|
| **`/admin/stories`** | List of stories (table/cards), search, open, delete. |
| **`/admin/stories/new`** | Creates a new story id and redirects to the editor. |
| **`/admin/stories/[storyId]`** | Full **Story Creator** UI (`StoryCreatorClient`). |

List copy states that stories are **stored locally until a server API is connected**.

---

## Persistence and lifecycle

### Local storage

- **Document JSON**: key pattern `ligneous-admin-story-doc-v1:{id}`.
- **Index** (titles, ids, `updatedAt`, `kind`, `status`): `ligneous-admin-stories-index-v1`.

### Document format

- **`StoryDocument`** is **`version: 1`** with `id`, `title`, `updatedAt`, `sections[]`, and optional fields described in `lib/admin/story-creator/story-types.ts`.
- **Save draft** and **Publish** both **persist to `localStorage`**; “Publish” sets `status: "published"` locally (toast: *local only until API exists*). There is **no** public site sync from this flow yet.

### Migration

On load, **`migrateStoryDocument`** runs. If the on-disk shape differs from the migrated shape, the document is re-saved and a toast may explain upgrades (e.g. flexible section tree, columns/media/embed handling, tables living in text blocks).

---

## Content model

### Sections (outline tree)

- Each **section** has an `id`, **title**, optional **`collapsed`** (outline UI), **`blocks`**, and optional **`children`** (nested sections).
- Ordering follows the tree: sections and nested sections can represent chapters, appendices, etc.
- **Structure sidebar** (`StoryStructureSidebar`): navigate, rename, add sibling/child sections, collapse, reorder affordances as implemented in `StoryCreatorClient`.

### Block types (`StoryBlock`)

| Type | Role |
|------|------|
| **`richText`** | TipTap JSON (`doc`) per block; optional **row layout** (width mode, alignment, custom width) and **`design`** (className / scoped css). |
| **`media`** | Library media: optional `mediaId`, **label**, **caption**, **title/caption placement** (above/below/left/right), **layout** (align, width/height presets, full width, text wrap), **link mode**, **row layout** (including float-left/right with text), **design**. |
| **`embed`** | Non-media embed placeholders: **`document`**, **`timeline`**, **`map`**, **`tree`**, **`graph`**. Same presentation controls as media (label, sublabel, caption, placements, presets, link, row layout, design). |
| **`columns`** | **Two columns**; each column is a **`StoryColumnSlot`** with ordered **nested blocks**. Nested kinds: rich text, media, embed, **nested columns** (see limit below), **container**. Column **width split** (percent presets + slider), **gap** (rem presets), per-column **vertical stack** (`justify-content` presets) and **stack gap**. |
| **`divider`** | Visual separator; optional **design**. |
| **`container`** | Layout wrapper with **props**: label, **background** (none / subtle / custom color), **padding**, **border**, **width** (full / constrained), **align**, optional **rowLayout**; holds **child** section-level blocks recursively. |

### Columns nesting depth

- **Maximum depth: 2** (section-level columns → at most one nested columns block inside a column). Enforced in the editor and migration (`MAX_STORY_COLUMNS_NEST_DEPTH`). Deeper nesting is blocked in the UI.

### Default new section

New sections get a **container** wrapping an **empty rich text** block (`createDefaultSectionBlocks`).

---

## TipTap rich text (inside each rich text block)

Configured in **`createStoryTipTapExtensions`** (`story-tiptap-extensions.ts`):

- **StarterKit**: paragraphs, bold/italic/strike, lists, blockquote, horizontal rule, **headings 1–3**, history, dropcursor, gapcursor, **links** (autolink, `https` default, controlled click behavior), **code blocks** (styled class).
- **Highlight** (single color class).
- **TextStyle** + **FontSize**.
- **TextAlign** on headings and paragraphs.
- **Tables**: **TableKit** (custom **StoryTable** wrapper, non-resizable table class for consistent rendering).
- **Placeholder** (“Write this section…”) when used in the live editor.
- **StoryField** extension: inline nodes for **`title`**, **`subtitle`**, **`author`** — resolved from `StoryDocument` for preview/HTML export (`story-field-resolve.ts`, `STORY_FIELD_INSERT_LABELS`).

---

## Editor UI (`StoryCreatorClient`)

### Modes

- **Edit**: structure + block canvas + inspector.
- **Preview**: **`StoryCreatorPreview`** — read-oriented layout with section picker; uses the same document.

### Desktop (large breakpoint)

- **Left**: structure / outline panel (toggleable).
- **Center**: section content — blocks rendered with **`StoryTipTapEditor`** for rich text, **`MediaBlockContentRenderer`**, **`EmbedBlockContentRenderer`**, column layouts, drag handles, add-block affordances, **`StoryBlockPlacementDialog`** for insert position, **`StoryBlockRowDesignWrap`**, etc.
- **Right**: **inspector** (`StoryCreatorInspector`) when open — **Block**, **Story**, or **Debug** tabs.

### Mobile

- **Bottom dock** (`StoryEditorBottomDock`): tabs such as add block, structure, settings.
- **Full-screen sheets**: structure tree, block settings, story settings, add-block bottom sheet (`story-creator-mobile.tsx`).
- Touch-oriented sizing on many controls (`touchComfort`).

### Block operations (high level)

- **Add** blocks (rich text, media, embed, columns, divider, container) at section or container level; **insert** relative to selection; **append** into container.
- **Select** a block to edit in the **Block** inspector.
- **Duplicate**, **remove**, **patch** rich text / media / embed / container / columns / column slots / row layout / **block design** (class + CSS).
- **Group blocks for layout** (`groupStoryBlocksForLayout`, column grouping helpers).

### Header toolbar

- Back to **Stories** list.
- Inline **story title** edit.
- **Draft / Published** badge and **Story / Article / Post** kind badge.
- **Last saved** timestamp (from document `updatedAt` after local save).
- **Edit / Preview** toggle (desktop); mobile uses menu + publish.
- **Save draft**, **Publish** (local persistence only).
- **Inspector** show/hide (desktop).

---

## Inspector (`StoryCreatorInspector`)

### Block tab

Context-sensitive controls for the **selected block**, including where applicable:

- **Rich text**: row width / alignment (rich text row layout rules).
- **Media**: pick/change asset (**`MediaPicker`** / library), label, caption, title & caption **placement grid**, width & height presets, full width, text wrap, link behavior, **row layout** (full/wide/medium/narrow/custom, alignment, **block vs float** with left/right float), **advanced design** (className, custom CSS). Thumbnail resolution via **`useStoryMediaById`** and preview helpers.
- **Embed**: embed **kind** picker (document, timeline, map, tree, graph), label/sublabel/caption, same layout and row options as media.
- **Container**: label, background, padding, border, width, align, row layout overrides.
- **Columns**: nesting depth callout, width **presets**, **custom split** slider, **column gap** presets, per-column **vertical alignment** and **stack gap**, collapsible help copy; **Advanced** notes about stacked columns on narrow viewports.

### Story tab

- **Basic details**: title, **author**, **author prefix** mode (By / Author / Custom / None) + **custom prefix** text, live **author line preview**, **subtitle / excerpt** (textarea), **draft vs published** chips (synced with toolbar save), visibility note (local-only until API).
- **Content type**: **Story**, **Article**, **Post** (`StoryKind` alignment for future sync).
- **Publishing** (collapsed): placeholder text — slug, schedule, SEO not editable until DB API.
- **Story context**: **linked records** — individuals, families, events (`SelectedNoteLink` shape; pickers: **`IndividualSearchPicker`**, **`FamilySearchPicker`**, **`EventPicker`**). **Related places**: explicitly “not stored yet” in the UI.
- **Story images**: **Cover** and **Profile** images via **`MediaPicker`** (purpose **`portrait`** / gallery patterns) with **Gedcom**, **site**, and **user** media kinds; remove actions; copy explains mapping to **`stories.cover_media_id`** / **`profile_media_id`** when synced. Legacy **`coverMediaId`** / **`coverMediaKind`** supported via **`legacyCoverImageRef`** resolution.
- **Organization**: **comma-separated tags**; **linked albums** — search existing albums, link/unlink, **create new album** via **`POST /api/admin/albums`** (live API), stored as `{ id, name }[]` on the draft for future `album_stories` sync.
- **Advanced**: read-only **story id**, **document version**, **last updated**; note about **Debug** tab.

### Debug tab

- Read-only **JSON** of summary + full in-memory document + **preview of next `saveStoryDocument` payload** (with refreshed `updatedAt`).
- **Copy** JSON to clipboard for support or migration work.

---

## Preview (`StoryCreatorPreview` + `story-creator-preview.tsx`)

- Renders the story for **human review**: sections, blocks, typography, media/embed frames, columns, containers, author line, cover/profile when wired in preview helpers.
- Section navigation can align with **`activeSectionId`**.

---

## Story list (`/admin/stories`)

- Loads **`loadStoryIndex()`** from `localStorage`.
- **Columns / cards**: title, type (Story/Article/Post), status (Draft/Published), updated time.
- **Search** filter (title, type, status).
- **New story**, **Open**, **Delete** (confirm: removes local draft only).

---

## Capabilities summary checklist

**Implemented today**

- [x] Multi-section and **nested section** outline with rename/collapse/add (per client implementation).
- [x] Blocks: **rich text**, **media**, **embed**, **two-column layout**, **divider**, **container** (nested blocks).
- [x] TipTap: headings, lists, quotes, links, code, highlight, font size, text align, **tables**, placeholder, **story field** chips.
- [x] Per-block and per-column **layout** controls (width presets, float-with-text, column split, gaps, vertical stacking).
- [x] Optional per-block **CSS class** and **custom CSS** (design panel).
- [x] **Story metadata**: title, author + prefix modes, excerpt, status, kind, tags, linked individuals/families/events, linked albums (+ create album API), cover & profile image refs (multi media kind).
- [x] **Local persistence** + index + dirty tracking + migrate on load.
- [x] **Preview** mode; **responsive** editor shell with mobile sheets/dock.
- [x] **Debug** export of JSON.

**Explicitly not implemented (or placeholder only)**

- [ ] Server-side story CRUD and **public publishing** from this editor (copy and toasts say API/sync is future).
- [ ] Slug, scheduled publish, featured placement, **SEO** fields (Story tab Publishing section).
- [ ] **Place links** on the story document (UI says not stored yet).
- [ ] Embed blocks are **typed placeholders** (document/timeline/map/tree/graph) — not live embedded apps unless separately wired in renderers.

---

## Related code and docs

| Area | Path (under repo root) |
|------|-------------------------|
| Main client | `the-gonsalves-family-admin/src/components/admin/story-creator/StoryCreatorClient.tsx` |
| Inspector | `.../StoryCreatorInspector.tsx` |
| Types | `the-gonsalves-family-admin/lib/admin/story-creator/story-types.ts` |
| Storage | `.../story-storage.ts` |
| Block factory | `.../story-block-factory.ts` |
| Mutations | `.../story-doc-mutators.ts` |
| TipTap extensions | `.../story-tiptap-extensions.ts` |
| Schema direction (DB) | `packages/ligneous-prisma/STORY_CREATOR_SCHEMA_PLAN.md` |
| Prisma `Story` / chapters (evolution) | `packages/ligneous-prisma/prisma/schema.prisma` and migrations under `prisma/migrations` |

---

## For authors (plain language)

**Story Creator** lets you build a family story as **chapters (sections)** and **building blocks**: write in the word processor, drop in **photos or files** from the archive, add **placeholder embeds** for things like maps or timelines, split the page into **two columns**, and wrap content in **styled boxes**. You can tag the story, link it to **people, families, events, and albums**, set a **cover and profile picture**, and switch between **draft** and **published** for your own organization—everything saves in **this browser** until the team connects it to the database and the public site.
