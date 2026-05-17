"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { useAdminGlossary, useDeleteGlossaryEntry, type AdminGlossaryListResponse } from "@/hooks/useAdminGlossary";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError } from "@/lib/infra/api";

interface GlossaryRow {
  id: string;
  word: string;
  slug: string;
  dialect: string | null;
  partOfSpeech: string | null;
  meaning: string;
  status: "draft" | "published" | "archived";
  updatedAt: string;
}

function mapApiToRows(api: AdminGlossaryListResponse): GlossaryRow[] {
  return (api?.entries ?? []).map((e) => ({
    id: e.id,
    word: e.word,
    slug: e.slug,
    dialect: e.dialect,
    partOfSpeech: e.partOfSpeech,
    meaning: e.meaning,
    status: e.status,
    updatedAt: new Date(e.updatedAt).toLocaleDateString(),
  }));
}

function buildGlossaryConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: GlossaryRow) => void,
): DataViewerConfig<GlossaryRow> {
  return {
    id: "glossary",
    labels: { singular: "Entry", plural: "Entries" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "word", header: "Word / phrase", enableSorting: true },
      { accessorKey: "dialect", header: "Dialect", enableSorting: true, cell: ({ row }) => row.getValue("dialect") ?? <span className="text-muted-foreground">—</span> },
      { accessorKey: "partOfSpeech", header: "Part of speech", enableSorting: true, cell: ({ row }) => row.getValue("partOfSpeech") ?? <span className="text-muted-foreground">—</span> },
      { accessorKey: "status", header: "Status", enableSorting: true },
      { accessorKey: "updatedAt", header: "Updated", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BookOpen className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{record.word}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground capitalize">
            {record.dialect ?? "—"}{record.partOfSpeech ? ` · ${record.partOfSpeech}` : ""} · {record.status}
          </p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground line-clamp-2">
          {record.meaning}
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={() => onDelete(record)} />
      </Card>
    ),
    actions: {
      add: { label: "New entry", handler: () => router.push("/admin/glossary/new") },
      view: { label: "Open", handler: (r) => router.push(`/admin/glossary/${r.id}/edit`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/glossary/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminGlossaryPage() {
  const router = useRouter();
  const deleteEntry = useDeleteGlossaryEntry();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } = useAdminListQFilters();
  const { data, isLoading } = useAdminGlossary(queryOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: GlossaryRow) => {
      if (!window.confirm(`Delete entry "${r.word}"? This cannot be undone.`)) return;
      try {
        await deleteEntry.mutateAsync(r.id);
        toast.success(`Deleted "${r.word}".`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete entry.");
      }
    },
    [deleteEntry],
  );

  const config = useMemo(() => buildGlossaryConfig(router, handleDelete), [router, handleDelete]);

  return (
    <AdminListPageShell
      title="Words & phrases"
      description="Cultural dialect words, phrases, and expressions with meanings and pronunciations."
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="glossary-filter-q">Search entries</Label>
            <Input id="glossary-filter-q" value={draft.q} onChange={(e) => updateDraft("q", e.target.value)} placeholder="Word contains…" />
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-glossary-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
