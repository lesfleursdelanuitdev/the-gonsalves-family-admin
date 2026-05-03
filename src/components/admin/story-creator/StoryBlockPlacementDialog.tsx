"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogBackdrop,
  DialogDescription,
  DialogPortal,
  DialogPopup,
  DialogTitle,
  DialogViewport,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  STORY_ADD_BLOCK_PRESET_GROUPS,
  storyAddBlockPresetAllowedInColumnNested,
  type StoryAddBlockPresetId,
} from "@/lib/admin/story-creator/story-block-presets";
import { StoryAddBlockPresetTypeGrid } from "@/components/admin/story-creator/StoryAddBlockPresetTypeGrid";

export type StoryBlockPlacementFlow = "add" | "duplicate";
export type StoryBlockPlacementVariant = "section" | "column" | "container";

type Step = "position" | "type";

export interface StoryBlockPlacementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flow: StoryBlockPlacementFlow | null;
  variant: StoryBlockPlacementVariant;
  /** When `variant` is `column`, whether the Columns block type is offered. */
  allowNestedColumns: boolean;
  /** When set with `flow: "add"`, skip the position step and go straight to block type. */
  initialAddPosition?: "above" | "below" | null;
  /** When set, only these presets appear (e.g. split supporting rail). */
  presetAllowlist?: readonly StoryAddBlockPresetId[] | null;
  onAddComplete: (position: "above" | "below", presetId: StoryAddBlockPresetId) => void;
  onDuplicateComplete: (position: "above" | "below") => void;
}

export function StoryBlockPlacementDialog({
  open,
  onOpenChange,
  flow,
  variant,
  allowNestedColumns,
  initialAddPosition = null,
  presetAllowlist = null,
  onAddComplete,
  onDuplicateComplete,
}: StoryBlockPlacementDialogProps) {
  const [step, setStep] = useState<Step>("position");
  const [addPosition, setAddPosition] = useState<"above" | "below" | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  const presetGroups = useMemo(() => {
    const allow = presetAllowlist && presetAllowlist.length > 0 ? new Set(presetAllowlist) : null;
    return STORY_ADD_BLOCK_PRESET_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        if (allow && !allow.has(item.id)) return false;
        if (variant === "column") {
          if (!storyAddBlockPresetAllowedInColumnNested(item.id)) return false;
          if (item.id === "layout_columns" && !allowNestedColumns) return false;
        }
        return true;
      }),
    })).filter((g) => g.items.length > 0);
  }, [variant, allowNestedColumns, presetAllowlist]);

  useEffect(() => {
    if (!open) return;
    if (flow === "add" && initialAddPosition) {
      setStep("type");
      setAddPosition(initialAddPosition);
    } else {
      setStep("position");
      setAddPosition(null);
    }
    const t = window.setTimeout(() => firstActionRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, flow, initialAddPosition]);

  const title =
    flow === "add" ? "Add block" : flow === "duplicate" ? "Duplicate block" : "Block";

  const description =
    flow === "add"
      ? "Choose where to insert the new block, then pick a block type."
      : flow === "duplicate"
        ? "Choose where to place the duplicate relative to this block."
        : "";

  const positionButtonClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "h-11 w-full justify-center gap-2 rounded-xl border-base-content/15 text-sm font-medium lg:h-10 lg:rounded-lg",
  );

  const handleAddPreset = (presetId: StoryAddBlockPresetId) => {
    if (!addPosition) return;
    onAddComplete(addPosition, presetId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop className="z-[200]" />
        <DialogViewport className="fixed inset-0 z-[200] flex min-h-full w-full items-center justify-center p-4">
          <DialogPopup
            className={cn(
              "max-h-[min(90dvh,720px)] max-w-2xl overflow-y-auto border-base-content/12 bg-base-100 p-5 shadow-xl ring-1 ring-base-content/[0.06]",
              "data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
            )}
          >
            <DialogTitle className="font-heading text-lg text-base-content">{title}</DialogTitle>
            <DialogDescription className="text-sm text-base-content/65">{description}</DialogDescription>

            {flow === "duplicate" ? (
              <div className="mt-4 grid gap-2">
                <button
                  ref={firstActionRef}
                  type="button"
                  className={positionButtonClass}
                  onClick={() => onDuplicateComplete("above")}
                >
                  Above current block
                </button>
                <button type="button" className={positionButtonClass} onClick={() => onDuplicateComplete("below")}>
                  Below current block
                </button>
              </div>
            ) : flow === "add" && step === "position" ? (
              <div className="mt-4 grid gap-2">
                <button
                  ref={firstActionRef}
                  type="button"
                  className={positionButtonClass}
                  onClick={() => {
                    setAddPosition("above");
                    setStep("type");
                  }}
                >
                  Above current block
                </button>
                <button
                  type="button"
                  className={positionButtonClass}
                  onClick={() => {
                    setAddPosition("below");
                    setStep("type");
                  }}
                >
                  Below current block
                </button>
              </div>
            ) : flow === "add" && step === "type" ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">
                    Insert {addPosition === "above" ? "above" : "below"}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 rounded-lg px-2 text-xs font-medium"
                    onClick={() => {
                      setStep("position");
                      setAddPosition(null);
                    }}
                  >
                    Back
                  </Button>
                </div>
                <div className="max-h-[min(52dvh,420px)] overflow-y-auto pr-1">
                  <StoryAddBlockPresetTypeGrid groups={presetGroups} onPick={handleAddPreset} />
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end border-t border-base-content/10 pt-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-lg"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
            </div>
          </DialogPopup>
        </DialogViewport>
      </DialogPortal>
    </Dialog>
  );
}
