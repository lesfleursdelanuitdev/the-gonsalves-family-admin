"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadStoryIndex, deleteStoryDocument } from "@/lib/admin/story-creator/story-storage";
import type {
  StoryDocumentKind,
  StoryIndexEntry,
  StoryLifecycleStatus,
} from "@/lib/admin/story-creator/story-types";

function kindLabel(kind: StoryDocumentKind | undefined): string {
  switch (kind ?? "story") {
    case "article":
      return "Article";
    case "post":
      return "Post";
    default:
      return "Story";
  }
}

function displayTitle(title: string): string {
  const t = title.trim();
  return t || "Untitled story";
}

function lifecycleLabel(status: StoryLifecycleStatus): string {
  return status === "published" ? "Published" : "Draft";
}

interface StoryRow {
  id: string;
  title: string;
  displayTitle: string;
  kind?: StoryDocumentKind;
  kindLabel: string;
  status: StoryLifecycleStatus;
  statusLabel: string;
  updatedAt: string;
}

function mapIndexToRow(e: StoryIndexEntry): StoryRow {
  const status: StoryLifecycleStatus = e.status === "published" ? "published" : "draft";
  return {
    id: e.id,
    title: e.title,
    displayTitle: displayTitle(e.title),
    kind: e.kind,
    kindLabel: kindLabel(e.kind),
    status,
    statusLabel: lifecycleLabel(status),
    updatedAt: e.updatedAt,
  };
}

function buildStoriesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: StoryRow) => void,
): DataViewerConfig<StoryRow> {
  return {
    id: "stories",
    labels: { singular: "Story", plural: "Stories" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    defaultSorting: [{ id: "updatedAt", desc: true }],
    columns: [
      {
        accessorKey: "displayTitle",
        header: "Title",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-medium text-primary">{row.original.displayTitle}</span>
        ),
      },
      {
        accessorKey: "kindLabel",
        header: "Type",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="badge badge-outline badge-sm shrink-0 border-primary/25 font-medium text-primary">
            {row.original.kindLabel}
          </span>
        ),
      },
      {
        accessorKey: "statusLabel",
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => {
          const published = row.original.status === "published";
          return (
            <span
              className={
                published
                  ? "badge badge-success badge-sm border-transparent font-medium"
                  : "badge badge-ghost badge-sm border-base-content/15 font-medium text-base-content/80"
              }
            >
              {row.original.statusLabel}
            </span>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {new Date(row.original.updatedAt).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
    ],
    renderCard: ({ record, onView, onDelete }) => (
      <Card className="h-full min-h-0 border-base-content/12 shadow-sm shadow-black/10">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-2">
            <ScrollText className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="text-base leading-snug text-primary">{record.displayTitle}</CardTitle>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                <span className="badge badge-outline badge-sm border-primary/25 font-medium text-primary">
                  {record.kindLabel}
                </span>
                <span
                  className={
                    record.status === "published"
                      ? "badge badge-success badge-sm border-transparent font-medium"
                      : "badge badge-ghost badge-sm border-base-content/15 font-medium text-base-content/80"
                  }
                >
                  {record.statusLabel}
                </span>
                <span className="text-base-content/30">·</span>
                <span className="tabular-nums">
                  {new Date(record.updatedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Synced to the server for this admin tree.</p>
        </CardContent>
        <CardActionFooter onView={onView} onDelete={onDelete} />
      </Card>
    ),
    actions: {
      add: { label: "New story", handler: () => router.push("/admin/stories/new") },
      view: {
        label: "Open",
        handler: (record) => router.push(`/admin/stories/${record.id}`),
      },
      delete: {
        label: "Delete",
        handler: onDelete,
      },
    },
  };
}

export default function AdminStoriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<StoryIndexEntry[]>([]);
  const [draftTitle, setDraftTitle] = useState("");
  const [appliedTitle, setAppliedTitle] = useState("");

  const refresh = useCallback(async () => {
    try {
      const rows = await loadStoryIndex();
      setEntries(rows);
    } catch (e) {
      console.error(e);
      toast.error("Could not load stories", {
        description: e instanceof Error ? e.message : undefined,
      });
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const baseRows = useMemo(() => entries.map(mapIndexToRow), [entries]);

  const rows = useMemo(() => {
    const q = appliedTitle.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter(
      (r) =>
        r.displayTitle.toLowerCase().includes(q) ||
        r.kindLabel.toLowerCase().includes(q) ||
        r.statusLabel.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q),
    );
  }, [baseRows, appliedTitle]);

  const applyFilters = useCallback(() => {
    setAppliedTitle(draftTitle.trim());
  }, [draftTitle]);

  const clearFilters = useCallback(() => {
    setDraftTitle("");
    setAppliedTitle("");
  }, []);

  const activeFilterCount = appliedTitle.trim() ? 1 : 0;

  const handleDelete = useCallback(
    async (row: StoryRow) => {
      if (!window.confirm(`Delete “${row.displayTitle}”? This marks the story as deleted on the server.`)) return;
      try {
        await deleteStoryDocument(row.id);
        await refresh();
        toast.success("Story deleted.");
      } catch (e) {
        toast.error("Delete failed", { description: e instanceof Error ? e.message : undefined });
      }
    },
    [refresh],
  );

  const config = useMemo(() => buildStoriesConfig(router, handleDelete), [router, handleDelete]);

  return (
    <AdminListPageShell
      title="Stories"
      description="Block-based family stories with a flexible section outline. Drafts and published stories are stored in the database for this admin tree."
      headerExtra={
        entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No stories yet — use{" "}
            <span className="inline-flex items-center gap-1 font-medium text-base-content">
              <Plus className="size-3.5" aria-hidden />
              New story
            </span>{" "}
            in the toolbar to create one.
          </p>
        ) : null
      }
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={activeFilterCount}>
          <div className="space-y-2">
            <Label htmlFor="stories-filter-title">Search stories</Label>
            <Input
              id="stories-filter-title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Title, type, draft, or published…"
            />
            <p className="text-xs text-muted-foreground">
              Matches title, story type, or status. Click Apply to filter the list below.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={false}
        defaultViewMode="table"
        viewModeKey="admin-stories-view"
        skipClientGlobalFilter
        paginationResetKey={appliedTitle}
        totalCount={entries.length}
      />
    </AdminListPageShell>
  );
}
