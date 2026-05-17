"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { AnyExtension } from "@tiptap/core";
import type { JSONContent } from "@tiptap/core";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeStoryDocContent, storyDocJsonEquals } from "@/components/admin/story-creator/story-tiptap-doc";
import { useStoryTiptapActiveEditorOptional } from "@/components/admin/story-creator/story-tiptap-active-editor-context";
import type { StoryTableBlock } from "@/lib/admin/story-creator/story-types";
import { StoryLink } from "@/components/admin/story-creator/story-tiptap-link-extension";

// ─── Extension set for table cells ───────────────────────────────────────────

function createTableCellExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      horizontalRule: false,
      code: false,
      link: false,
    }),
    StoryLink.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
      HTMLAttributes: { class: "text-primary underline underline-offset-2" },
    }),
    Highlight.configure({
      multicolor: false,
      HTMLAttributes: { class: "bg-warning/35 text-base-content" },
    }),
    TextAlign.configure({ types: ["paragraph"] }),
  ];
}

// ─── Individual cell editor ───────────────────────────────────────────────────

const TableCellEditor = memo(function TableCellEditor({
  content,
  onBlur,
}: {
  content: JSONContent;
  onBlur: (content: JSONContent) => void;
}) {
  const ctx = useStoryTiptapActiveEditorOptional();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  const extensions = useMemo(createTableCellExtensions, []);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions,
      content: normalizeStoryDocContent(content) as JSONContent,
      editorProps: {
        attributes: {
          class: "story-table-cell-editor outline-none min-h-[1.25em] w-full text-sm leading-snug px-2 py-1.5",
        },
      },
    },
    [extensions],
  );

  // Sync external content changes (e.g. undo from parent)
  useEffect(() => {
    if (!editor) return;
    const next = normalizeStoryDocContent(content) as JSONContent;
    if (!storyDocJsonEquals(editor.getJSON(), next)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, content]);

  // Register with global toolbar context
  useEffect(() => {
    if (!editor) return;
    const chrome = ctxRef.current;
    if (!chrome) return;
    chrome.mountEditor(editor);
    const onFocus = () => ctxRef.current?.notifyEditorFocused(editor);
    const onBlurEvt = () => ctxRef.current?.notifyEditorBlurred();
    const onSelectionUpdate = () => {
      const c = ctxRef.current;
      if (!c || editor.isDestroyed) return;
      if (editor.view.hasFocus()) c.notifyEditorFocused(editor);
    };
    editor.on("focus", onFocus);
    editor.on("blur", onBlurEvt);
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("focus", onFocus);
      editor.off("blur", onBlurEvt);
      editor.off("selectionUpdate", onSelectionUpdate);
      ctxRef.current?.unmountEditor(editor);
    };
  }, [editor]);

  // Save on blur — no per-keystroke updateDoc calls
  useEffect(() => {
    if (!editor) return;
    const handle = () => onBlurRef.current(editor.getJSON());
    editor.on("blur", handle);
    return () => { editor.off("blur", handle); };
  }, [editor]);

  if (!editor) return <div className="min-h-[1.25em] px-2 py-1.5" />;
  return <EditorContent editor={editor} className="min-w-0" />;
});

// ─── Block width snap points ──────────────────────────────────────────────────

const TABLE_WIDTH_SNAPS = [33, 50, 66, 75, 100];

function snapTableWidth(pct: number): number {
  for (const s of TABLE_WIDTH_SNAPS) {
    if (Math.abs(pct - s) <= 4) return s;
  }
  return Math.min(100, Math.max(25, Math.round(pct)));
}

// ─── Ops type ─────────────────────────────────────────────────────────────────

export type TableBlockOps = {
  onSetCell: (row: number, col: number, content: JSONContent) => void;
  /** Body row index (header row excluded). Supports -1 to insert at first body row. */
  onAddRow: (afterIndex: number) => void;
  /** Body row index (header row excluded). */
  onRemoveRow: (rowIndex: number) => void;
  /** Body column index (header column excluded). Supports -1 to insert at first body column. */
  onAddColumn: (afterIndex: number) => void;
  /** Body column index (header column excluded). */
  onRemoveColumn: (colIndex: number) => void;
  onSetColumnWidths: (widths: number[]) => void;
  onPatchLayout: (patch: Partial<Pick<StoryTableBlock, "hasHeaderRow" | "hasHeaderColumn" | "rowCount" | "columnCount" | "widthPct" | "widthAlign">>) => void;
};

// ─── Main table editor ────────────────────────────────────────────────────────

export function StoryTableBlockEditor({
  block,
  ops,
}: {
  block: StoryTableBlock;
  ops: TableBlockOps;
}) {
  const { onSetCell, onAddRow, onRemoveRow, onAddColumn, onRemoveColumn, onSetColumnWidths, onPatchLayout } = ops;

  const hasHeaderRow = block.hasHeaderRow ?? false;
  const hasHeaderCol = block.hasHeaderColumn ?? false;
  const widthPct = block.widthPct ?? 100;
  const widthAlign = block.widthAlign ?? "center";
  const bodyColCount = block.columnCount;
  const bodyRowCount = block.rowCount;
  const totalColCount = bodyColCount + (hasHeaderCol ? 1 : 0);
  const headerRowOffset = hasHeaderRow ? 1 : 0;

  function getColWidths(): number[] {
    if (block.columnWidths && block.columnWidths.length === totalColCount) return block.columnWidths;
    const eq = 100 / totalColCount;
    return Array.from({ length: totalColCount }, () => eq);
  }

  // ── Column resize drag ────────────────────────────────────────────────────
  const tableRef = useRef<HTMLTableElement | null>(null);
  const colDragRef = useRef<{
    colIndex: number;
    startX: number;
    startWidths: number[];
    tableWidthPx: number;
  } | null>(null);
  const [colDragging, setColDragging] = useState(false);

  function onColPointerDown(e: React.PointerEvent<HTMLDivElement>, colIndex: number) {
    e.stopPropagation();
    e.preventDefault();
    const tableEl = tableRef.current;
    if (!tableEl) return;
    colDragRef.current = {
      colIndex,
      startX: e.clientX,
      startWidths: [...getColWidths()],
      tableWidthPx: tableEl.getBoundingClientRect().width,
    };
    setColDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onColPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = colDragRef.current;
    if (!state || !tableRef.current) return;
    const deltaPct = ((e.clientX - state.startX) / state.tableWidthPx) * 100;
    const leftRaw = state.startWidths[state.colIndex]! + deltaPct;
    const rightRaw = state.startWidths[state.colIndex + 1]! - deltaPct;
    const left = Math.max(5, leftRaw);
    const right = Math.max(5, rightRaw);
    // Apply imperatively to <col> elements for real-time feedback
    const cols = tableRef.current.querySelectorAll<HTMLElement>("col");
    cols[state.colIndex]!.style.width = `${left}%`;
    if (cols[state.colIndex + 1]) cols[state.colIndex + 1]!.style.width = `${right}%`;
  }

  function onColPointerUp(_e: React.PointerEvent<HTMLDivElement>) {
    const state = colDragRef.current;
    if (!state || !tableRef.current) return;
    // Read committed widths from <col> elements, then clear inline styles
    const cols = tableRef.current.querySelectorAll<HTMLElement>("col");
    const committed = state.startWidths.map((sw, i) => {
      const raw = parseFloat(cols[i]?.style.width ?? "");
      cols[i]!.style.width = "";
      return isNaN(raw) ? sw : raw;
    });
    colDragRef.current = null;
    setColDragging(false);
    // Normalize so widths still sum to 100
    const total = committed.reduce((s, w) => s + w, 0);
    onSetColumnWidths(committed.map((w) => (w / total) * 100));
  }

  const colHandleEvents = (colIndex: number) => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => onColPointerDown(e, colIndex),
    onPointerMove: onColPointerMove,
    onPointerUp: onColPointerUp,
    onPointerCancel: onColPointerUp,
  });

  // ── Block-level width resize ──────────────────────────────────────────────
  const blockDragRef = useRef<{
    side: "left" | "right";
    startX: number;
    startWidthPx: number;
    parentWidthPx: number;
    scopeEl: HTMLElement;
  } | null>(null);
  const [blockDragging, setBlockDragging] = useState(false);
  const lastWidthPctRef = useRef(widthPct);

  function onBlockPointerDown(e: React.PointerEvent<HTMLDivElement>, side: "left" | "right") {
    e.stopPropagation();
    e.preventDefault();
    const scopeEl = e.currentTarget.closest<HTMLElement>("[data-table-block-scope]");
    const parentEl = scopeEl?.parentElement;
    if (!scopeEl || !parentEl) return;
    const scopeRect = scopeEl.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    const cs = window.getComputedStyle(parentEl);
    const parentW = parentRect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    blockDragRef.current = { side, startX: e.clientX, startWidthPx: scopeRect.width, parentWidthPx: parentW, scopeEl };
    lastWidthPctRef.current = Math.round((scopeRect.width / parentW) * 100);
    setBlockDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onBlockPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const state = blockDragRef.current;
    if (!state) return;
    const delta = state.side === "right" ? e.clientX - state.startX : state.startX - e.clientX;
    const pct = Math.min(100, Math.max(25, Math.round(((state.startWidthPx + delta) / state.parentWidthPx) * 100)));
    lastWidthPctRef.current = pct;
    state.scopeEl.style.width = `${pct}%`;
  }

  function onBlockPointerUp(_e: React.PointerEvent<HTMLDivElement>) {
    const state = blockDragRef.current;
    if (!state) return;
    state.scopeEl.style.width = "";
    blockDragRef.current = null;
    setBlockDragging(false);
    onPatchLayout({ widthPct: snapTableWidth(lastWidthPctRef.current) });
  }

  const blockHandleEvents = (side: "left" | "right") => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => onBlockPointerDown(e, side),
    onPointerMove: onBlockPointerMove,
    onPointerUp: onBlockPointerUp,
    onPointerCancel: onBlockPointerUp,
  });

  const showBlockHandles = widthPct < 100;
  const blockHandleBase = cn(
    "absolute inset-y-0 z-20 flex w-4 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity duration-150 group-hover/tableresize:opacity-100",
    blockDragging && "opacity-100",
  );

  const colWidths = getColWidths();

  const containerStyle: React.CSSProperties =
    widthPct < 100
      ? {
          width: `${widthPct}%`,
          marginLeft: widthAlign === "right" ? "auto" : widthAlign === "center" ? "auto" : 0,
          marginRight: widthAlign === "left" ? "auto" : widthAlign === "center" ? "auto" : 0,
        }
      : {};

  return (
    <div
      data-table-block-scope
      className="group/tableresize relative min-w-0"
      style={containerStyle}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200/80 bg-neutral-50/60 px-2.5 py-2 text-xs text-neutral-700">
        <span className="font-medium text-neutral-800">Body size</span>
        <div className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1 py-0.5">
          <button
            type="button"
            title="Remove body row"
            className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
            onClick={() => onPatchLayout({ rowCount: Math.max(1, bodyRowCount - 1) })}
            disabled={bodyRowCount <= 1}
          >
            <Minus className="size-3" />
          </button>
          <span className="min-w-14 text-center tabular-nums">{bodyRowCount} rows</span>
          <button
            type="button"
            title="Add body row"
            className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            onClick={() => onPatchLayout({ rowCount: bodyRowCount + 1 })}
          >
            <Plus className="size-3" />
          </button>
        </div>
        <div className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-1 py-0.5">
          <button
            type="button"
            title="Remove body column"
            className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
            onClick={() => onPatchLayout({ columnCount: Math.max(1, bodyColCount - 1) })}
            disabled={bodyColCount <= 1}
          >
            <Minus className="size-3" />
          </button>
          <span className="min-w-16 text-center tabular-nums">{bodyColCount} cols</span>
          <button
            type="button"
            title="Add body column"
            className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            onClick={() => onPatchLayout({ columnCount: bodyColCount + 1 })}
          >
            <Plus className="size-3" />
          </button>
        </div>
        <span className="text-neutral-500">
          Headers are extra bands; body size stays constant.
        </span>
      </div>

      {/* Block-level resize handles */}
      {showBlockHandles && (
        <div className={cn(blockHandleBase, "-left-2")} {...blockHandleEvents("left")}>
          <div className="h-10 w-1 rounded-full bg-primary/60 shadow" />
        </div>
      )}
      {showBlockHandles && (
        <div className={cn(blockHandleBase, "-right-2")} {...blockHandleEvents("right")}>
          <div className="h-10 w-1 rounded-full bg-primary/60 shadow" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-200/95 bg-white">
        <table ref={tableRef} className="w-full border-collapse text-sm">
          <colgroup>
            {colWidths.map((w, ci) => (
              <col key={ci} data-ci={String(ci)} style={{ width: `${w}%` }} />
            ))}
          </colgroup>
          <tbody>
            {block.cells.map((row, ri) => {
              const isHeaderRow = hasHeaderRow && ri === 0;
              return (
                <tr key={ri} className="group/tablerow">
                  {row.map((cell, ci) => {
                    const isHeaderCol = hasHeaderCol && ci === 0;
                    const isHeader = isHeaderRow || isHeaderCol;
                    const Tag = isHeader ? "th" : "td";
                    const isLastCol = ci === totalColCount - 1;
                    return (
                      <Tag
                        key={ci}
                        className={cn(
                          "relative border border-neutral-200/90 p-0 text-left align-top",
                          isHeader && "bg-neutral-50/90 font-medium",
                        )}
                      >
                        {/* Column resize handle — right edge of every column except last */}
                        {!isLastCol && (
                          <div
                            className={cn(
                              "absolute -right-1.5 inset-y-0 z-10 flex w-3 cursor-col-resize touch-none select-none items-center justify-center opacity-0 transition-opacity duration-100 hover:opacity-100",
                              colDragging && "opacity-100",
                            )}
                            {...colHandleEvents(ci)}
                          >
                            <div className="h-6 w-0.5 rounded-full bg-primary/50" />
                          </div>
                        )}
                        <TableCellEditor
                          content={cell}
                          onBlur={(content) => onSetCell(ri, ci, content)}
                        />
                      </Tag>
                    );
                  })}
                  {/* Per-row add / remove controls (body rows only) */}
                  <td className="w-0 border-0 p-0 align-middle">
                    <div className="flex items-center gap-0.5 pl-1 opacity-0 transition-opacity group-hover/tablerow:opacity-100">
                      {(() => {
                        const bodyRowIndex = ri - headerRowOffset;
                        const isBodyRow = bodyRowIndex >= 0;
                        return (
                          <>
                            <button
                              type="button"
                              title={isBodyRow ? "Add row below" : "Add first body row"}
                              className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              onClick={() => onAddRow(isBodyRow ? bodyRowIndex : -1)}
                            >
                              <Plus className="size-3" />
                            </button>
                            <button
                              type="button"
                              title="Delete body row"
                              className="flex size-5 items-center justify-center rounded text-neutral-400 hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30"
                              onClick={() => onRemoveRow(bodyRowIndex)}
                              disabled={!isBodyRow || bodyRowCount <= 1}
                            >
                              <Minus className="size-3" />
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Per-column add / remove controls */}
        <div className="flex border-t border-neutral-200/90">
          {Array.from({ length: totalColCount }, (_, ci) => (
            <div
              key={ci}
              className="group/tablecol flex min-w-0 flex-1 items-center justify-center gap-0.5 py-0.5"
            >
              {(() => {
                const bodyColIndex = ci - (hasHeaderCol ? 1 : 0);
                const isBodyCol = bodyColIndex >= 0;
                return (
                  <>
                    <button
                      type="button"
                      title={isBodyCol ? "Add column to the right" : "Add first body column"}
                      className="flex size-5 items-center justify-center rounded text-neutral-400 opacity-0 hover:bg-neutral-100 hover:text-neutral-700 group-hover/tablecol:opacity-100"
                      onClick={() => onAddColumn(isBodyCol ? bodyColIndex : -1)}
                    >
                      <Plus className="size-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete body column"
                      className="flex size-5 items-center justify-center rounded text-neutral-400 opacity-0 hover:bg-red-50 hover:text-red-500 disabled:pointer-events-none disabled:opacity-30 group-hover/tablecol:opacity-100"
                      onClick={() => onRemoveColumn(bodyColIndex)}
                      disabled={!isBodyCol || bodyColCount <= 1}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </>
                );
              })()}
            </div>
          ))}
          {/* Spacer aligning with the row-control column */}
          <div className="w-8 shrink-0" />
        </div>
      </div>

      {/* Add row at end */}
      <button
        type="button"
        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-600"
        onClick={() => onAddRow(bodyRowCount - 1)}
      >
        <Plus className="size-3" />
        Add body row
      </button>
    </div>
  );
}
