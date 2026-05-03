"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StoryDocument, StorySection } from "@/lib/admin/story-creator/story-types";
import { sectionIsAncestorOf } from "@/lib/admin/story-creator/story-section-tree";

export type OutlineRenameTarget = { kind: "section"; id: string };

export function OutlineRenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const commit = useCallback(() => {
    if (cancelled.current) return;
    const v = (ref.current?.value ?? "").trim();
    onCommit(v.length > 0 ? v : initial);
  }, [initial, onCommit]);

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={initial}
      className="input input-bordered input-sm h-8 w-full min-w-0 rounded-md border-base-content/15 bg-base-100 px-2 text-sm font-medium text-base-content shadow-sm outline-none ring-primary/25 focus:ring-2"
      aria-label="Rename"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelled.current = true;
          onCancel();
        }
      }}
      onBlur={() => commit()}
    />
  );
}

type BranchProps = {
  doc: StoryDocument;
  parentId: string | null;
  sections: StorySection[];
  depth: number;
  activeSectionId: string | null;
  renameTarget: OutlineRenameTarget | null;
  draggedId: string | null;
  onSelectSection: (sectionId: string, firstBlockId: string | null) => void;
  onRenameTargetChange: (t: OutlineRenameTarget | null) => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onAddSectionAfter: (afterSectionId: string | null) => void;
  onAddChildSection: (parentSectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleCollapsed: (sectionId: string) => void;
  onMoveSection: (draggedId: string, newParentId: string | null, insertBeforeId: string | null) => void;
  setDraggedId: (id: string | null) => void;
  onToggleSectionChapter?: (sectionId: string, isChapter: boolean) => void;
};

function OutlineSectionBranch({
  doc,
  parentId,
  sections,
  depth,
  activeSectionId,
  renameTarget,
  draggedId,
  onSelectSection,
  onRenameTargetChange,
  onRenameSection,
  onAddSectionAfter,
  onAddChildSection,
  onDeleteSection,
  onToggleCollapsed,
  onMoveSection,
  setDraggedId,
  onToggleSectionChapter,
}: BranchProps) {
  const tryDrop = (dragged: string, beforeIndex: number) => {
    const insertBeforeId = beforeIndex >= sections.length ? null : sections[beforeIndex]!.id;
    if (insertBeforeId === dragged) return;
    if (parentId != null && sectionIsAncestorOf(doc.sections ?? [], dragged, parentId)) return;
    if (parentId === dragged) return;
    onMoveSection(dragged, parentId, insertBeforeId);
    setDraggedId(null);
  };

  return (
    <ul className={cn("space-y-0.5", depth > 0 && "mt-1 border-l border-base-content/10 pl-2")}>
      {sections.map((sec, si) => (
        <li key={sec.id} className="rounded-md">
          <div
            className={cn("h-1.5 rounded-full transition-colors", draggedId ? "bg-primary/0 hover:bg-primary/25" : "")}
            onDragOver={(e) => {
              if (!draggedId) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (!id) return;
              tryDrop(id, si);
            }}
          />
          <div className={cn("group/row flex items-stretch gap-0.5 rounded-md pr-0.5 hover:bg-base-content/[0.04]", depth === 0 && "py-0.5")}>
            <div
              className="flex w-7 shrink-0 cursor-grab items-center justify-center text-base-content/35 active:cursor-grabbing hover:text-base-content/60"
              draggable
              title="Drag to reorder"
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", sec.id);
                e.dataTransfer.effectAllowed = "move";
                setDraggedId(sec.id);
              }}
              onDragEnd={() => setDraggedId(null)}
            >
              <GripVertical className="size-3.5" aria-hidden />
            </div>
            {(sec.children?.length ?? 0) > 0 ? (
              <button
                type="button"
                className="flex h-9 w-6 shrink-0 items-center justify-center rounded-md text-base-content/50 hover:bg-base-content/[0.08]"
                aria-expanded={!(sec.collapsed ?? false)}
                title={(sec.collapsed ?? false) ? "Expand nested sections" : "Collapse nested sections"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapsed(sec.id);
                }}
              >
                {(sec.collapsed ?? false) ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              {renameTarget?.kind === "section" && renameTarget.id === sec.id ? (
                <div className="py-0.5 pr-1" onClick={(e) => e.stopPropagation()}>
                  <OutlineRenameInput
                    initial={sec.title}
                    onCommit={(v) => {
                      onRenameSection(sec.id, v);
                      onRenameTargetChange(null);
                    }}
                    onCancel={() => onRenameTargetChange(null)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className={cn(
                    "flex h-9 w-full min-w-0 items-center rounded-md px-1.5 text-left text-sm transition-colors",
                    activeSectionId === sec.id
                      ? "bg-primary/15 font-semibold text-primary ring-1 ring-primary/20"
                      : "text-base-content/70 hover:bg-base-content/[0.07] hover:text-base-content",
                  )}
                  title="Double-click to rename"
                  onClick={() => {
                    if ((sec.children?.length ?? 0) > 0 && (sec.collapsed ?? false)) onToggleCollapsed(sec.id);
                    onSelectSection(sec.id, sec.blocks?.[0]?.id ?? null);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRenameTargetChange({ kind: "section", id: sec.id });
                  }}
                >
                  <span className="truncate">{sec.title}</span>
                </button>
              )}
            </div>
            {depth === 0 && onToggleSectionChapter ? (
              <label
                className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-base-content/45"
                title="Mark as a narrative chapter for the public table of contents (story kind)"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs rounded border-base-content/25"
                  checked={sec.isChapter ?? false}
                  onChange={(e) => {
                    e.stopPropagation();
                    onToggleSectionChapter(sec.id, e.target.checked);
                  }}
                />
                <span className="hidden sm:inline">Chapter</span>
              </label>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base-content/45 hover:bg-base-content/[0.08]",
                  "opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:focus-within:opacity-100",
                )}
                aria-label={`Actions for ${sec.title}`}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem onClick={() => onRenameTargetChange({ kind: "section", id: sec.id })}>
                  <Pencil className="size-3.5 opacity-70" aria-hidden />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddSectionAfter(sec.id)}>
                  <Plus className="size-3.5 opacity-70" aria-hidden />
                  Add section below
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddChildSection(sec.id)}>
                  <Plus className="size-3.5 opacity-70" aria-hidden />
                  Add subsection
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteSection(sec.id)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {(sec.children?.length ?? 0) > 0 && !(sec.collapsed ?? false) ? (
            <OutlineSectionBranch
              doc={doc}
              parentId={sec.id}
              sections={sec.children!}
              depth={depth + 1}
              activeSectionId={activeSectionId}
              renameTarget={renameTarget}
              draggedId={draggedId}
              onSelectSection={onSelectSection}
              onRenameTargetChange={onRenameTargetChange}
              onRenameSection={onRenameSection}
              onAddSectionAfter={onAddSectionAfter}
              onAddChildSection={onAddChildSection}
              onDeleteSection={onDeleteSection}
              onToggleCollapsed={onToggleCollapsed}
              onMoveSection={onMoveSection}
              setDraggedId={setDraggedId}
              onToggleSectionChapter={onToggleSectionChapter}
            />
          ) : null}
        </li>
      ))}
      {depth === 0 ? (
        <li className="pt-0.5">
          <div
            className={cn("h-1.5 rounded-full", draggedId ? "hover:bg-primary/25" : "")}
            onDragOver={(e) => {
              if (!draggedId) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (!id) return;
              tryDrop(id, sections.length);
            }}
          />
        </li>
      ) : null}
      {depth > 0 ? (
        <li className="pt-1">
          <div
            className={cn("h-1.5 rounded-full", draggedId ? "hover:bg-primary/25" : "")}
            onDragOver={(e) => {
              if (!draggedId) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData("text/plain");
              if (!id) return;
              tryDrop(id, sections.length);
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (parentId != null && sections.length === 0) {
                onAddChildSection(parentId);
                return;
              }
              onAddSectionAfter(sections.length > 0 ? sections[sections.length - 1]!.id : null);
            }}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 w-full justify-start gap-1.5 rounded-md px-2 text-xs font-medium text-base-content/50 hover:text-base-content",
            )}
          >
            <Plus className="size-3.5 opacity-80" />
            Add section
          </button>
        </li>
      ) : null}
    </ul>
  );
}

export function StoryStructureSidebar({
  doc,
  activeSectionId,
  onSelectSection,
  outlineOpen,
  onOutlineOpenChange,
  renameTarget,
  onRenameTargetChange,
  onRenameSection,
  onAddSectionAfter,
  onAddChildSection,
  onDeleteSection,
  onToggleCollapsed,
  onMoveSection,
  onToggleSectionChapter,
  isCompact,
  mobileOverlay,
  onCloseMobileOverlay,
  /** When false, the sidebar does not render the narrow collapsed rail; the parent controls open/closed width. */
  showCollapsedRail = true,
}: {
  doc: StoryDocument;
  activeSectionId: string | null;
  onSelectSection: (sectionId: string, firstBlockId: string | null) => void;
  outlineOpen: boolean;
  onOutlineOpenChange: (open: boolean) => void;
  renameTarget: OutlineRenameTarget | null;
  onRenameTargetChange: (t: OutlineRenameTarget | null) => void;
  onRenameSection: (sectionId: string, title: string) => void;
  onAddSectionAfter: (afterSectionId: string | null) => void;
  onAddChildSection: (parentSectionId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onToggleCollapsed: (sectionId: string) => void;
  onMoveSection: (draggedId: string, newParentId: string | null, insertBeforeId: string | null) => void;
  onToggleSectionChapter?: (sectionId: string, isChapter: boolean) => void;
  isCompact: boolean;
  mobileOverlay?: boolean;
  onCloseMobileOverlay?: () => void;
  showCollapsedRail?: boolean;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const body = (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <OutlineSectionBranch
        doc={doc}
        parentId={null}
        sections={doc.sections ?? []}
        depth={0}
        activeSectionId={activeSectionId}
        renameTarget={renameTarget}
        draggedId={draggedId}
        onSelectSection={onSelectSection}
        onRenameTargetChange={onRenameTargetChange}
        onRenameSection={onRenameSection}
        onAddSectionAfter={onAddSectionAfter}
        onAddChildSection={onAddChildSection}
        onDeleteSection={onDeleteSection}
        onToggleCollapsed={onToggleCollapsed}
        onMoveSection={onMoveSection}
        setDraggedId={setDraggedId}
        onToggleSectionChapter={onToggleSectionChapter}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 h-9 w-full gap-1.5 rounded-lg border-base-content/12 text-xs font-medium"
        onClick={() => onAddSectionAfter(null)}
      >
        <Plus className="size-3.5 opacity-90" />
        Add section
      </Button>
    </div>
  );

  if (!outlineOpen && !mobileOverlay) {
    if (!showCollapsedRail) return null;
    return (
      <div className="flex w-12 shrink-0 flex-col items-center border-r border-primary/20 bg-base-200/50 py-3 shadow-[inset_-1px_0_0_0] shadow-black/10">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-lg p-0 text-primary/90 hover:bg-primary/15 hover:text-primary"
          title="Expand outline"
          aria-label="Open story structure panel"
          onClick={() => onOutlineOpenChange(true)}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2 h-8 w-8 rounded-lg p-0 text-base-content/70 hover:bg-primary/12 hover:text-primary"
          title="Add section"
          aria-label="Add section"
          onClick={() => onAddSectionAfter(null)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-0 h-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-primary/20 bg-base-200/55 shadow-[inset_-1px_0_0_0] shadow-black/15",
        isCompact ? "w-full" : "w-full max-w-none",
      )}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-base-content/10 px-3">
        <span className="truncate text-xs font-semibold uppercase tracking-wide text-base-content/55">Story structure</span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg p-0"
            title="Add section"
            onClick={() => onAddSectionAfter(null)}
          >
            <Plus className="size-4" />
          </Button>
          {mobileOverlay && onCloseMobileOverlay ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg p-0"
              title="Close"
              onClick={onCloseMobileOverlay}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-lg p-0 text-base-content/70 hover:bg-primary/12 hover:text-primary"
              title="Collapse outline"
              aria-label="Close story structure panel"
              onClick={() => onOutlineOpenChange(false)}
            >
              <ChevronLeft className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {body}
    </div>
  );
}
