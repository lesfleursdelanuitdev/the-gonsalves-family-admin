"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Link2, Pencil, Trash2 } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminOpenQuestions, useDeleteOpenQuestion } from "@/hooks/useAdminOpenQuestions";
import { deleteJson } from "@/lib/infra/api";
import {
  summarizeOpenQuestionLinks,
  getOpenQuestionLinkedRecordRows,
  type OpenQuestionLinkedRecordRow,
} from "@/lib/admin/open-question-display";
import { OpenQuestionStatusBadge } from "@/components/admin/OpenQuestionStatusBadge";
import type { AdminOpenQuestionsListResponse } from "@/hooks/useAdminOpenQuestions";
import { cn } from "@/lib/utils";

interface OqRow {
  id: string;
  question: string;
  status: string;
  linkedSummary: string;
  linkedRows: OpenQuestionLinkedRecordRow[];
  resolutionPreview: string;
  resolvedAt: string;
  updatedAt: string;
  createdAt: string;
}

function formatListMetaDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}

function mapApiToRows(api: AdminOpenQuestionsListResponse): OqRow[] {
  return (api?.openQuestions ?? []).map((raw) => {
    const o = raw as Record<string, unknown>;
    const res = String(o.resolution ?? "").trim();
    return {
      id: String(o.id ?? ""),
      question: String(o.question ?? ""),
      status: String(o.status ?? "open"),
      linkedSummary: summarizeOpenQuestionLinks(o),
      linkedRows: getOpenQuestionLinkedRecordRows(o),
      resolutionPreview: res.length > 80 ? `${res.slice(0, 77)}…` : res || "—",
      resolvedAt: o.resolvedAt ? String(o.resolvedAt) : "",
      updatedAt: o.updatedAt ? String(o.updatedAt) : "",
      createdAt: o.createdAt ? String(o.createdAt) : "",
    };
  });
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: OqRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<OqRow> {
  return {
    id: "open-questions",
    labels: { singular: "Open question", plural: "Open questions" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    embedSelectionInCard: true,
    cardGridClassName: "grid grid-cols-1 gap-4 sm:grid-cols-2",
    columns: [
      { accessorKey: "question", header: "Question", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <OpenQuestionStatusBadge status={String(row.getValue("status"))} />,
      },
      { accessorKey: "linkedSummary", header: "Linked", enableSorting: true },
      { accessorKey: "resolutionPreview", header: "Resolution", enableSorting: false },
      {
        accessorKey: "resolvedAt",
        header: "Resolved",
        enableSorting: true,
        cell: ({ row }) => formatListMetaDate(String(row.getValue("resolvedAt") ?? "")),
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        enableSorting: true,
        cell: ({ row }) => formatListMetaDate(String(row.getValue("updatedAt") ?? "")),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => formatListMetaDate(String(row.getValue("createdAt") ?? "")),
      },
    ],
    renderCard: ({ record, onView, onEdit, onDelete: onDel, selection }) => {
      const st = record.status.toLowerCase();
      const accent =
        st === "open"
          ? "border-l-success/55"
          : st === "resolved"
            ? "border-l-base-content/28"
            : "border-l-base-content/16";

      const onCardActivate = () => {
        onView?.();
      };

      const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
        const el = e.target as HTMLElement;
        if (el.closest("[data-card-no-view], a, button, input, label")) return;
        onCardActivate();
      };

      const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          const el = e.target as HTMLElement;
          if (el.closest("[data-card-no-view], a, button, input, label")) return;
          e.preventDefault();
          onCardActivate();
        }
      };

      const maxInlineLinks = 3;
      const extraLinks = Math.max(0, record.linkedRows.length - maxInlineLinks);

      return (
        <Card
          role={onView ? "button" : undefined}
          tabIndex={onView ? 0 : undefined}
          onClick={onView ? handleCardClick : undefined}
          onKeyDown={onView ? handleCardKeyDown : undefined}
          className={cn(
            "cursor-pointer select-none border-l-[3px] border-l-transparent py-0 shadow-black/12",
            accent,
            "hover:border-base-content/[0.22] hover:shadow-lg hover:shadow-black/22",
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2.5 sm:px-3.5 sm:pb-3 sm:pt-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {selection ? (
                  <div
                    data-card-no-view
                    className="flex size-8 shrink-0 items-center justify-center rounded-md border border-base-content/10 bg-base-content/[0.04]"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      selection.onToggle(e as unknown as MouseEvent);
                    }}
                    role="presentation"
                  >
                    <Checkbox checked={selection.isSelected} className="pointer-events-none" aria-label="Select row" />
                  </div>
                ) : null}
                <OpenQuestionStatusBadge tone="card" status={record.status} />
              </div>
              {record.linkedRows.length > 0 ? (
                <span className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  Linked
                </span>
              ) : null}
            </div>

            <h3 className="mt-2.5 line-clamp-3 text-base font-semibold leading-snug tracking-tight text-base-content/95 sm:text-[1.0625rem] sm:leading-snug">
              {record.question || "—"}
            </h3>

            <div className="mt-2.5 min-h-[1.25rem]">
              {record.linkedRows.length === 0 ? (
                <p className="text-xs text-muted-foreground/85">Not linked to records yet.</p>
              ) : (
                <p className="flex flex-wrap items-baseline gap-x-1 text-xs leading-relaxed text-muted-foreground">
                  <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/75">
                    <Link2 className="size-3 opacity-80" aria-hidden />
                    Linked to:
                  </span>
                  <span className="min-w-0">
                    {record.linkedRows.slice(0, maxInlineLinks).map((row, i) => (
                      <span key={row.href}>
                        {i > 0 ? <span className="text-muted-foreground/45"> · </span> : null}
                        <Link
                          href={row.href}
                          data-card-no-view
                          className="font-medium text-base-content/88 underline-offset-2 hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.label}
                        </Link>
                      </span>
                    ))}
                    {extraLinks > 0 ? (
                      <span className="text-muted-foreground/70"> · +{extraLinks} more</span>
                    ) : null}
                  </span>
                </p>
              )}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/75">
              Updated {formatListMetaDate(record.updatedAt)}
              <span className="text-muted-foreground/45"> · </span>
              Created {formatListMetaDate(record.createdAt)}
            </p>

            <div
              data-card-no-view
              className="mt-auto flex shrink-0 justify-end gap-0.5 border-t border-base-content/[0.06] pt-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              {onView ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:bg-base-content/[0.08] hover:text-base-content"
                  aria-label="View"
                  onClick={() => onView()}
                >
                  <Eye className="size-3.5" />
                </Button>
              ) : null}
              {onEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:bg-base-content/[0.08] hover:text-base-content"
                  aria-label="Edit"
                  onClick={() => onEdit()}
                >
                  <Pencil className="size-3.5" />
                </Button>
              ) : null}
              {onDel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:bg-destructive/12 hover:text-destructive"
                  aria-label="Delete"
                  onClick={() => onDel()}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      );
    },
    actions: {
      add: { label: "Add question", handler: () => router.push("/admin/open-questions/new") },
      view: { label: "View", handler: (r) => router.push(`/admin/open-questions/${r.id}`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/open-questions/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminOpenQuestionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draftStatus, setDraftStatus] = useState<"" | "open" | "resolved" | "archived">("");
  const [draftQ, setDraftQ] = useState("");
  const [appliedStatus, setAppliedStatus] = useState<"" | "open" | "resolved" | "archived">("");
  const [appliedQ, setAppliedQ] = useState("");

  const { data, isLoading } = useAdminOpenQuestions({
    status: appliedStatus || undefined,
    q: appliedQ || undefined,
    limit: 50,
    offset: 0,
  });

  const deleteOq = useDeleteOpenQuestion();
  const handleDelete = useCallback(
    (r: OqRow) => {
      if (!window.confirm("Delete this open question? Junction links will be removed. This cannot be undone.")) {
        return;
      }
      deleteOq.mutate(r.id, {
        onSuccess: () => toast.success("Deleted."),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
      });
    },
    [deleteOq],
  );

  const bulkDeleteOneOq = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/open-questions/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "open-questions"] });
  }, [queryClient]);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildConfig(router, handleDelete, bulkDeleteOneOq), [router, handleDelete, bulkDeleteOneOq]);

  return (
    <AdminListPageShell
      title="Open Questions"
      description="Track research items, spelling doubts, photo attribution, and date verification across people, families, events, and media."
      filters={
        <FilterPanel
          onApply={() => {
            setAppliedStatus(draftStatus);
            setAppliedQ(draftQ.trim());
          }}
          onClear={() => {
            setDraftStatus("");
            setDraftQ("");
            setAppliedStatus("");
            setAppliedQ("");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="oq-filter-status">Status</Label>
              <select
                id="oq-filter-status"
                className={selectClassName}
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as typeof draftStatus)}
              >
                <option value="">Any</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oq-filter-q">Search</Label>
              <Input
                id="oq-filter-q"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                placeholder="Question, details, or resolution"
              />
              <p className="text-xs text-muted-foreground">Click Apply to run the search.</p>
            </div>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-open-questions-view"
        skipClientGlobalFilter
        paginationResetKey={`${appliedStatus}|${appliedQ}`}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
