# The Gonsalves Family Admin — Refactoring Plan

**Date:** April 24, 2026  
**Scope:** `gonsalves-genealogy/the-gonsalves-family-admin` (Next.js App Router admin app)

---

## 1. Context

Rough scale today:

- ~217 TypeScript / TSX files under `src/`
- ~73 TypeScript files under `lib/`
- Several **very large** screen components that mix UI, client state, and API orchestration

The app is already structured around sensible layers (`src/app/admin/*`, `src/app/api/admin/*`, `src/components/admin/*`, `lib/admin/*`, `lib/gedcom/*`, `src/hooks/*`, `src/components/data-viewer/*`). The main opportunity is **reducing size and duplication** without changing product behavior or GEDCOM semantics.

---

## 2. Goals

1. **Shrink and split mega-forms** so screens are navigable and changes are safer.
2. **Unify small utilities** (debounced search, optional React Query `enabled` patterns).
3. **Clarify boundaries:** UI components vs hooks (“use cases”) vs route handlers vs `lib/` serializers and SQL.
4. **Reduce repeated patterns** (e.g. media link staging: staged vs persisted, POST-after-create batches, picker + pill + card wrapper).
5. **Tighten types / imports** so `lib/` does not depend on `src/hooks` for types long term.

---

## 3. Current pain points (evidence-based)

| Area | Observation |
|------|-------------|
| **Megacomponents** | `IndividualEditForm.tsx` (~3.2k lines), `MediaEditorForm.tsx` (~1.7k), `FamilyEditForm.tsx` (~1.4k) combine tabs, staging, mutations, and domain rules in one file. |
| **Debouncing** | `useDebouncedValue` exists in `src/hooks/useDebouncedValue.ts`, but **local copies** or `useDebounced` appear in `MediaEditorForm`, `EventPicker`, `IndividualSearchPicker`, `FamilySearchPicker` with different delays (250 / 280 / 300 ms). |
| **React Query** | `createAdminCrudHooks` is consistent for list/detail, but **special `useQuery` wrappers** (e.g. note search, place/date suggestions) duplicate “build URL + staleTime + enabled” logic. |
| **Media links** | Multiple junction routes (`individual-media`, `family-media`, `event-media`, `place-media`, `date-media`, …); behavior is correct but **documentation and optional changelog policy** could be centralized. |
| **Cross-layer types** | Example: `lib/` modules importing types from `@/hooks/...` blurs dependency direction. |

---

## 4. Phased plan

### Phase 1 — Quick wins (low risk)

| # | Task | Outcome |
|---|------|---------|
| 1.1 | Replace inline **`useDebounced` / duplicated `useDebouncedValue`** in `MediaEditorForm`, `EventPicker`, `IndividualSearchPicker`, `FamilySearchPicker` with **`src/hooks/useDebouncedValue.ts`**. | One implementation; document recommended delays per use case (search vs suggestions). **Done** (2026-04-26) — see note below. |
| 1.2 | Optionally extend **`createAdminCrudHooks`** `useList` with **`enabled`** (and `placeholderData` if needed) so one-off hooks can shrink. | Fewer hand-rolled `useQuery` blocks. |
| 1.3 | Fix **lint / `useMemo` dependency** issues in touched files (e.g. tag/album search in `MediaEditorForm`) and remove unused imports as you go. | Cleaner CI signal during larger refactors. |

**Phase 1.1 note (2026-04-26):** `useDebouncedValue.ts` now exports **`ADMIN_PICKER_DEBOUNCE_MS`**, **`ADMIN_MODAL_DEBOUNCE_MS`**, and **`NOTE_FULLTEXT_DEBOUNCE_MS`**. Admin list pickers, the media picker modal, GEDCOM place/date suggestion inputs, note search, and tag/album debouncing in `useMediaEditorLinks` use these constants instead of scattered literals.

**Exit criteria:** No user-visible change; ESLint/TS clean on touched files.

---

### Phase 2 — Decompose mega-forms (highest ROI)

#### 2A — `MediaEditorForm` (good pilot)

- Split **one tab panel per file**: File, Individuals, Families, Events, Places, Dates, Organisation.
- Extract **`useMediaEditorLinks`** (or per-domain mini-hooks) for: staged vs persisted, `postJson` / `deleteJson`, `invalidateQueries`, error surface.
- Optional shared presentational: **`MediaLinkSection`** (description + pills + `MEDIA_TREE_PICKER_CARD_CLASS` wrapper).

**Progress (2026-04-25):** `MediaEditorForm` is now further thinned by extracting save orchestration to
**`src/hooks/useMediaEditorSubmit.ts`** (create/update payload, staged-link persistence on create,
query invalidation, and route/navigation behavior), keeping UI composition in the form component.
`useMediaEditorLinks` is also now internally decomposed with an organisation-slice mini-hook that owns
tags/albums state, debounced search/query wiring, and add/remove/create flows.
Added a second internal mini-hook for entity links (individuals/families/events), including staged link
state, picker-scope fields, and link/unlink orchestration.
Added a third internal mini-hook for place/date links (draft slices, staged rows, create-mode pending
payloads, and link/unlink orchestration).
**Implementation location:** `useMediaEditorLinks` now lives at **`src/hooks/useMediaEditorLinks.ts`**; the prior
path **`src/components/admin/media-editor/useMediaEditorLinks.ts`** re-exports it for compatibility.

**Exit criteria:** `MediaEditorForm.tsx` becomes a thin composer; behavior and routes unchanged.

#### 2B — `FamilyEditForm`

- Split by domain (marriage, children, events, media, notes, …) mirroring 2A.
- **`useFamilyEditorState`** (or slices) owns PATCH orchestration.

**Progress (2026-04-24):** Completed internal decomposition of
**`src/hooks/useFamilyEditorState.ts`** into focused internal slices
(`useFamilyEditorData`, `useFamilyEditorEventsState`, `useFamilyMarriageDivorceState`,
`useFamilyMemberPanelsState`) while preserving the existing public return contract consumed by
`FamilyEditForm` and tab panels.

#### 2C — `IndividualEditForm` (largest)

- Vertical slices: names, spouse families, child-of families, events, media, notes, etc.
- Keep **`lib/forms/individual-editor-form.ts`** focused on **serialization / validation**; move sprawling UI-only helpers next to sections or under `src/hooks/individual-editor/`.
- Introduce **`useIndividualEditorState`** (or multiple hooks) so the root component mostly wires tabs + layout.

**Progress (2026-04-24):** Started with low-risk slices:
- submit validation extraction to **`lib/forms/individual-editor-submit-validators.ts`**
- user-link orchestration extraction to **`src/hooks/useIndividualEditorUserLinks.ts`**
- create/update submit workflow extraction to **`src/hooks/useIndividualEditorSubmit.ts`**
- **`useIndividualEditorFormState.ts`** internally split into **`useIndividualEditorUiState`**, **`useIndividualEditorEventsState`**, and **`useIndividualEditorDerivedState`** (same-file, non-exported) while preserving the public return shape for `IndividualEditForm` and tab panels.
- spouse/child family search enrichment (family fetch + row hydration) moved out of tab panels into hook callbacks on **`useIndividualEditorFormState.ts`** so tab panels stay presentation-first.
- extracted edit-only relation joins (`individualNotes`, `individualMedia`, `individualSources`, `linkedMediaIds`) into **`src/hooks/useIndividualEditorInitialJoins.ts`**, further thinning `IndividualEditForm`.
- added focused unit coverage for initial-join derivation in **`src/hooks/__tests__/useIndividualEditorInitialJoins.test.ts`**.
- `IndividualEditForm` now delegates those concerns and is slimmer without behavior/route changes.

**Exit criteria:** No route or API contract change; incremental PRs per tab or domain slice.

---

### Phase 3 — API and domain consistency

| # | Task | Outcome |
|---|------|---------|
| 3.1 | Internal **media junction contract** doc (or module comment block): accepted bodies (`place` vs `placeId`, `date` vs `dateId`), status codes, cascade vs explicit `deleteMany`. | Easier onboarding; fewer 409/404 surprises. |
| 3.2 | **Changelog policy** for link create/delete (if not already uniform) — decide and implement once. | Auditable admin actions. **Done** (2026-04-24). |
| 3.3 | Reconcile **Prisma `onDelete` cascades** vs explicit junction `deleteMany` on media delete — single source of truth. | Less redundant SQL and fewer drift bugs. **Done** (2026-04-24): media `DELETE` uses DB cascades only; see `schema.prisma` `GedcomMedia` relations + `media/[id]/route.ts`. |

---

### Phase 4 — List pages and DataViewer consumers

- Extract **filter + query option builders** from large pages (e.g. `src/app/admin/media/page.tsx`) into **`useAdmin*PageFilters`** hooks.
- If multiple resources share the same skeleton (title, `FilterPanel`, `DataViewer`, export), consider a **thin template** — only if duplication is obvious after 2–3 pages.

| # | Task | Outcome |
|---|------|---------|
| 4.1 | **`useAdminMediaPageFilters`** + slimmer media list page. | Media filters + query opts in one hook. |
| 4.2 | **`useAdminListQFilters`** on catalog **`q`** lists. | Tags, albums, places, dates, given names, surnames. |
| 4.3 | More hooks + **`q`** on users/sources; **families** / **notes** filter hooks. | `useAdminFamiliesPageFilters`, `useAdminNotesPageFilters`. |
| 4.4 | **`AdminListPageShell`** — shared title / description / optional filters / children layout. | `src/components/admin/AdminListPageShell.tsx`; wired on catalog pages, notes, users, sources, families, changelog. |

**Also:** Individuals / events keep URL-synced filters in **`lib/admin/admin-*-url-filters`** + page `useLayoutEffect`. **Media** list keeps its custom header + upload strip (no shell yet).

---

### Phase 5 — Types and dependency direction

- Move **hook-defined list types** consumed by `lib/` into **`lib/types/`** (or `packages/shared-types` if you later extract) and have hooks re-export from there — **not** the other way around.
- Keep **`@ligneous/prisma`** types on the server edge; client types stay DTO-shaped where needed.

---

### Phase 6 — Tests (after slices stabilize)

- **Vitest** for pure functions: search `where` builders (`gedcom-place-search-where`, `gedcom-date-search-where`, `admin-notes-filter`), `keyFactToApiValue`, `media-link-payloads`, etc.
- Optional **Playwright** smoke: one path through media editor and one through individual edit after Phase 2C milestones.

---

## 5. Suggested sequencing

1. **Phase 1** — small PRs, immediate consistency.  
2. **Phase 2A (`MediaEditorForm`)** — practice decomposition before the largest file.  
3. **Phase 2B / 2C** — family then individual (or individual first if business priority demands).  
4. **Phases 3–5** in parallel with form work whenever those files are touched.  
5. **Phase 6** once public APIs of extracted hooks are stable.

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| Big-bang rewrite of `IndividualEditForm` | **Extract + re-wire**; keep props boundaries stable; PR per slice. |
| React Query cache fragmentation | Centralize **`ADMIN_*_QUERY_KEY`** and invalidation in extracted hooks. |
| Regression in admin tree scoping | Preserve **`getAdminFileUuid()`** assumptions in every extracted code path. |

---

## 7. Non-goals (this plan)

- Replacing **DataViewer** or the UI kit.
- **Prisma / GEDCOM schema** migrations unless a separate project is approved.
- **i18n** or full **design-system** refresh unless explicitly scoped later.

---

## 8. Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-24 | Initial plan from codebase review. |
| 1.1 | 2026-04-24 | Phase **3.1**: media junction contract module `src/lib/admin/media-junction-api.ts`. Phase **4** (starter): `src/hooks/useAdminMediaPageFilters.ts` + slimmer `src/app/admin/media/page.tsx`. |
| 1.2 | 2026-04-24 | Phase **3.2** complete: junction `POST`/`DELETE` changelog (`lib/admin/media-junction-changelog.ts`, routes under `api/admin/media/[id]/…`). Phase **3.3** complete: `api/admin/media/[id]` `DELETE` drops redundant junction `deleteMany`; junction cleanup is **`onDelete: Cascade`** on `GedcomMedia` relations in `packages/ligneous-prisma/prisma/schema.prisma` only. |
| 1.3 | 2026-04-24 | Phase **4**: **`useAdminListQFilters`** (`src/hooks/useAdminListQFilters.ts`) — draft/applied `q`, `queryOpts` for `ADMIN_LIST_MAX_LIMIT` list hooks; wired on **tags**, **albums**, **places**, **dates**, **given-names**, **surnames** admin pages. |
| 1.4 | 2026-04-24 | Phase **4** (more): **`useAdminListQFilters`** on **users** + **sources**; **`useAdminFamiliesPageFilters`**, **`useAdminNotesPageFilters`**. |
| 1.5 | 2026-04-24 | Phase **4.4**: **`AdminListPageShell`** (`src/components/admin/AdminListPageShell.tsx`); plan §4 sub-table **4.1–4.4** documents Phase 4 slices. |
| 1.6 | 2026-04-24 | Phase **2B** internal split done in `useFamilyEditorState` (slice hooks, same external contract). Phase **2C** started: extracted submit validators, user-link orchestration, and submit workflow into dedicated modules/hooks; `IndividualEditForm` is thinner. |

Future updates: append rows to §8 or add dated sections instead of rewriting history.
