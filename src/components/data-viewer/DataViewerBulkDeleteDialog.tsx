"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export type DataViewerBulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lowercase plural label, e.g. "individuals" */
  pluralEntityLabel: string;
  selectedCount: number;
  onConfirm: () => Promise<void>;
  /**
   * When the parent runs sequential deletes, it updates this between items.
   * `completed` is how many have finished (0 … total).
   */
  deleteProgress: { completed: number; total: number } | null;
};

/**
 * Confirms deleting all currently selected DataViewer rows. Invoked by {@link DataViewer} when the user
 * chooses “Delete selected” from the selection bar.
 */
export function DataViewerBulkDeleteDialog({
  open,
  onOpenChange,
  pluralEntityLabel,
  selectedCount,
  onConfirm,
  deleteProgress,
}: DataViewerBulkDeleteDialogProps) {
  const [phase, setPhase] = useState<"confirm" | "deleting">("confirm");
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setError(null);
      busyRef.current = false;
    }
  }, [open]);

  const guardedOpenChange = (next: boolean) => {
    if (!next && busyRef.current) return;
    onOpenChange(next);
  };

  const run = async () => {
    busyRef.current = true;
    setPhase("deleting");
    setError(null);
    try {
      await onConfirm();
      busyRef.current = false;
      onOpenChange(false);
    } catch (e) {
      busyRef.current = false;
      setPhase("confirm");
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const showDeterminate =
    phase === "deleting" &&
    deleteProgress != null &&
    deleteProgress.total > 0 &&
    deleteProgress.completed <= deleteProgress.total;
  const pct = showDeterminate
    ? Math.min(100, Math.round((deleteProgress!.completed / deleteProgress!.total) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Delete selected {pluralEntityLabel}?</DialogTitle>
        <DialogDescription>
          You are about to permanently delete{" "}
          <span className="font-semibold text-foreground">{selectedCount}</span>{" "}
          {selectedCount === 1 ? "item" : "items"}. This cannot be undone.
        </DialogDescription>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {phase === "deleting" ? (
          <div className="space-y-2 pt-1">
            {showDeterminate ? (
              <>
                <p className="text-sm font-medium text-foreground">
                  Deleting {deleteProgress!.completed} of {deleteProgress!.total}…
                </p>
                <div
                  className="relative h-2 w-full overflow-hidden rounded-full bg-base-300"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuetext={`${deleteProgress!.completed} of ${deleteProgress!.total}`}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">Deleting…</p>
                <div
                  className="relative h-2 w-full overflow-hidden rounded-full bg-base-300"
                  role="progressbar"
                  aria-valuetext="Deleting"
                  aria-busy="true"
                >
                  <div className="admin-media-delete-progress-strip absolute top-0 h-full w-[38%] rounded-full bg-primary" />
                </div>
              </>
            )}
            <p className="text-xs text-muted-foreground">Please keep this page open until we finish.</p>
          </div>
        ) : null}
        <DialogFooter className={phase === "deleting" ? "hidden" : "gap-2 sm:gap-0"}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={phase === "deleting"}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void run()}
            disabled={phase === "deleting" || selectedCount < 1}
            className="gap-2"
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
