"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
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
  useAdminContactMessages,
  useDeleteContactMessage,
  type AdminContactMessagesListResponse,
} from "@/hooks/useAdminContactMessages";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError, deleteJson } from "@/lib/infra/api";
import { useQueryClient } from "@tanstack/react-query";
import type { PublicIntakeStatus } from "@ligneous/prisma";

interface ContactRow {
  id: string;
  senderName: string;
  email: string;
  subject: string;
  status: PublicIntakeStatus;
  replies: number;
  date: string;
}

function mapApiToRows(api: AdminContactMessagesListResponse): ContactRow[] {
  return (api?.messages ?? []).map((m) => {
    const parts = [m.firstName, m.lastName].filter(Boolean);
    return {
      id: m.id,
      senderName: parts.length ? parts.join(" ") : "—",
      email: m.email,
      subject: m.subject ?? "(no subject)",
      status: m.status,
      replies: m._count.replies,
      date: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
  });
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (r: ContactRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
): DataViewerConfig<ContactRow> {
  return {
    id: "contact-inbox",
    labels: { singular: "Message", plural: "Messages" },
    getRowId: (r) => r.id,
    enableRowSelection: true,
    columns: [
      {
        accessorKey: "subject",
        header: "Subject",
        enableSorting: true,
        cell: ({ row }) => <span className="font-medium">{row.getValue<string>("subject")}</span>,
      },
      { accessorKey: "senderName", header: "Name", enableSorting: true },
      { accessorKey: "email", header: "Email", enableSorting: true },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => <PublicIntakeStatusBadge status={row.getValue<string>("status")} size="sm" />,
      },
      {
        accessorKey: "replies",
        header: "Replies",
        enableSorting: true,
        cell: ({ row }) => {
          const n = row.getValue<number>("replies");
          return n > 0 ? n : <span className="text-muted-foreground">—</span>;
        },
      },
      { accessorKey: "date", header: "Received", enableSorting: true },
    ],
    renderCard: ({ record }) => (
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() => router.push(`/admin/contact-inbox/${record.id}`)}
      >
        <CardHeader className="pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <CardTitle className="truncate text-sm">{record.subject}</CardTitle>
            </div>
            <PublicIntakeStatusBadge status={record.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">
            {record.senderName} · {record.email}
          </p>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          <span>{record.date}</span>
          {record.replies > 0 && (
            <span> · {record.replies} {record.replies === 1 ? "reply" : "replies"}</span>
          )}
        </CardContent>
        <CardActionFooter
          onView={() => router.push(`/admin/contact-inbox/${record.id}`)}
          onDelete={() => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      view: { label: "Open", handler: (r) => router.push(`/admin/contact-inbox/${r.id}`) },
      delete: { label: "Delete", handler: onDelete, bulkDeleteOne },
    },
  };
}

export default function AdminContactInboxPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const deleteMsg = useDeleteContactMessage();

  // q filter — applied on "Apply" click
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  // status filter — separate state, applied immediately
  const [statusFilter, setStatusFilter] = useState("");

  const extendedOpts = useMemo(
    () => ({ ...queryOpts, ...(statusFilter ? { status: statusFilter } : {}) }),
    [queryOpts, statusFilter],
  );

  const { data, isLoading } = useAdminContactMessages(extendedOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: ContactRow) => {
      if (!window.confirm(`Delete message from "${r.senderName}" (${r.email})? This cannot be undone.`)) return;
      try {
        await deleteMsg.mutateAsync(r.id);
        toast.success("Message deleted.");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete message.");
      }
    },
    [deleteMsg],
  );

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteJson(`/api/admin/contact-messages/${id}`);
  }, []);

  const handleBulkDeleteFinished = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "contact-messages"] });
  }, [queryClient]);

  const config = useMemo(() => buildConfig(router, handleDelete, bulkDeleteOne), [router, handleDelete, bulkDeleteOne]);
  const activeFilterCount = adminListQActiveFilterCount(applied) + (statusFilter ? 1 : 0);

  return (
    <AdminListPageShell
      title="Contact inbox"
      description="Messages sent by visitors through the public contact form."
      filters={
        <FilterPanel
          onApply={applyFilters}
          onClear={() => { clearFilters(); setStatusFilter(""); }}
          activeFilterCount={activeFilterCount}
        >
          <div className="space-y-2">
            <Label htmlFor="contact-filter-q">Search</Label>
            <Input
              id="contact-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name, email, or subject"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact-filter-status">Status</Label>
            <select
              id="contact-filter-status"
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
        viewModeKey="admin-contact-inbox-view"
        skipClientGlobalFilter
        paginationResetKey={`${applied.q ?? ""}|${statusFilter}`}
        totalCount={data?.total}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
  );
}
