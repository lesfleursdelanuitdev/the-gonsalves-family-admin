"use client";

import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminSources, type AdminSourcesListResponse } from "@/hooks/useAdminSources";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

interface SourceRow {
  id: string;
  xref: string;
  title: string;
  author: string;
  linkedTo: string;
}

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

const config: DataViewerConfig<SourceRow> = {
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
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-muted-foreground" />
          <CardTitle className="text-base font-mono text-sm">{record.xref}</CardTitle>
        </div>
        <p className="text-sm font-medium">{record.title}</p>
        <p className="text-xs text-muted-foreground">{record.author}</p>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>{record.linkedTo}</p>
      </CardContent>
      <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </Card>
  ),
  actions: {
    add: { label: "Add source", handler: () => alert("TODO: add source") },
    view: { label: "View", handler: (r) => alert(`View: ${r.title}`) },
    edit: { label: "Edit", handler: (r) => alert(`Edit: ${r.xref}`) },
    delete: { label: "Delete", handler: (r) => alert(`Delete: ${r.xref}`) },
  },
};

export default function AdminSourcesPage() {
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminSources(queryOpts);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

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
