"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Undo2, Loader2 } from "lucide-react";

interface UndoConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  summary: string;
  isPending: boolean;
}

export function UndoConfirmDialog({
  open,
  onClose,
  onConfirm,
  summary,
  isPending,
}: UndoConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogTitle>Undo change</DialogTitle>
        <DialogDescription>
          This will revert the following change and all its sub-operations:
        </DialogDescription>
        <div className="my-3 rounded-md bg-muted/50 px-4 py-3 text-sm font-medium">
          {summary || "No summary"}
        </div>
        <p className="text-sm text-muted-foreground">
          A new changelog entry will be created recording the undo. This action can itself be
          undone later.
        </p>
        <DialogFooter>
          <DialogClose disabled={isPending}>Cancel</DialogClose>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Undo2 className="mr-1.5 size-4" />
            )}
            Confirm undo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
