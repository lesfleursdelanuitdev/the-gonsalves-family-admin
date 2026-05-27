"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { Badge } from "@/components/ui/badge";
import { fetchJson, postJson, deleteJson, ApiError } from "@/lib/infra/api";

interface WhatsNewRow {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  statusLabel: string;
  authorName: string;
  publishedAt: string | null;
  updatedAt: string;
}

function mapPost(p: {
  id: string;
  title: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  author: { name: string | null; username: string };
}): WhatsNewRow {
  return {
    id: p.id,
    title: p.title,
    status: p.status as WhatsNewRow["status"],
    statusLabel: p.status === "published" ? "Published" : p.status === "archived" ? "Archived" : "Draft",
    authorName: p.author.name ?? p.author.username,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
  };
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: WhatsNewRow) => void,
): DataViewerConfig<WhatsNewRow> {
  return {
    id: "whats-new",
    labels: { singular: "Update", plural: "Updates" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    defaultSorting: [{ id: "updatedAt", desc: true }],
    columns: [
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "statusLabel",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={row.original.status === "published" ? "default" : "secondary"}>
            {row.original.statusLabel}
          </Badge>
        ),
      },
      {
        accessorKey: "authorName",
        header: "Author",
      },
      {
        accessorKey: "publishedAt",
        header: "Published",
        cell: ({ row }) =>
          row.original.publishedAt
            ? new Date(row.original.publishedAt).toLocaleDateString()
            : "—",
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
      },
    ],
    renderCard: ({ record, onView, onDelete }) => (
      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{record.title}</span>
          <Badge variant={record.status === "published" ? "default" : "secondary"} className="shrink-0">
            {record.statusLabel}
          </Badge>
        </div>
        <div className="text-xs text-base-content/60">{record.authorName}</div>
        {record.publishedAt && (
          <div className="text-xs text-base-content/50">
            Published {new Date(record.publishedAt).toLocaleDateString()}
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn btn-xs btn-outline" onClick={onView}>Edit</button>
          <button type="button" className="btn btn-xs btn-outline btn-error" onClick={onDelete}>Delete</button>
        </div>
      </div>
    ),
    actions: {
      add: {
        label: "New update",
        handler: () => router.push("/admin/whats-new/create"),
      },
      view: {
        label: "Edit",
        handler: (row) => router.push(`/admin/whats-new/${encodeURIComponent(row.id)}/edit`),
      },
      delete: {
        label: "Delete",
        handler: onDelete,
      },
    },
  };
}

export default function AdminWhatsNewPage() {
  const router = useRouter();
  const [rows, setRows] = useState<WhatsNewRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchJson<{ posts: Parameters<typeof mapPost>[0][] }>("/api/admin/whats-new")
      .then((data) => setRows(data.posts.map(mapPost)))
      .catch(() => toast.error("Could not load updates."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(
    (row: WhatsNewRow) => {
      if (!window.confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
      deleteJson(`/api/admin/whats-new/${encodeURIComponent(row.id)}`)
        .then(() => {
          toast.success("Update deleted.");
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        })
        .catch((e) => toast.error(e instanceof ApiError ? e.message : "Could not delete."));
    },
    [],
  );

  const config = useMemo(
    () => buildConfig(router, handleDelete),
    [router, handleDelete],
  );

  return (
    <AdminListPageShell
      title="What's New"
      description="Announcements and updates published to the family site."
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={loading}
        defaultViewMode="table"
        viewModeKey="admin-whats-new-view"
      />
    </AdminListPageShell>
  );
}
