"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MailPlus } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAdminMessages,
  useAdminMessage,
  useMarkMessageRead,
  useDeleteMessage,
  type AdminMessagesListResponse,
} from "@/hooks/useAdminMessages";
import { useCurrentUser } from "@/hooks/useAuth";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { toast } from "sonner";

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

type FilterTab = "all" | "inbox" | "sent";

export default function AdminMessagesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; subject: string } | null>(null);

  const { data: currentUser } = useCurrentUser();
  const { data, isLoading } = useAdminMessages({
    q: search.trim() || undefined,
    filter,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });
  const { data: detailMessage, isLoading: detailLoading } = useAdminMessage(detailId);
  const markRead = useMarkMessageRead();
  const deleteMessage = useDeleteMessage();

  useEffect(() => {
    if (!detailId || !detailMessage || !currentUser?.id) return;
    if (detailMessage.recipientId !== currentUser.id || detailMessage.isRead) return;
    markRead.mutate(
      { id: detailId, isRead: true },
      {
        onError: () => toast.error("Could not mark message as read"),
      },
    );
  }, [detailId, detailMessage, currentUser?.id, markRead]);

  const openDetail = useCallback((row: MessageRow) => setDetailId(row.id), []);
  const requestDelete = useCallback((row: MessageRow) => {
    setDeleteTarget({ id: row.id, subject: row.subject });
  }, []);

  const config: DataViewerConfig<MessageRow> = useMemo(
    () => ({
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
            return read ? null : (
              <span className="inline-block size-2 rounded-full bg-blue-500" title="Unread" />
            );
          },
          enableSorting: false,
        },
        { accessorKey: "from", header: "From", enableSorting: true },
        { accessorKey: "to", header: "To" },
        { accessorKey: "subject", header: "Subject", enableSorting: true },
        { accessorKey: "date", header: "Date", enableSorting: true },
      ],
      renderCard: ({ record, onView, onDelete }) => (
        <Card
          className={
            record.isRead ? "" : "border-blue-300 bg-blue-50/30 dark:bg-blue-950/20"
          }
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {!record.isRead && <span className="inline-block size-2 rounded-full bg-blue-500" />}
              <CardTitle className="text-base">{record.subject}</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">{record.date}</p>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              From: {record.from} → {record.to}
            </p>
          </CardContent>
          <CardActionFooter onView={onView} onDelete={onDelete} />
        </Card>
      ),
      actions: {
        view: { label: "View", handler: openDetail },
        delete: { label: "Delete", handler: requestDelete },
      },
    }),
    [openDetail, requestDelete],
  );

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMessage.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Message deleted");
        setDeleteTarget(null);
        if (detailId === deleteTarget.id) setDetailId(null);
      },
      onError: () => toast.error("Could not delete message"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">
            Inbox-style list for this tree: roles, contributors, and linked individuals. Compose, mark read, and
            delete (per ADMINISTRATION_PLAN §5.2).
          </p>
        </div>
        <Link
          href="/admin/messages/new"
          className={cn(buttonVariants({ variant: "default", size: "default" }), "inline-flex shrink-0 items-center")}
        >
          <MailPlus className="mr-2 size-4" aria-hidden />
          Compose
        </Link>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Message folder">
        {(
          [
            ["all", "All"],
            ["inbox", "Inbox"],
            ["sent", "Sent"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
            role="tab"
            aria-selected={filter === key}
          >
            {label}
          </Button>
        ))}
      </div>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-messages-view"
        globalFilter={search}
        onGlobalFilterChange={setSearch}
        skipClientGlobalFilter
        paginationResetKey={`${filter}-${search.trim()}`}
      />

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg border-border bg-background p-4 sm:p-6">
          <div className="space-y-2">
            <DialogTitle className="pr-8">
              {detailLoading ? "Loading…" : (detailMessage?.subject ?? "(no subject)")}
            </DialogTitle>
            <DialogDescription className="text-left text-sm text-muted-foreground">
              {detailMessage ? (
                <>
                  From{" "}
                  <span className="font-medium text-base-content">
                    {detailMessage.sender.name ?? detailMessage.sender.username}
                  </span>{" "}
                  →{" "}
                  <span className="font-medium text-base-content">
                    {detailMessage.recipient
                      ? detailMessage.recipient.name ?? detailMessage.recipient.username
                      : "—"}
                  </span>
                  <span className="mt-1 block text-xs">
                    {detailMessage.createdAt ? formatDate(detailMessage.createdAt) : ""}
                    {detailMessage.isRead ? " · Read" : " · Unread"}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </div>
            {detailMessage ? (
              <div className="max-h-[50vh] overflow-y-auto rounded-md border border-base-content/10 bg-base-200/30 p-3 text-sm whitespace-pre-wrap text-base-content">
                {detailMessage.content}
              </div>
            ) : null}
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDetailId(null)}>
                Close
              </Button>
              {detailMessage && currentUser?.id === detailMessage.recipientId && !detailMessage.isRead ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={markRead.isPending}
                  onClick={() =>
                    markRead.mutate(
                      { id: detailMessage.id, isRead: true },
                      { onError: () => toast.error("Could not mark as read") },
                    )
                  }
                >
                  Mark read
                </Button>
              ) : null}
              {detailMessage ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget({
                      id: detailMessage.id,
                      subject: detailMessage.subject ?? "(no subject)",
                    });
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md border-border bg-background p-4 sm:p-6">
          <DialogTitle>Delete message?</DialogTitle>
          <DialogDescription>
            This removes{" "}
            <span className="font-medium text-base-content">{deleteTarget?.subject}</span> permanently.
          </DialogDescription>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMessage.isPending}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
