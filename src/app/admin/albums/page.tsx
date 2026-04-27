"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { AlbumCoverImage } from "@/components/admin/AlbumCoverImage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { useAdminAlbums, type AdminAlbumsListResponse } from "@/hooks/useAdminAlbums";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";

interface AlbumRow {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  coverMediaId: string | null;
  coverFileRef: string | null;
  coverForm: string | null;
}

function mapApiToRows(api: AdminAlbumsListResponse): AlbumRow[] {
  return (api?.albums ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: (a.description ?? "").trim() || "—",
    isPublic: a.isPublic,
    coverMediaId: a.coverMediaId,
    coverFileRef: a.coverFileRef ?? null,
    coverForm: a.coverForm ?? null,
  }));
}

function buildAlbumsConfig(
  router: ReturnType<typeof useRouter>,
  queryClient: QueryClient,
): DataViewerConfig<AlbumRow> {
  return {
    id: "albums",
    labels: { singular: "Album", plural: "Albums" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "name", header: "Name", enableSorting: true },
      {
        accessorKey: "isPublic",
        header: "Public",
        cell: ({ row }) => (row.getValue("isPublic") ? "Yes" : "No"),
        enableSorting: true,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => {
          const d = (row.getValue("description") as string).trim();
          if (!d || d === "—") return <span className="text-muted-foreground">—</span>;
          return <span className="line-clamp-2 max-w-[28rem] text-muted-foreground">{d}</span>;
        },
      },
    ],
    renderCard: ({ record, onView, onEdit, onDelete }) => (
      <Card className="h-full min-h-0 overflow-hidden border-base-content/12 pt-0 shadow-sm shadow-black/10">
        <AlbumCoverImage
          variant="card"
          name={record.name}
          coverMediaId={record.coverMediaId}
          coverFileRef={record.coverFileRef}
          coverForm={record.coverForm}
        />
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{record.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{record.isPublic ? "Public" : "Personal"}</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="line-clamp-3">{record.description === "—" ? "No description" : record.description}</p>
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={onDelete} />
      </Card>
    ),
    actions: {
      add: { label: "New album", handler: () => router.push("/admin/albums/new") },
      view: {
        label: "View",
        handler: (record) => router.push(`/admin/albums/${record.id}`),
      },
      edit: {
        label: "Edit",
        handler: (record) => router.push(`/admin/albums/${record.id}/edit`),
      },
      delete: {
        label: "Delete",
        handler: (record) => {
          void (async () => {
            if (!window.confirm(`Delete album “${record.name}”? Media stays in the archive.`)) return;
            try {
              await deleteJson(`/api/admin/albums/${record.id}`);
              await queryClient.invalidateQueries({ queryKey: ["admin", "albums"] });
              toast.success("Album deleted.");
            } catch (e) {
              toast.error(e instanceof ApiError ? e.message : "Could not delete album.");
            }
          })();
        },
      },
    },
  };
}

export default function AdminAlbumsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminAlbums(queryOpts);

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildAlbumsConfig(router, queryClient), [router, queryClient]);

  return (
    <AdminListPageShell
      title="Albums"
      description="Collections for organizing tree media. Link media to albums from the media editor."
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="albums-filter-q">Search albums</Label>
            <Input
              id="albums-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name contains…"
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
        defaultViewMode="table"
        viewModeKey="admin-albums-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
