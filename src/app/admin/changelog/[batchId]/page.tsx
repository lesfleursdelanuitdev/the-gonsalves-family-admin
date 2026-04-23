"use client";

import { use, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Undo2, Clock, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useChangelogBatch, useUndoBatch } from "@/hooks/useChangelog";
import { UndoConfirmDialog } from "@/components/admin/UndoConfirmDialog";

function ChangesetViewer({ changeset }: { changeset: unknown }) {
  const cs = changeset as Record<string, unknown>;
  if (!cs) return null;

  if (cs.snapshot) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Snapshot</span>
        <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
          {JSON.stringify(cs.snapshot, null, 2)}
        </pre>
      </div>
    );
  }

  if (cs.before && cs.after) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase text-muted-foreground">Before</span>
          <pre className="max-h-40 overflow-auto rounded bg-red-500/5 p-2 text-xs">
            {JSON.stringify(cs.before, null, 2)}
          </pre>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase text-muted-foreground">After</span>
          <pre className="max-h-40 overflow-auto rounded bg-green-500/5 p-2 text-xs">
            {JSON.stringify(cs.after, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (cs.row) {
    return (
      <div className="space-y-1">
        <span className="text-xs font-semibold uppercase text-muted-foreground">
          Junction: {String(cs.junction ?? "")}
        </span>
        <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
          {JSON.stringify(cs.row, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <pre className="max-h-40 overflow-auto rounded bg-muted/50 p-2 text-xs">
      {JSON.stringify(cs, null, 2)}
    </pre>
  );
}

const OP_COLORS: Record<string, string> = {
  create: "bg-green-500/10 text-green-400",
  update: "bg-blue-500/10 text-blue-400",
  delete: "bg-red-500/10 text-red-400",
  link: "bg-purple-500/10 text-purple-400",
  unlink: "bg-orange-500/10 text-orange-400",
};

export default function ChangelogBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = use(params);
  const router = useRouter();
  const { data, isLoading } = useChangelogBatch(batchId);
  const undoMutation = useUndoBatch();
  const [showUndo, setShowUndo] = useState(false);

  const handleUndoConfirm = useCallback(() => {
    undoMutation.mutate(batchId, {
      onSuccess: () => {
        toast.success("Change undone successfully.");
        setShowUndo(false);
        router.push("/admin/changelog");
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Undo failed: ${msg}`);
      },
    });
  }, [batchId, undoMutation, router]);

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading batch details...</div>;
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground">Batch not found.</div>;
  }

  const isUndone = !!data.undoneAt;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/changelog")}>
          <ArrowLeft className="mr-1 size-4" />
          Back
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.summary ?? "Batch Detail"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {new Date(data.createdAt).toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="size-3.5" />
            {data.user.name ?? data.user.username}
          </span>
          <span>{data.entries.length} change(s)</span>
          {isUndone && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Undone
            </span>
          )}
        </div>
      </div>

      {!isUndone && (
        <Button variant="destructive" size="sm" onClick={() => setShowUndo(true)}>
          <Undo2 className="mr-1.5 size-4" />
          Undo this batch
        </Button>
      )}

      <div className="space-y-3">
        {data.entries.map((entry, i) => (
          <Card key={entry.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OP_COLORS[entry.operation] ?? "bg-muted"}`}>
                    {entry.operation}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {entry.entityType}
                  </span>
                  {entry.entityXref && (
                    <span className="font-mono text-xs text-muted-foreground">
                      ({entry.entityXref})
                    </span>
                  )}
                </CardTitle>
                <span className="text-xs text-muted-foreground">#{i + 1}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ChangesetViewer changeset={entry.changeset} />
            </CardContent>
          </Card>
        ))}
      </div>

      <UndoConfirmDialog
        open={showUndo}
        onClose={() => setShowUndo(false)}
        onConfirm={handleUndoConfirm}
        summary={data.summary ?? "this batch"}
        isPending={undoMutation.isPending}
      />
    </div>
  );
}
