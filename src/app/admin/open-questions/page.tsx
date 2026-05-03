"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleHelp, Link2 } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminOpenQuestions, useDeleteOpenQuestion } from "@/hooks/useAdminOpenQuestions";
import { deleteJson } from "@/lib/infra/api";
import { summarizeOpenQuestionLinks } from "@/lib/admin/open-question-display";
import { OpenQuestionStatusBadge } from "@/components/admin/OpenQuestionStatusBadge";
import type { AdminOpenQuestionsListResponse } from "@/hooks/useAdminOpenQuestions";

interface OqRow {
  id: string;
  question: string;
  status: string;
  linkedSummary: string;
  resolutionPreview: string;
  resolvedAt: string;
  updatedAt: string;
  createdAt: string;
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
      resolutionPreview: res.length > 80 ? `${res.slice(0, 77)}…` : res || "—",
      resolvedAt: o.resolvedAt ? new Date(String(o.resolvedAt)).toLocaleString() : "—",
      updatedAt: o.updatedAt ? new Date(String(o.updatedAt)).toLocaleString() : "—",
      createdAt: o.createdAt ? new Date(String(o.createdAt)).toLocaleString() : "—",
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
    columns: [
      { accessorKey: "question", header: "Question", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <OpenQuestionStatusBadge status={String(row.getValue("status"))} />,
      },
      { accessorKey: "linkedSummary", header: "Linked", enableSorting: true },
      { accessorKey: "resolutionPreview", header: "Resolution", enableSorting: false },
      { accessorKey: "resolvedAt", header: "Resolved", enableSorting: true },
      { accessorKey: "updatedAt", header: "Updated", enableSorting: true },
      { accessorKey: "createdAt", header: "Created", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit, onDelete: onDel }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CircleHelp className="size-5 text-primary" aria-hidden />
            <CardTitle className="line-clamp-2 text-base leading-snug">{record.question || "—"}</CardTitle>
          </div>
          <OpenQuestionStatusBadge status={record.status} />
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="size-3.5" aria-hidden />
            Linked
          </p>
          <p className="text-muted-foreground">{record.linkedSummary}</p>
          <p className="text-xs text-muted-foreground">
            Updated {record.updatedAt} · Created {record.createdAt}
          </p>
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDel} />
      </Card>
    ),
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
