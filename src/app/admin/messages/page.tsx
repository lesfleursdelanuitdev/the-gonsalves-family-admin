"use client";

import { useState, useMemo } from "react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAdminMessages, type AdminMessagesListResponse } from "@/hooks/useAdminMessages";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";

interface MessageRow {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  isRead: boolean;
}

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function mapApiToRows(api: AdminMessagesListResponse): MessageRow[] {
  return (api?.messages ?? []).map((m) => ({
    id: m.id,
    from: m.sender?.name ?? m.sender?.username ?? "—",
    to: m.recipient?.name ?? m.recipient?.username ?? "—",
    subject: m.subject ?? "(no subject)",
    date: formatDate(m.createdAt),
    isRead: m.isRead ?? false,
  }));
}

const config: DataViewerConfig<MessageRow> = {
  id: "messages",
  labels: { singular: "Message", plural: "Messages" },
  getRowId: (row) => row.id,
  globalFilterColumnId: "subject",
  enableRowSelection: true,
  columns: [
    {
      accessorKey: "isRead",
      header: "",
      cell: ({ row }) => {
        const read = row.getValue("isRead") as boolean;
        return read ? null : <span className="inline-block size-2 rounded-full bg-blue-500" title="Unread" />;
      },
      enableSorting: false,
    },
    { accessorKey: "from", header: "From", enableSorting: true },
    { accessorKey: "to", header: "To" },
    { accessorKey: "subject", header: "Subject", enableSorting: true },
    { accessorKey: "date", header: "Date", enableSorting: true },
  ],
  renderCard: ({ record, onView, onDelete }) => (
    <Card className={record.isRead ? "" : "border-blue-300 bg-blue-50/30 dark:bg-blue-950/20"}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {!record.isRead && <span className="inline-block size-2 rounded-full bg-blue-500" />}
          <CardTitle className="text-base">{record.subject}</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">{record.date}</p>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>From: {record.from} → {record.to}</p>
      </CardContent>
      <CardActionFooter onView={onView} onDelete={onDelete} />
    </Card>
  ),
  actions: {
    view: { label: "View", handler: (r) => alert(`View: ${r.subject}`) },
    delete: { label: "Delete", handler: (r) => alert(`Delete: ${r.subject}`) },
  },
};

export default function AdminMessagesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminMessages({
    q: search.trim() || undefined,
    filter: "all",
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          View and manage user messages for this tree.
        </p>
      </div>
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-messages-view"
        globalFilter={search}
        onGlobalFilterChange={setSearch}
      />
    </div>
  );
}
