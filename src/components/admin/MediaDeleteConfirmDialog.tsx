"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export type MediaDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Primary line, e.g. note title or filename */
  mediaLabel: string;
  /** Scope-specific warning (GEDCOM vs site vs user media) */
  detail: string;
  /** Perform delete + any follow-up (invalidate, navigate, toast). Must throw on failure. */
  onDelete: () => Promise<void>;
};

/**
 * Confirms media deletion and shows progress while the delete request runs.
 * Blocks dismiss (backdrop / escape) until the request finishes so mobile users don’t lose the flow.
 */
export function MediaDeleteConfirmDialog({
  open,
  onOpenChange,
  mediaLabel,
  detail,
  onDelete,
}: MediaDeleteConfirmDialogProps) {
  const [phase, setPhase] = useState<"confirm" | "deleting">("confirm");
  const [error, setError] = useState<string | null>(null);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setError(null);
      deletingRef.current = false;
    }
  }, [open]);

  const guardedOpenChange = (next: boolean, ..._rest: unknown[]) => {
    if (!next && deletingRef.current) return;
    onOpenChange(next);
  };

  const runDelete = async () => {
    deletingRef.current = true;
    setPhase("deleting");
    setError(null);
    try {
      await onDelete();
      deletingRef.current = false;
      onOpenChange(false);
    } catch (e) {
      deletingRef.current = false;
      setPhase("confirm");
      const msg = e instanceof Error ? e.message : "Delete failed";
      setError(msg);
      toast.error(`Failed to delete: ${msg}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={guardedOpenChange}>
      <DialogContent className="max-w-md">
        <DialogTitle>Delete this media?</DialogTitle>
        <DialogDescription>
          <span className="font-medium text-foreground">“{mediaLabel}”</span> will be removed. {detail} This cannot be
          undone.
        </DialogDescription>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {phase === "deleting" ? (
          <div className="space-y-2 pt-1">
            <p className="text-sm font-medium text-foreground">Deleting…</p>
            <div
              className="relative h-2 w-full overflow-hidden rounded-full bg-base-300"
              role="progressbar"
              aria-valuetext="Deleting media"
              aria-busy="true"
            >
              <div className="admin-media-delete-progress-strip absolute top-0 h-full w-[38%] rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Please keep this page open until we finish.</p>
          </div>
        ) : null}

        <DialogFooter className={phase === "deleting" ? "hidden" : undefined}>
          <Button type="button" variant="outline" onClick={() => guardedOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={() => void runDelete()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
