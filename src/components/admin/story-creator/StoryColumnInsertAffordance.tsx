"use client";

import type { StoryAddBlockPresetId } from "@/lib/admin/story-creator/story-block-presets";
import { StoryEmptySlotAddBlockMenu } from "@/components/admin/story-creator/StoryEmptySlotAddBlockMenu";

/** Centered “Add block” menu for empty column slots and empty nested containers (no dashed + row). */
export function StoryColumnInsertAffordance({
  mobile,
  allowNestedColumns,
  onInsert,
}: {
  mobile?: boolean;
  /** When false, Columns is disabled with helper copy (max nesting depth). */
  allowNestedColumns: boolean;
  onInsert: (presetId: StoryAddBlockPresetId) => void;
}) {
  return (
    <StoryEmptySlotAddBlockMenu
      mobile={mobile}
      allowNestedColumns={allowNestedColumns}
      onInsert={onInsert}
      surface="paper"
      density="comfortable"
      includeDivider={false}
    />
  );
}
