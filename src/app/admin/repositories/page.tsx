"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Library, MapPin, Phone } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import {
  useAdminRepositories,
  useDeleteRepository,
  type AdminRepositoriesListResponse,
} from "@/hooks/useAdminRepositories";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { useQueryClient } from "@tanstack/react-query";

interface RepositoryRow {
  id: string;
  xref: string;
  name: string;
  location: string;
  contact: string;
  sourceCount: number;
}

function mapApiToRows(api: AdminRepositoriesListResponse): RepositoryRow[] {
  return (api?.repositories ?? []).map((r) => {
    const locationParts = [r.city, r.state, r.country].filter(Boolean);
    const contactParts = [r.email, r.phone, r.website].filter(Boolean);
    return {
      id: r.id,
      xref: r.xref,
      name: r.name ?? "—",
      location: locationParts.length ? locationParts.join(", ") : "—",
      contact: contactParts.length ? contactParts.join(" · ") : "—",
      sourceCount: r._count.sourceRepositories,
    };
  });
}

function buildRepositoriesConfig(
  onDelete: (r: RepositoryRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
  onView: (r: RepositoryRow) => void,
): DataViewerConfig<RepositoryRow> {
  return {
    id: "repositories",
    labels: { singular: "Repository", plural: "Repositories" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      {
        accessorKey: "xref",
        header: "XREF",
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/admin/repositories/${row.original.id}`} className="font-mono text-primary underline-offset-2 hover:underline">
            {row.getValue<string>("xref")}
          </Link>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        enableSorting: true,
        cell: ({ row }) => (
          <Link href={`/admin/repositories/${row.original.id}`} className="underline-offset-2 hover:underline">
            {row.getValue<string>("name")}
          </Link>
        ),
      },
      { accessorKey: "location", header: "Location", enableSorting: true },
      { accessorKey: "contact", header: "Contact", enableSorting: true },
      {
        accessorKey: "sourceCount",
        header: "Sources",
        enableSorting: true,
        cell: ({ row }) => {
          const count = row.getValue<number>("sourceCount");
          return count > 0 ? count : <span className="text-muted-foreground">—</span>;
        },
      },
    ],
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Library className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">
              <Link href={`/admin/repositories/${record.id}`} className="hover:underline underline-offset-2">
                {record.name}
              </Link>
            </CardTitle>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{record.xref}</p>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {record.location !== "—" && (
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span>{record.location}</span>
            </div>
          )}
          {record.contact !== "—" && (
            <div className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" />
              <span className="truncate">{record.contact}</span>
            </div>
          )}
          {record.sourceCount > 0 && (
            <p className="text-xs">{record.sourceCount} source{record.sourceCount !== 1 ? "s" : ""}</p>
          )}
        </CardContent>
        <CardActionFooter onView={() => onView(record)} onDelete={() => onDelete(record)} />
      </Card>
    ),
    actions: {
      view: { label: "View", handler: onView },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminRepositoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteRepository = useDeleteRepository();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();
  const { data, isLoading } = useAdminRepositories(queryOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleView = useCallback((r: RepositoryRow) => {
    router.push(`/admin/repositories/${r.id}`);
  }, [router]);

  const handleDelete = useCallback(
    async (r: RepositoryRow) => {
      const label = r.name !== "—" ? r.name : r.xref;
      if (
        !window.confirm(
          `Delete repository "${label}"?\n\nThis will also remove all source-repository links. This cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteRepository.mutateAsync(r.id);
        toast.success(`Deleted repository: ${label}.`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete repository.");
      }
    },
    [deleteRepository],
  );

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/repositories/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "repositories"] });
  }, [queryClient]);

  const config = useMemo(
    () => buildRepositoriesConfig(handleDelete, bulkDeleteOne, handleView),
    [handleDelete, bulkDeleteOne, handleView],
  );

  return (
    <AdminListPageShell
      title="Repositories"
      description="GEDCOM repository records — archives, libraries, and institutions holding source materials."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={clearFilters}
          activeFilterCount={adminListQActiveFilterCount(applied)}
        >
          <div className="space-y-2">
            <Label htmlFor="repositories-filter-q">Search repositories</Label>
            <Input
              id="repositories-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name, XREF, city, or country"
            />
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-repositories-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
