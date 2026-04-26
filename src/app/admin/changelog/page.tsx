"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { History, User, Clock } from "lucide-react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Button } from "@/components/ui/button";
import {
  useChangelogList,
  useUndoBatch,
  type ChangelogBatch,
} from "@/hooks/useChangelog";
import { UndoConfirmDialog } from "@/components/admin/UndoConfirmDialog";

interface BatchRow {
  id: string;
  batchId: string;
  summary: string;
  createdAt: string;
  username: string;
  userName: string;
  entryCount: number;
  entityTypes: string;
  operations: string;
}

function mapBatchesToRows(batches: ChangelogBatch[]): BatchRow[] {
  return batches.map((b) => ({
    id: b.batchId,
    batchId: b.batchId,
    summary: b.summary ?? "No summary",
    createdAt: new Date(b.createdAt).toLocaleString(),
    username: b.username,
    userName: b.userName ?? b.username,
    entryCount: b.entryCount,
    entityTypes: b.entityTypes.join(", "),
    operations: b.operations.join(", "),
  }));
}

function buildConfig(
  router: ReturnType<typeof useRouter>,
  onUndo: (r: BatchRow) => void,
): DataViewerConfig<BatchRow> {
  return {
    id: "changelog",
    labels: { singular: "Change", plural: "Changes" },
    getRowId: (r) => r.id,
    enableRowSelection: false,
    columns: [
      { accessorKey: "createdAt", header: "When", enableSorting: true },
      { accessorKey: "userName", header: "Who", enableSorting: true },
      { accessorKey: "summary", header: "Summary", enableSorting: true },
      {
        accessorKey: "entryCount",
        header: "Items",
        cell: ({ row }) => row.getValue("entryCount"),
      },
      { accessorKey: "entityTypes", header: "Entity types" },
      { accessorKey: "operations", header: "Operations" },
    ],
    renderCard: ({ record, onView, onDelete }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <History className="size-5 text-muted-foreground" />
            <CardTitle className="text-sm font-medium leading-snug line-clamp-2">
              {record.summary}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5" />
            {record.createdAt}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="size-3.5" />
            {record.userName}
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {record.entityTypes.split(", ").map((t) => (
              <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {t}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {record.operations.split(", ").map((o) => (
              <span key={o} className="rounded-full bg-muted px-2 py-0.5">
                {o}
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{record.entryCount} change(s)</p>
        </CardContent>
        <CardActionFooter onView={onView} onDelete={onDelete} />
      </Card>
    ),
    actions: {
      view: {
        label: "Details",
        handler: (r) => router.push(`/admin/changelog/${r.batchId}`),
      },
      delete: {
        label: "Undo",
        handler: onUndo,
      },
    },
  };
}

export default function AdminChangelogPage() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const limit = 50;
  const { data, isLoading } = useChangelogList({ limit, offset: page * limit });
  const undoMutation = useUndoBatch();

  const [undoTarget, setUndoTarget] = useState<BatchRow | null>(null);

  const handleUndoClick = useCallback((r: BatchRow) => {
    setUndoTarget(r);
  }, []);

  const handleUndoConfirm = useCallback(() => {
    if (!undoTarget) return;
    undoMutation.mutate(undoTarget.batchId, {
      onSuccess: () => {
        toast.success("Change undone successfully.");
        setUndoTarget(null);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Undo failed: ${msg}`);
      },
    });
  }, [undoTarget, undoMutation]);

  const rows = useMemo(() => (data ? mapBatchesToRows(data.batches) : []), [data]);
  const config = useMemo(() => buildConfig(router, handleUndoClick), [router, handleUndoClick]);

  return (
    <AdminListPageShell
      title="Changelog"
      description="Browse all changes made to the genealogy tree. Each entry represents a batch of related modifications. You can view details or undo an entire batch."
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        viewModeKey="admin-changelog-view"
        totalCount={data?.total}
      />

      {data && data.total > limit && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(data.total / limit)}
          </span>
          <Button variant="outline" size="sm" disabled={!data.hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      <UndoConfirmDialog
        open={!!undoTarget}
        onClose={() => setUndoTarget(null)}
        onConfirm={handleUndoConfirm}
        summary={undoTarget?.summary ?? ""}
        isPending={undoMutation.isPending}
      />
    </AdminListPageShell>
  );
}
