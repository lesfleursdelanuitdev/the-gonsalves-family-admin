"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { PublicIntakeStatusBadge } from "@/components/admin/PublicIntakeStatusBadge";
import {
  useAdminRegistrationRequests,
  useDeleteRegistrationRequest,
  type AdminRegistrationRequestsListResponse,
} from "@/hooks/useAdminRegistrationRequests";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicIntakeStatus } from "@ligneous/prisma";

interface RegistrationRow {
  id: string;
  fullName: string;
  email: string;
  preferredUsername: string;
  status: PublicIntakeStatus;
  date: string;
}

function mapApiToRows(api: AdminRegistrationRequestsListResponse): RegistrationRow[] {
  return (api?.requests ?? []).map((r) => ({
    id: r.id,
    fullName: `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    preferredUsername: r.preferredUsername,
    status: r.status,
    date: new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: RegistrationRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<RegistrationRow> {
  return {
    id: "registration-requests",
    labels: { singular: "Request", plural: "Requests" },
    getRowId: (r) => r.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "fullName", header: "Name", enableSorting: true },
      { accessorKey: "email", header: "Email", enableSorting: true },
      { accessorKey: "preferredUsername", header: "Username", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <PublicIntakeStatusBadge status={row.getValue<string>("status")} size="sm" />,
      },
      { accessorKey: "date", header: "Submitted", enableSorting: true },
    ],
    renderCard: ({ record }) => (
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => router.push(`/admin/registration-requests/${record.id}`)}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <UserPlus className="size-4 shrink-0 text-muted-foreground" />
              <CardTitle className="truncate text-sm">{record.fullName}</CardTitle>
            </div>
            <PublicIntakeStatusBadge status={record.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">@{record.preferredUsername} · {record.email}</p>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">{record.date}</CardContent>
        <CardActionFooter
          onView={() => router.push(`/admin/registration-requests/${record.id}`)}
          onDelete={() => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      view: { label: "Open", handler: (r) => router.push(`/admin/registration-requests/${r.id}`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminRegistrationRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteRequest = useDeleteRegistrationRequest();

  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();
  const [statusFilter, setStatusFilter] = useState("");

  const extendedOpts = useMemo(
    () => ({ ...queryOpts, ...(statusFilter ? { status: statusFilter } : {}) }),
    [queryOpts, statusFilter],
  );

  const { data, isLoading } = useAdminRegistrationRequests(extendedOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: RegistrationRow) => {
      if (!window.confirm(`Delete registration request from "${r.fullName}"? This cannot be undone.`)) return;
      try {
        await deleteRequest.mutateAsync(r.id);
        toast.success("Request deleted.");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete request.");
      }
    },
    [deleteRequest],
  );

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/registration-requests/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "registration-requests"] });
  }, [queryClient]);

  const activeFilterCount = adminListQActiveFilterCount(applied) + (statusFilter ? 1 : 0);
  const config = useMemo(
    () => buildConfig(router, handleDelete, bulkDeleteOne),
    [router, handleDelete, bulkDeleteOne],
  );

  return (
    <AdminListPageShell
      title="Registration requests"
      description="Requests from visitors who want to create an account."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={() => { clearFilters(); setStatusFilter(""); }}
          activeFilterCount={activeFilterCount}
        >
          <div className="space-y-2">
            <Label htmlFor="rr-filter-q">Search</Label>
            <Input
              id="rr-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name, email, or username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rr-filter-status">Status</Label>
            <select id="rr-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClassName}>
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
        viewModeKey="admin-registration-requests-view"
        skipClientGlobalFilter
        paginationResetKey={`${applied.q ?? ""}|${statusFilter}`}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
