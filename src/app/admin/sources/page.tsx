"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { SourceCard, type SourceCardRecord } from "@/components/admin/SourceCard";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminSources, useDeleteSource, type AdminSourcesListResponse } from "@/hooks/useAdminSources";
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
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminSourcesPage() {
  const router = useRouter();
  const deleteSource = useDeleteSource();
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

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildSourcesConfig(router, handleDelete), [router, handleDelete]);

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
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-sources-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
