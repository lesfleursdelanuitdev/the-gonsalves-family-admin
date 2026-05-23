"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { PublicIntakeStatusBadge } from "@/components/admin/PublicIntakeStatusBadge";
import { ContributionTypeBadge } from "@/components/admin/ContributionTypeBadge";
import {
  useAdminContributions,
  useDeleteContribution,
  type AdminContributionsListResponse,
} from "@/hooks/useAdminContributions";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { useQueryClient } from "@tanstack/react-query";
import type { ContributionType, PublicIntakeStatus } from "@ligneous/prisma";

interface ContributionRow {
  id: string;
  type: ContributionType;
  contributorName: string;
  email: string;
  status: PublicIntakeStatus;
  attachments: number;
  individuals: number;
  date: string;
}

function mapApiToRows(api: AdminContributionsListResponse): ContributionRow[] {
  return (api?.contributions ?? []).map((c) => ({
    id: c.id,
    type: c.type,
    contributorName: `${c.contributorFirstName} ${c.contributorLastName}`.trim() || "—",
    email: c.contributorEmail,
    status: c.status,
    attachments: c._count.attachments,
    individuals: c._count.individuals,
    date: new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: ContributionRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<ContributionRow> {
  return {
    id: "contributions",
    labels: { singular: "Contribution", plural: "Contributions" },
    getRowId: (r) => r.id,
    enableRowSelection: true,
    columns: [
      {
        accessorKey: "type",
        header: "Type",
        enableSorting: true,
        cell: ({ row }) => <ContributionTypeBadge type={row.getValue<string>("type")} size="sm" />,
      },
      { accessorKey: "contributorName", header: "Name", enableSorting: true },
      { accessorKey: "email", header: "Email", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <PublicIntakeStatusBadge status={row.getValue<string>("status")} size="sm" />,
      },
      {
        accessorKey: "attachments",
        header: "Files",
        enableSorting: true,
        cell: ({ row }) => {
          const n = row.getValue<number>("attachments");
          return n > 0 ? n : <span className="text-muted-foreground">—</span>;
        },
      },
      { accessorKey: "date", header: "Submitted", enableSorting: true },
    ],
    renderCard: ({ record }) => (
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => router.push(`/admin/contributions/${record.id}`)}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Layers className="size-4 shrink-0 text-muted-foreground" />
              <ContributionTypeBadge type={record.type} size="sm" />
            </div>
            <PublicIntakeStatusBadge status={record.status} size="sm" />
          </div>
          <CardTitle className="mt-1 text-sm">{record.contributorName}</CardTitle>
          <p className="text-xs text-muted-foreground">{record.email}</p>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          <span>{record.date}</span>
          {record.attachments > 0 && (
            <span> · {record.attachments} file{record.attachments !== 1 ? "s" : ""}</span>
          )}
        </CardContent>
        <CardActionFooter
          onView={() => router.push(`/admin/contributions/${record.id}`)}
          onDelete={() => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      view: { label: "Open", handler: (r) => router.push(`/admin/contributions/${r.id}`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminContributionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteContribution = useDeleteContribution();

  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const extendedOpts = useMemo(
    () => ({
      ...queryOpts,
      ...(typeFilter ? { type: typeFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [queryOpts, typeFilter, statusFilter],
  );

  const { data, isLoading } = useAdminContributions(extendedOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: ContributionRow) => {
      if (!window.confirm(`Delete contribution from "${r.contributorName}"? This also removes all attachments and linked individuals. This cannot be undone.`)) return;
      try {
        await deleteContribution.mutateAsync(r.id);
        toast.success("Contribution deleted.");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete contribution.");
      }
    },
    [deleteContribution],
  );

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/contributions/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "contributions"] });
  }, [queryClient]);

  const activeFilterCount =
    adminListQActiveFilterCount(applied) + (typeFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  const config = useMemo(
    () => buildConfig(router, handleDelete, bulkDeleteOne),
    [router, handleDelete, bulkDeleteOne],
  );

  return (
    <AdminListPageShell
      title="Contributions"
      description="Memories, suggestions, recipes, and folklore submitted by visitors."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={() => { clearFilters(); setTypeFilter(""); setStatusFilter(""); }}
          activeFilterCount={activeFilterCount}
        >
          <div className="space-y-2">
            <Label htmlFor="contributions-filter-q">Search</Label>
            <Input
              id="contributions-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name, email, or content"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contributions-filter-type">Type</Label>
            <select
              id="contributions-filter-type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={selectClassName}
            >
              <option value="">All types</option>
              <option value="memory">Memory</option>
              <option value="suggestion">Suggestion</option>
              <option value="recipe">Recipe</option>
              <option value="language">Language</option>
              <option value="folklore">Folklore</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contributions-filter-status">Status</Label>
            <select
              id="contributions-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={selectClassName}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="archived">Archived</option>
              <option value="spam">Spam</option>
            </select>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-contributions-view"
        skipClientGlobalFilter
        paginationResetKey={`${applied.q ?? ""}|${typeFilter}|${statusFilter}`}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
