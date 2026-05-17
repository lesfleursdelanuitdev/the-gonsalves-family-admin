# Story embed inspector — updates plan

Tracks remaining improvements to the embed inspector panels after the initial
audit pass. Items here are scoped, ordered, and ready to implement.

---

## 1. Timeline embed inspector (StoryTimelineEmbedInspector.tsx)

The timeline inspector was not touched in the first audit pass. It has the same
class of raw-slug / dev-facing issues as `OtherEmbedInspector`.

### 1a. Source type segment buttons
**File:** `inspector/StoryTimelineEmbedInspector.tsx` · line ~220
**Problem:** Buttons render raw `SOURCE_TYPES` array values as their label text.
```
personEvents  familyEvents  noteEvents  selectedEvents  storyEvents  custom
```
**Fix:** Add a `SOURCE_TYPE_LABELS` map and render friendly labels:
| Slug | Label |
|---|---|
| `personEvents` | Person's events |
| `familyEvents` | Family events |
| `noteEvents` | Research note |
| `selectedEvents` | Selected events |
| `storyEvents` | Story events |
| `custom` | Custom |

### 1b. Timeline mode segment buttons
**File:** `inspector/StoryTimelineEmbedInspector.tsx` · line ~324
**Problem:** Buttons render raw `TIMELINE_MODES` values.
```
life  family  note  story  custom
```
**Fix:** Add a `TIMELINE_MODE_LABELS` map:
| Slug | Label |
|---|---|
| `life` | Life |
| `family` | Family |
| `note` | Note |
| `story` | Story |
| `custom` | Custom |

### 1c. "Chrome" label → "Frame style"
**File:** `inspector/StoryTimelineEmbedInspector.tsx` · line ~369
**Problem:** Same `Chrome` field label as was fixed in `OtherEmbedInspector`.
**Fix:** Rename to "Frame style". Use same readable button labels ("No frame",
"Minimal", "Full") as `OtherEmbedInspector`.

### 1d. "Selected event IDs" textarea → EventPickerModal + chips
**File:** `inspector/StoryTimelineEmbedInspector.tsx` · line ~290
**Problem:** When `sourceType === "selectedEvents"`, a raw monospace textarea
of event UUIDs is shown. Same pattern fixed in the map embed.
**Fix:** Replace with `EventPickerModal` trigger + removable chips showing event
names. Store event labels in `data.eventLabels` (same pattern as map embed —
`StoryTimelineEmbedData` needs `eventLabels?: Record<string, string>` added).

### 1e. "Source label" → "Display label" (custom source type)
**File:** `inspector/StoryTimelineEmbedInspector.tsx` · line ~310
**Problem:** "Source label" has no explanation; "Source ID" has no placeholder.
**Fix:** Rename to "Display label", add placeholder text to both inputs, same
as the `custom` fallback in `OtherEmbedInspector`.

---

## 2. OtherEmbedInspector remaining items

Items from the first audit that were left out of scope or deferred.

### 2a. Gallery embed — source type change clears picker correctly
**Status:** Implemented. When `sourceType` changes, `sourceId` and `sourceLabel`
are cleared. Verify this also resets any lingering local state in the pickers.

### 2b. Limit input hint for gallery
**Status:** Implemented ("Maximum photos to display. Leave blank for renderer
default."). No further action needed.

---

## 3. Shared "Preview behavior" consistency check

Both `OtherEmbedInspector` and `StoryTimelineEmbedInspector` have a
"Preview behavior" / Chrome section. After fixing 1c above, verify both
use identical label text and button labels so the UX is consistent.

---

## Implementation order

1. Add `eventLabels` to `StoryTimelineEmbedData` in `story-types.ts`
2. Fix `StoryTimelineEmbedInspector.tsx` — items 1a through 1e in order
3. Verify "Preview behavior" consistency (item 3)
