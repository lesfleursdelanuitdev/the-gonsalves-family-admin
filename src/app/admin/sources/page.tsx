"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { SourceCard, type SourceCardRecord } from "@/components/admin/SourceCard";
import {
  DataViewer,
  DataViewerGedcomBatchEditModal,
  type DataViewerConfig,
} from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminSources, useDeleteSource, type AdminSourcesListResponse } from "@/hooks/useAdminSources";
import { deleteJson } from "@/lib/infra/api";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

interface SourceRow extends SourceCardRecord {}

function mapApiToRows(api: AdminSourcesListResponse): SourceRow[] {
  return (api?.sources ?? []).map((s) => {
    const parts: string[] = [];
    s.individualSources?.forEach((is_) => {
      const name = stripSlashesFromName(is_.individual?.fullName);
      if (name) parts.push(name);
    });
    s.familySources?.forEach((fs) => {
      const h = stripSlashesFromName(fs.family?.husband?.fullName);
      const w = stripSlashesFromName(fs.family?.wife?.fullName);
      if (h || w) parts.push(`${h} & ${w}`.replace(/^ & | & $/g, "").trim() || "Family");
    });
    s.eventSources?.forEach((es) => {
      if (es.event?.eventType) parts.push(`Event: ${es.event.eventType}`);
    });
    const linkedTo = parts.length ? parts.join("; ") : "—";

    return {
      id: s.id,
      xref: s.xref,
      title: s.title ?? "—",
      author: s.author ?? "—",
      linkedTo,
    };
  });
}

function buildSourcesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: SourceRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
  onBulkEdit: (ids: string[]) => void,
): DataViewerConfig<SourceRow> {
  return {
    id: "sources",
    labels: { singular: "Source", plural: "Sources" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "xref", header: "XREF", enableSorting: true },
      { accessorKey: "title", header: "Title", enableSorting: true },
      { accessorKey: "author", header: "Author", enableSorting: true },
      { accessorKey: "linkedTo", header: "Linked to", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => (
      <SourceCard record={record} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    ),
    actions: {
      add: { label: "Add source", handler: () => router.push("/admin/sources/new") },
      view: {
        label: "View",
        handler: (r) => router.push(`/admin/sources/${r.id}/edit`),
      },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/sources/${r.id}/edit`) },
      bulkEdit: { label: "Edit selected", handler: onBulkEdit },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminSourcesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteSource = useDeleteSource();
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditIds, setBatchEditIds] = useState<string[]>([]);
  const [batchApplyKey, setBatchApplyKey] = useState<number | undefined>();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminSources(queryOpts);

  const handleDelete = useCallback(
    (r: SourceRow) => {
      const label = r.title !== "—" ? r.title : r.xref || r.id;
      if (
        !window.confirm(
          `Delete source “${label}”?\n\nThis removes the source record and all citation links (individual, family, event, notes, media). This cannot be undone.`,
        )
      ) {
        return;
      }
      deleteSource.mutate(r.id, {
        onSuccess: () => toast.success(`Deleted source: ${label}.`),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error";
          toast.error(`Failed to delete source: ${msg}`);
        },
      });
    },
    [deleteSource],
  );

  const bulkDeleteOneSource = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/sources/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] });
  }, [queryClient]);

  const openBulkEdit = useCallback((ids: string[]) => {
    setBatchEditIds(ids);
    setBatchEditOpen(true);
  }, []);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(
    () => buildSourcesConfig(router, handleDelete, bulkDeleteOneSource, openBulkEdit),
    [router, handleDelete, bulkDeleteOneSource, openBulkEdit],
  );

  return (
    <AdminListPageShell
      title="Sources"
      description="Citations and source records linked to individuals, families, or events."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={clearFilters}
          activeFilterCount={adminListQActiveFilterCount(applied)}
        >
          <div className="space-y-2">
            <Label htmlFor="sources-filter-q">Search sources</Label>
            <Input
              id="sources-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Title, author, XREF, or linked text"
            />
            <p className="text-xs text-muted-foreground">
              Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewerGedcomBatchEditModal
        open={batchEditOpen}
        onOpenChange={setBatchEditOpen}
        entityKind="source"
        selectedIds={batchEditIds}
        onApplied={() => {
          setBatchApplyKey((k) => (k ?? 0) + 1);
          void queryClient.invalidateQueries({ queryKey: ["admin", "sources"] });
        }}
      />
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-sources-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
        batchApplyKey={batchApplyKey}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
