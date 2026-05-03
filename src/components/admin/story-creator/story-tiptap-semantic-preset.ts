import type { Editor } from "@tiptap/core";
import type { StoryRichTextTextPreset } from "@/lib/admin/story-creator/story-types";

const semanticByEditor = new WeakMap<Editor, StoryRichTextTextPreset>();

/** Lets the shared toolbar hide list toggles when the block is already a semantic list preset. */
export function bindStoryEditorSemanticPreset(editor: Editor, preset: StoryRichTextTextPreset): void {
  semanticByEditor.set(editor, preset);
}

export function unbindStoryEditorSemanticPreset(editor: Editor): void {
  semanticByEditor.delete(editor);
}

export function getStoryEditorSemanticPreset(editor: Editor): StoryRichTextTextPreset | undefined {
  return semanticByEditor.get(editor);
}
