"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { History, Undo2, Clock, User, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useEntityHistory,
  useUndoBatch,
  type ChangelogBatch,
} from "@/hooks/useChangelog";
import { UndoConfirmDialog } from "@/components/admin/UndoConfirmDialog";

const OP_COLORS: Record<string, string> = {
  create: "text-green-400",
  update: "text-blue-400",
  delete: "text-red-400",
  link: "text-purple-400",
  unlink: "text-orange-400",
};

interface EntityHistoryCardProps {
  entityType: string;
  entityId: string;
}

export function EntityHistoryCard({ entityType, entityId }: EntityHistoryCardProps) {
  const { data, isLoading } = useEntityHistory(entityType, entityId);
  const undoMutation = useUndoBatch();
  const [undoTarget, setUndoTarget] = useState<ChangelogBatch | null>(null);

  const handleUndoConfirm = useCallback(() => {
    if (!undoTarget) return;
    undoMutation.mutate(undoTarget.batchId, {
      onSuccess: () => {
        toast.success("Change undone successfully.");
        setUndoTarget(null);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Undo failed: ${msg}`);
      },
    });
  }, [undoTarget, undoMutation]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const batches = data?.batches ?? [];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="size-4" />
              History
            </CardTitle>
            <Link
              href={`/admin/changelog?entityType=${entityType}&entityId=${entityId}`}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No changes recorded.</p>
          ) : (
            <div className="space-y-3">
              {batches.slice(0, 10).map((batch) => (
                <div
                  key={batch.batchId}
                  className="flex items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Link
                      href={`/admin/changelog/${batch.batchId}`}
                      className="block text-sm font-medium leading-snug hover:underline line-clamp-2"
                    >
                      {batch.summary ?? "Change"}
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {batch.userName ?? batch.username}
                      </span>
                      {batch.operations.map((op) => (
                        <span key={op} className={`font-medium ${OP_COLORS[op] ?? ""}`}>
                          {op}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => setUndoTarget(batch)}
                  >
                    <Undo2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              {batches.length > 10 && (
                <p className="text-xs text-muted-foreground">
                  + {batches.length - 10} more change(s)
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <UndoConfirmDialog
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        onConfirm={handleUndoConfirm}
        summary={undoTarget?.summary ?? ""}
        isPending={undoMutation.isPending}
      />
    </>
  );
}
