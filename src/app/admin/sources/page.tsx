"use client";

import { useState, useMemo } from "react";
import { BookOpen } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminSources, type AdminSourcesListResponse } from "@/hooks/useAdminSources";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
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
  globalFilterColumnId: "title",
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
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminSources({
    q: search.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sources</h1>
        <p className="text-muted-foreground">
          Citations and source records linked to individuals, families, or events.
        </p>
      </div>
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-sources-view"
        globalFilter={search}
        onGlobalFilterChange={setSearch}
      />
    </div>
  );
}
