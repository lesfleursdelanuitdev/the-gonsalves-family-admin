"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { selectClassName } from "@/components/data-viewer/constants";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { AccessRequestStatusBadge } from "@/components/admin/AccessRequestStatusBadge";
import {
  useAdminAccessRequests,
  useDeleteAccessRequest,
  type AdminAccessRequestsListResponse,
} from "@/hooks/useAdminAccessRequests";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { useQueryClient } from "@tanstack/react-query";
import type { AccessRequestStatus, AccessRequestType } from "@ligneous/prisma";

const REQUEST_TYPE_LABELS: Record<AccessRequestType, string> = {
  basic_access: "Basic access",
  individual_link: "Individual link",
  contributor_role: "Contributor role",
  maintainer_role: "Maintainer role",
  owner_role: "Owner role",
};

interface AccessRequestRow {
  id: string;
  requestType: AccessRequestType;
  requestTypeLabel: string;
  userName: string;
  userEmail: string;
  status: AccessRequestStatus;
  date: string;
}

function mapApiToRows(api: AdminAccessRequestsListResponse): AccessRequestRow[] {
  return (api?.requests ?? []).map((r) => ({
    id: r.id,
    requestType: r.requestType,
    requestTypeLabel: REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType,
    userName: r.user.name?.trim() || r.user.username,
    userEmail: r.user.email,
    status: r.status,
    date: new Date(r.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }));
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: AccessRequestRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<AccessRequestRow> {
  return {
    id: "access-requests",
    labels: { singular: "Request", plural: "Requests" },
    getRowId: (r) => r.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "requestTypeLabel", header: "Type", enableSorting: true },
      { accessorKey: "userName", header: "User", enableSorting: true },
      { accessorKey: "userEmail", header: "Email", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <AccessRequestStatusBadge status={row.getValue<string>("status")} size="sm" />,
      },
      { accessorKey: "date", header: "Requested", enableSorting: true },
    ],
    renderCard: ({ record }) => (
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => router.push(`/admin/access-requests/${record.id}`)}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
              <CardTitle className="truncate text-sm">{record.requestTypeLabel}</CardTitle>
            </div>
            <AccessRequestStatusBadge status={record.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">{record.userName} · {record.userEmail}</p>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">{record.date}</CardContent>
        <CardActionFooter
          onView={() => router.push(`/admin/access-requests/${record.id}`)}
          onDelete={() => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      view: { label: "Open", handler: (r) => router.push(`/admin/access-requests/${r.id}`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminAccessRequestsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteRequest = useDeleteAccessRequest();

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

  const { data, isLoading } = useAdminAccessRequests(extendedOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: AccessRequestRow) => {
      if (!window.confirm(`Delete access request from "${r.userName}"? This cannot be undone.`)) return;
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
    await deleteJson(`/api/admin/access-requests/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "access-requests"] });
  }, [queryClient]);

  const activeFilterCount =
    adminListQActiveFilterCount(applied) + (typeFilter ? 1 : 0) + (statusFilter ? 1 : 0);

  const config = useMemo(
    () => buildConfig(router, handleDelete, bulkDeleteOne),
    [router, handleDelete, bulkDeleteOne],
  );

  return (
    <AdminListPageShell
      title="Access requests"
      description="Requests from registered users for additional access or roles."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={() => { clearFilters(); setTypeFilter(""); setStatusFilter(""); }}
          activeFilterCount={activeFilterCount}
        >
          <div className="space-y-2">
            <Label htmlFor="ar-filter-q">Search user</Label>
            <Input
              id="ar-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name, username, or email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-filter-type">Request type</Label>
            <select id="ar-filter-type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClassName}>
              <option value="">All types</option>
              <option value="basic_access">Basic access</option>
              <option value="individual_link">Individual link</option>
              <option value="contributor_role">Contributor role</option>
              <option value="maintainer_role">Maintainer role</option>
              <option value="owner_role">Owner role</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ar-filter-status">Status</Label>
            <select id="ar-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClassName}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
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
        viewModeKey="admin-access-requests-view"
        skipClientGlobalFilter
        paginationResetKey={`${applied.q ?? ""}|${typeFilter}|${statusFilter}`}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
