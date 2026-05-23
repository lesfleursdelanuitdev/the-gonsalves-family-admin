"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, DatabaseBackup, RefreshCw } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminBackups, useCreateBackup, useDeleteBackup, type AdminBackup } from "@/hooks/useAdminBackups";
import { ApiError } from "@/lib/infra/api";

function formatBytes(bytes: string | null): string {
  if (!bytes) return "—";
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETE: "rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 dark:text-green-400",
  RUNNING:  "rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400",
  PENDING:  "rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400",
  FAILED:   "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive",
};

interface BackupRow {
  id: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  trigger: string;
  fileSize: string | null;
  schemaVersion: string;
  errorMessage: string | null;
}

function buildConfig(
  onDownload: (row: BackupRow) => void,
  onDelete: (row: BackupRow) => void,
): DataViewerConfig<BackupRow> {
  return {
    id: "backups",
    labels: { singular: "Backup", plural: "Backups" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "createdAt",
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => formatDate(row.getValue("createdAt") as string),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => (
          <span className={STATUS_BADGE[row.getValue("status") as string] ?? ""}>
            {row.getValue("status") as string}
          </span>
        ),
      },
      {
        accessorKey: "trigger",
        header: "Trigger",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="capitalize text-sm">
            {(row.getValue("trigger") as string).toLowerCase()}
          </span>
        ),
      },
      {
        accessorKey: "fileSize",
        header: "Size",
        enableSorting: false,
        cell: ({ row }) => formatBytes(row.getValue("fileSize") as string | null),
      },
      {
        accessorKey: "schemaVersion",
        header: "Schema",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.getValue("schemaVersion") as string || "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === "COMPLETE" ? (
            <button
              onClick={() => onDownload(row.original)}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Download className="size-3" />
              Download
            </button>
          ) : null,
      },
    ],
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <DatabaseBackup className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{formatDate(record.createdAt)}</CardTitle>
          </div>
          <span className={STATUS_BADGE[record.status] ?? ""}>{record.status}</span>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>{record.trigger.toLowerCase()} • {formatBytes(record.fileSize)}</p>
          {record.schemaVersion && (
            <p className="font-mono text-xs">{record.schemaVersion}</p>
          )}
          {record.errorMessage && (
            <p className="text-xs text-destructive line-clamp-2">{record.errorMessage}</p>
          )}
        </CardContent>
        <CardActionFooter
          onView={record.status === "COMPLETE" ? () => onDownload(record) : undefined}
          onDelete={() => onDelete(record)}
        />
      </Card>
    ),
    actions: {
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

function mapToRow(b: AdminBackup): BackupRow {
  return {
    id: b.id,
    createdAt: b.createdAt,
    completedAt: b.completedAt,
    status: b.status,
    trigger: b.trigger,
    fileSize: b.fileSize,
    schemaVersion: b.schemaVersion,
    errorMessage: b.errorMessage,
  };
}

export default function AdminBackupsPage() {
  const list = useAdminBackups();
  const create = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => (list.data?.backups ?? []).map(mapToRow), [list.data]);

  const onDownload = useCallback((row: BackupRow) => {
    window.location.href = `/api/admin/backups/${row.id}/download`;
  }, []);

  const onDelete = useCallback(async (row: BackupRow) => {
    if (!window.confirm(`Delete backup from ${formatDate(row.createdAt)}? The file will be removed from disk.`)) return;
    try {
      await deleteBackup.mutateAsync(row.id);
      toast.success("Backup deleted.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete backup.");
    }
  }, [deleteBackup]);

  const onCreateBackup = useCallback(async () => {
    setCreating(true);
    try {
      await create.mutateAsync();
      toast.success("Backup created successfully.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Backup failed.");
    } finally {
      setCreating(false);
    }
  }, [create]);

  const config = useMemo(() => buildConfig(onDownload, onDelete), [onDownload, onDelete]);

  const loadErrorMessage = useMemo(() => {
    if (!list.isError) return null;
    if (list.error instanceof ApiError) return list.error.message;
    if (list.error instanceof Error) return list.error.message;
    return "Could not load backups.";
  }, [list.error, list.isError]);

  return (
    <AdminListPageShell
      title="Backups"
      description="On-demand and scheduled backups of the complete archive. Each backup includes a pg_dump, GEDCOM export, and all media files."
      headerExtra={
        <Button onClick={onCreateBackup} disabled={creating} className="gap-1.5">
          {creating ? (
            <><RefreshCw className="size-4 animate-spin" />Creating backup…</>
          ) : (
            <><DatabaseBackup className="size-4" />Create backup</>
          )}
        </Button>
      }
    >
      {creating && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardContent className="py-4 text-sm text-blue-700 dark:text-blue-300">
            Backup in progress — this may take several minutes for large archives. Please wait.
          </CardContent>
        </Card>
      )}
      {loadErrorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Could not load backups</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{loadErrorMessage}</p>
            <Button variant="outline" onClick={() => void list.refetch()}>Retry</Button>
          </CardContent>
        </Card>
      ) : null}
      <DataViewer
        config={config}
        data={rows}
        isLoading={list.isLoading}
        viewModeKey="admin-backups-view"
        totalCount={rows.length}
      />
    </AdminListPageShell>
  );
}
