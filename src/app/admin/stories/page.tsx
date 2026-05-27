"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { StoriesBatchEditModal } from "@/components/admin/story-creator/StoriesBatchEditModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadStoryIndex, deleteStoryDocument } from "@/lib/admin/story-creator/story-storage";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
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
    case "folklore":
      return "Folklore";
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
  tags: string[];
  linkedIndividuals: { id: string; fullName: string }[];
  tagsSearch: string;
  individualsSearch: string;
}

function mapIndexToRow(e: StoryIndexEntry): StoryRow {
  const status: StoryLifecycleStatus = e.status === "published" ? "published" : "draft";
  const tags = e.tags ?? [];
  const linkedIndividuals = (e.linkedIndividuals ?? []).map((li) => ({
    ...li,
    fullName: stripSlashesFromName(li.fullName),
  }));
  return {
    id: e.id,
    title: e.title,
    displayTitle: displayTitle(e.title),
    kind: e.kind,
    kindLabel: kindLabel(e.kind),
    status,
    statusLabel: lifecycleLabel(status),
    updatedAt: e.updatedAt,
    tags,
    linkedIndividuals,
    tagsSearch: tags.join(" ").toLowerCase(),
    individualsSearch: linkedIndividuals.map((i) => i.fullName).join(" ").toLowerCase(),
  };
}

function buildStoriesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: StoryRow) => void,
  bulkDeleteOne: (id: string) => Promise<void>,
  onBulkEdit: (ids: string[]) => void,
): DataViewerConfig<StoryRow> {
  return {
    id: "stories",
    labels: { singular: "Story", plural: "Stories" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
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
              {record.tags.length > 0 ? (
                <p className="flex flex-wrap gap-1 pt-0.5">
                  {record.tags.map((t) => (
                    <span key={t} className="badge badge-outline badge-xs border-base-content/20 text-base-content/60">
                      {t}
                    </span>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {record.linkedIndividuals.length > 0 ? (
            <p className="truncate">
              Linked: {record.linkedIndividuals.map((i) => i.fullName || "Unknown").join(", ")}
            </p>
          ) : (
            <p>Synced to the server for this admin tree.</p>
          )}
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
        bulkDeleteOne,
      },
      bulkEdit: {
        label: "Edit selected",
        handler: onBulkEdit,
      },
    },
  };
}

interface FilterDraft {
  title: string;
  tag: string;
  individual: string;
}

export default function AdminStoriesPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<StoryIndexEntry[]>([]);
  const [draft, setDraft] = useState<FilterDraft>({ title: "", tag: "", individual: "" });
  const [applied, setApplied] = useState<FilterDraft>({ title: "", tag: "", individual: "" });
  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchEditIds, setBatchEditIds] = useState<string[]>([]);

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
    let result = baseRows;
    const titleQ = applied.title.toLowerCase();
    const tagQ = applied.tag.toLowerCase();
    const indQ = applied.individual.toLowerCase();

    if (titleQ) {
      result = result.filter(
        (r) =>
          r.displayTitle.toLowerCase().includes(titleQ) ||
          r.title.toLowerCase().includes(titleQ) ||
          r.kindLabel.toLowerCase().includes(titleQ) ||
          r.statusLabel.toLowerCase().includes(titleQ),
      );
    }
    if (tagQ) result = result.filter((r) => r.tagsSearch.includes(tagQ));
    if (indQ) result = result.filter((r) => r.individualsSearch.includes(indQ));

    return result;
  }, [baseRows, applied]);

  const applyFilters = useCallback(() => {
    setApplied({ title: draft.title.trim(), tag: draft.tag.trim(), individual: draft.individual.trim() });
  }, [draft]);

  const clearFilters = useCallback(() => {
    setDraft({ title: "", tag: "", individual: "" });
    setApplied({ title: "", tag: "", individual: "" });
  }, []);

  const activeFilterCount = [applied.title, applied.tag, applied.individual].filter(Boolean).length;

  const handleDelete = useCallback(
    async (row: StoryRow) => {
      if (!window.confirm(`Delete "${row.displayTitle}"? This marks the story as deleted on the server.`)) return;
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

  const bulkDeleteOne = useCallback(async (id: string) => {
    await deleteStoryDocument(id);
  }, []);

  const handleBulkDeleteFinished = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const openBulkEdit = useCallback((ids: string[]) => {
    setBatchEditIds(ids);
    setBatchEditOpen(true);
  }, []);

  const config = useMemo(
    () => buildStoriesConfig(router, handleDelete, bulkDeleteOne, openBulkEdit),
    [router, handleDelete, bulkDeleteOne, openBulkEdit],
  );

  return (
    <>
    <StoriesBatchEditModal
      open={batchEditOpen}
      onOpenChange={setBatchEditOpen}
      selectedIds={batchEditIds}
      onApplied={refresh}
    />
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
            <Label htmlFor="stories-filter-title">Title</Label>
            <Input
              id="stories-filter-title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Title, type, or status…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories-filter-tag">Tag</Label>
            <Input
              id="stories-filter-tag"
              value={draft.tag}
              onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
              placeholder="e.g. immigration, war…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="stories-filter-individual">Linked person</Label>
            <Input
              id="stories-filter-individual"
              value={draft.individual}
              onChange={(e) => setDraft((d) => ({ ...d, individual: e.target.value }))}
              placeholder="Name of a linked individual…"
            />
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
        paginationResetKey={JSON.stringify(applied)}
        totalCount={entries.length}
        onBulkDeleteFinished={handleBulkDeleteFinished}
      />
    </AdminListPageShell>
    </>
  );
}
