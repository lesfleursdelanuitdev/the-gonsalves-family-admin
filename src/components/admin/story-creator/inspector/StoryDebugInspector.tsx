"use client";

import { useMemo } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { StoryBlock, StoryDocument } from "@/lib/admin/story-creator/story-types";
import { storyDocumentWithSaveTimestamp } from "@/lib/admin/story-creator/story-storage";
import { Button } from "@/components/ui/button";

export function StoryDebugInspector({
  doc,
  selectedBlockId,
  selectedBlock,
  storyEditorDirty,
}: {
  doc: StoryDocument;
  selectedBlockId: string | null;
  selectedBlock: StoryBlock | null;
  storyEditorDirty: boolean;
}) {
  const payload = useMemo(
    () => ({
      summary: {
        storyId: doc.id,
        schemaVersion: doc.version,
        documentUpdatedAt: doc.updatedAt,
        selectedBlockId,
        selectedBlockType: selectedBlock?.type ?? null,
        dirtyVersusLastLocalSave: storyEditorDirty,
        validationErrors: null,
      },
      documentInMemory: doc,
      localStorageSavePayloadPreview: storyDocumentWithSaveTimestamp(doc),
    }),
    [doc, selectedBlockId, selectedBlock, storyEditorDirty],
  );

  const jsonText = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const copyJson = () => {
    void navigator.clipboard.writeText(jsonText).then(
      () => toast.success("Copied debug JSON"),
      () => toast.error("Could not copy to clipboard"),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <p className="text-xs leading-relaxed text-base-content/55">
        Read-only developer view. <span className="font-medium text-base-content/75">documentInMemory</span> is the live
        editor state; <span className="font-medium text-base-content/75">localStorageSavePayloadPreview</span> matches the
        JSON persisted by <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">saveStoryDocument</code>{" "}
        (a new <code className="rounded bg-base-200/80 px-1 font-mono text-[10px]">updatedAt</code> is applied on each save).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-2 font-medium" onClick={copyJson}>
          <Copy className="size-3.5 opacity-80" aria-hidden />
          Copy JSON
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-base-content/45">Combined payload</p>
        <pre className="max-h-[min(55vh,520px)] min-h-[200px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-base-content/12 bg-base-300/25 p-3 font-mono text-[11px] leading-relaxed text-base-content/90">
          {jsonText}
        </pre>
      </div>
    </div>
  );
}

