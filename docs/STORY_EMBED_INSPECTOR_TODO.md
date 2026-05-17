# Story embed inspector — audit & improvement todo

All items are in `OtherEmbedInspector` inside
`src/components/admin/story-creator/StoryCreatorInspector.tsx`.

---

## New picker components needed first

These need to exist before the gallery and other fixes can land.

- [ ] **TagsPicker** — standalone reusable component. Search input → dropdown
  with color swatch → selected pills with remove. "Create tag" option when no
  exact match. Pattern: tag attachment in `MediaEditorForm.tsx`.
- [ ] **AlbumsPicker** — same shape as TagsPicker but for albums.
- [ ] **EventPicker → modal** — replace the inline heavy form (8 state vars,
  multiple name fields) with a compact trigger button that opens a modal dialog.
  Applies to both the map embed and the event embed.

---

## Audit items

### Shared "Source" section (all embed types)

- [ ] **Embed type dropdown** — replace raw camelCase slug option text with
  readable labels (`personSpotlight` → "Person spotlight", `familyGroup` →
  "Family group", `gallery` → "Photo gallery", etc.).
- [ ] **Preview card subtitle** — shows raw `embedKind` slug; use the same
  readable label map.

### "Preview behavior" section

- [ ] **"Chrome" label** — developer term; rename to "Frame style" or
  "Presentation".
- [ ] **Chrome buttons** — buttons render raw values (`none`, `minimal`,
  `full`); give them readable labels ("No frame", "Minimal", "Full").

### Tree embed

- [ ] **Chart type select** — options show raw slugs (`pedigree`,
  `verticalPedigree`, `descendancy`, `fan`); replace with "Pedigree",
  "Vertical pedigree", "Descendants", "Fan chart".

### PersonSpotlight embed

- [ ] **Fields to render — checkbox labels** — raw field names (`profileImage`,
  `birthDate`, `lifespan`, etc.); replace with "Profile photo", "Birth date",
  "Lifespan", etc.
- [ ] **Custom fields JSON textarea** — naked JSON editor; hide behind an
  "Advanced" collapsible and add a format hint.

### Gallery embed

- [ ] **Source type select** — options show raw slugs (`personMedia`,
  `familyMedia`, `eventMedia`, `tag`); replace with "Person's photos", "Family
  photos", "Event photos", "Tagged photos", "Custom selection".
- [ ] **Source ID input** — bare text input; replace with a context-sensitive
  picker that changes based on source type (AlbumsPicker for `album`,
  IndividualSearchPicker for `personMedia`, FamilySearchPicker for
  `familyMedia`, EventPicker modal for `eventMedia`, TagsPicker for `tag`).
- [ ] **Source label input** — bare text input with no explanation; add helper
  text or auto-populate from the picker result.

### Map embed

- [ ] **Map mode select** — options show raw slugs (`lifeRoute`,
  `familyMigration`); replace with "Life route", "Family migration".
- [ ] **EventPicker inline** — replace with modal trigger; depends on EventPicker
  modal task above.
- [ ] **"Selected event IDs" textarea** — raw UUID list; replace with
  event-name chips, each removable.

### Event embed

- [ ] **EventPicker inline** — same modal refactor as map embed; add an
  empty-state message when no event is selected.

### Fallback "Semantic source" section

- [ ] **Developer-facing copy and bare inputs** — rewrite section title and
  description in plain language; add field hints for Source ID and Source label.
