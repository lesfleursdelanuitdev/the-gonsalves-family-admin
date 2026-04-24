"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAlbums, type AdminAlbumsListResponse } from "@/hooks/useAdminAlbums";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";

interface AlbumRow {
  id: string;
  name: string;
  description: string;
}

function mapApiToRows(api: AdminAlbumsListResponse): AlbumRow[] {
  return (api?.albums ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: (a.description ?? "").trim() || "—",
  }));
}

function buildAlbumsConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<AlbumRow> {
  return {
    id: "albums",
    labels: { singular: "Album", plural: "Albums" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "name", header: "Name", enableSorting: true },
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
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{record.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p className="line-clamp-3">{record.description === "—" ? "No description" : record.description}</p>
        </CardContent>
        <CardActionFooter />
      </Card>
    ),
    actions: {
      add: { label: "New album", handler: () => router.push("/admin/albums/new") },
    },
  };
}

export default function AdminAlbumsPage() {
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const applyFilters = useCallback(() => setAppliedQ(draftQ), [draftQ]);
  const clearFilters = useCallback(() => {
    setDraftQ("");
    setAppliedQ("");
  }, []);

  const { data, isLoading } = useAdminAlbums({
    q: appliedQ.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildAlbumsConfig(router), [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Albums</h1>
        <p className="text-muted-foreground">
          Collections for organizing tree media. Link media to albums from the media editor.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={appliedQ.trim() ? 1 : 0}>
        <div className="space-y-2">
          <Label htmlFor="albums-filter-q">Search albums</Label>
          <Input
            id="albums-filter-q"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Name contains…"
          />
          <p className="text-xs text-muted-foreground">
            Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
          </p>
        </div>
      </FilterPanel>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-albums-view"
        skipClientGlobalFilter
        paginationResetKey={appliedQ}
        totalCount={data?.total}
      />
    </div>
  );
}
