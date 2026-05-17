# EventsListPicker — design plan

Tracks the design decisions and implementation plan for the composite event source
selector that will replace the single-source `sourceType` field in
`StoryTimelineEmbedData`.

---

## Problem

The current timeline inspector offers a single source selector: one person, one
family, one note, a hand-picked list, or a custom ID. Real timelines require
composite event sets that cannot be expressed as a single source.

---

## Two primary use cases

### Life timeline (person-centric)
1. All events linked directly to person X
2. All events linked directly to every family where person X is a spouse
3. Birth and death events only for person X's parents, siblings, children, and grandchildren

### Family timeline (family-centric)
1. All events linked directly to family Y
2. All events linked directly to every member of family Y (each spouse, each child)

---

## Design principles

### Rules and filters
- A **rule** generates a set of events from the tree data.
- A **filter** reduces a set of events based on a criterion (date range, event type).
- The final event set is the **union** of all rule outputs (UNION, not UNION ALL — duplicates are excluded by definition).

### Two filter levels
- **Local filters** — applied per-rule, before merging. Narrow what a specific rule contributes.
- **Global filters** — applied to the merged union. Narrow the entire output regardless of source.

### No recursion in the schema
All rule types are atomic. The renderer executes each rule directly against the
tree data; no rule references another rule or composed rule set. The family
timeline does not embed life timelines — it uses its own flat set of atomic
rules. This covers the real use cases without needing recursive rule references.

---

## Atomic rule types

| Rule type | Parameters | Produces |
|---|---|---|
| `personEvents` | `personId` | All events linked directly to that person |
| `familyEvents` | `familyId` | All events linked directly to that family |
| `memberEvents` | `familyId` | All direct events for every member of that family (each spouse, each child) |
| `relativeEvents` | `personId`, `relationships[]`, `eventTypes[]` | Events of the specified types for the specified relationship tiers |

**`relativeEvents` — `relationships` values:**
`parents` · `siblings` · `children` · `grandchildren`

**`relativeEvents` — typical `eventTypes` for the life timeline use case:**
`BIRT` · `DEAT`

---

## JSON schema shape (simplified SQL semantics)

Each rule is a SELECT. Composition is UNION. Filters are WHERE clauses.

Conceptually:
```
( SELECT events FROM personEvents   WHERE personId = X AND local_filter )
UNION
( SELECT events FROM familyEvents   WHERE familyId = Y AND local_filter )
UNION
( SELECT events FROM relativeEvents WHERE personId = X AND relationships IN (...) AND local_filter )
WHERE global_filter
ORDER BY date
```

### `StoryTimelineEmbedData` — new shape (sketch)

```ts
type EventRule =
  | { kind: "personEvents";   personId: string;  personLabel?: string;  filters?: RuleFilters }
  | { kind: "familyEvents";   familyId: string;  familyLabel?: string;  filters?: RuleFilters }
  | { kind: "memberEvents";   familyId: string;  familyLabel?: string;  filters?: RuleFilters }
  | { kind: "relativeEvents"; personId: string;  personLabel?: string;
      relationships: ("parents" | "siblings" | "children" | "grandchildren")[];
      filters?: RuleFilters }

type RuleFilters = {
  eventTypes?: string[];   // e.g. ["BIRT", "DEAT"]
  startYear?:  number;
  endYear?:    number;
}

type GlobalFilters = {
  eventTypes?: string[];
  startYear?:  number;
  endYear?:    number;
  includeUndated?: boolean;
}

type StoryTimelineEmbedData = {
  rules:          EventRule[];
  globalFilters?: GlobalFilters;
}
```

---

## Preview renderer resolution algorithm

The StoryCreator preview renderer is one renderer among many. Other renderers
may resolve rules differently. The preview renderer should:

### Phase 1 — Collection
Maintain a **visited set of event IDs**. For each rule in order:
1. Execute the rule against tree data to get a candidate event list.
2. Push each candidate onto the processing stack if its ID is not already in the visited set.
3. Process each event off the stack. When fully processed, mark its ID visited.

The visited set handles both **deduplication** (same event from two rules) and
**cycle safety** (if the same event is reachable via multiple paths, it is only
processed once).

### Phase 2 — Ordering
Sort the collected event pool by date ascending. Undated events: position TBD
(likely end of list; expose as a renderer option).

### Phase 3 — Local filters
Apply each rule's `filters` to that rule's own event output before it enters
the pool. (Implemented during Phase 1 — filter before pushing onto the stack.)

### Phase 4 — Global filters
Apply `globalFilters` to the fully merged, ordered pool:
1. Date range (`startYear` / `endYear`)
2. Event type (`eventTypes`)
3. Undated events (`includeUndated`)

---

## Implementation order

1. **Update `StoryTimelineEmbedData`** in `story-types.ts` — replace `sourceType`
   / `sourceId` / `eventIds` flat fields with `rules[]` + `globalFilters`.
2. **Build `EventsListPicker`** component — rule list UI with add/remove, per-rule
   pickers and filter controls.
3. **Wire into `StoryTimelineEmbedInspector`** — replace the current "Timeline
   source" section with `EventsListPicker`.
4. **Implement preview renderer resolution** — Phase 1–4 algorithm above.
5. **Migration** — handle existing `StoryTimelineEmbedData` drafts that still use
   the old `sourceType` flat shape.
