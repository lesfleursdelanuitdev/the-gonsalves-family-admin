"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Columns2, ImageIcon, LayoutTemplate, Minus, Type } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StoryColumnNestedInsertKind, StoryInsertKind } from "@/lib/admin/story-creator/story-block-factory";

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
  onAddComplete: (position: "above" | "below", kind: StoryInsertKind | StoryColumnNestedInsertKind) => void;
  onDuplicateComplete: (position: "above" | "below") => void;
}

export function StoryBlockPlacementDialog({
  open,
  onOpenChange,
  flow,
  variant,
  allowNestedColumns,
  onAddComplete,
  onDuplicateComplete,
}: StoryBlockPlacementDialogProps) {
  const [step, setStep] = useState<Step>("position");
  const [addPosition, setAddPosition] = useState<"above" | "below" | null>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep("position");
    setAddPosition(null);
    const t = window.setTimeout(() => firstActionRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, flow]);

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

  const typeButtonClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "h-11 w-full justify-start gap-2 rounded-xl border-base-content/15 px-3 text-sm font-medium lg:h-10 lg:rounded-lg",
  );

  const handleAddType = (kind: StoryInsertKind | StoryColumnNestedInsertKind) => {
    if (!addPosition) return;
    onAddComplete(addPosition, kind);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-md border-base-content/12 bg-base-100 p-5 shadow-xl ring-1 ring-base-content/[0.06]",
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
            <div className="grid gap-2">
              <button type="button" className={typeButtonClass} onClick={() => handleAddType("richText")}>
                <Type className="size-4 opacity-80" aria-hidden />
                Text
              </button>
              <button type="button" className={typeButtonClass} onClick={() => handleAddType("media")}>
                <ImageIcon className="size-4 opacity-80" aria-hidden />
                Media
              </button>
              <button type="button" className={typeButtonClass} onClick={() => handleAddType("embed")}>
                <Code2 className="size-4 opacity-80" aria-hidden />
                Embed
              </button>
              {(variant === "section" || variant === "container" || allowNestedColumns) && (
                <button type="button" className={typeButtonClass} onClick={() => handleAddType("columns")}>
                  <Columns2 className="size-4 opacity-80" aria-hidden />
                  Columns (2)
                </button>
              )}
              {(variant === "section" || variant === "container") && (
                <button type="button" className={typeButtonClass} onClick={() => handleAddType("container")}>
                  <LayoutTemplate className="size-4 opacity-80" aria-hidden />
                  Container
                </button>
              )}
              {(variant === "section" || variant === "container") && (
                <button type="button" className={typeButtonClass} onClick={() => handleAddType("divider")}>
                  <Minus className="size-4 opacity-80" aria-hidden />
                  Divider
                </button>
              )}
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
      </DialogContent>
    </Dialog>
  );
}
