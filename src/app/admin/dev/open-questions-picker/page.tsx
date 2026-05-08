"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { OpenQuestionsPicker } from "@/components/admin/OpenQuestionsPicker";
import type { AdminOpenQuestionListItem } from "@/hooks/useAdminOpenQuestions";

export default function AdminDevOpenQuestionsPickerPage() {
  const [lastPick, setLastPick] = useState<AdminOpenQuestionListItem | null>(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set<string>());

  const onPick = useCallback((oq: AdminOpenQuestionListItem) => {
    setLastPick(oq);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const id = String((oq as Record<string, unknown>).id ?? "");
      if (id) next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <Link href="/admin/open-questions" className="text-sm text-primary underline-offset-2 hover:underline">
          ← Open Questions
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-base-content">OpenQuestionsPicker (dev)</h1>
        <p className="text-sm text-muted-foreground">
          Exercise <code className="rounded bg-base-300/40 px-1">OpenQuestionsPicker</code>: status + question text or
          linked-entity filters using the same pickers as notes.
        </p>
      </div>

      <OpenQuestionsPicker selectedIds={selectedIds} onPick={onPick} />

      <div className="space-y-2 rounded-lg border border-base-content/12 bg-base-content/[0.03] p-4">
        <p className="text-sm font-medium text-base-content">Last pick</p>
        {lastPick ? (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
            {JSON.stringify(
              {
                id: (lastPick as Record<string, unknown>).id,
                question: (lastPick as Record<string, unknown>).question,
                status: (lastPick as Record<string, unknown>).status,
              },
              null,
              2,
            )}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">None yet — use &quot;Select&quot; on a result.</p>
        )}
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={() => {
            setLastPick(null);
            setSelectedIds(new Set());
          }}
        >
          Clear selection state
        </button>
      </div>
    </div>
  );
}
