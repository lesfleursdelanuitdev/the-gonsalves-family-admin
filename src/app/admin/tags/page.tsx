"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tag as TagIcon } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminTags, useDeleteTag, type AdminTagsListResponse } from "@/hooks/useAdminTags";
import { useCurrentUser } from "@/hooks/useAuth";
import { ApiError } from "@/lib/infra/api";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { ViewAsAlbumLink } from "@/components/album/ViewAsAlbumLink";
import { cn } from "@/lib/utils";

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  scopeLabel: string;
  canEdit: boolean;
  canDelete: boolean;
}

function mapApiToRows(
  api: AdminTagsListResponse,
  me: { id: string; isWebsiteOwner: boolean } | null | undefined,
): TagRow[] {
  return (api?.tags ?? []).map((t) => ({
    id: t.id,
    name: displayTagName(t.name),
    color: t.color,
    scopeLabel: t.isGlobal ? "Global" : "Yours",
    canEdit: Boolean(
      me && ((!t.isGlobal && t.userId === me.id) || (t.isGlobal && me.isWebsiteOwner)),
    ),
    canDelete: Boolean(
      me && ((!t.isGlobal && t.userId === me.id) || (t.isGlobal && me.isWebsiteOwner)),
    ),
  }));
}

function buildTagsConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: TagRow) => void,
): DataViewerConfig<TagRow> {
  return {
    id: "tags",
    labels: { singular: "Tag", plural: "Tags" },
    getRowId: (row) => row.id,
    enableRowSelection: false,
    columns: [
      {
        accessorKey: "color",
        header: "Color",
        enableSorting: false,
        cell: ({ row }) => {
          const c = (row.getValue("color") as string | null)?.trim();
          if (!c) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="inline-flex items-center gap-2">
              <span
                className="size-5 shrink-0 rounded border border-base-content/15 shadow-sm"
                style={{ backgroundColor: c }}
                title={c}
                aria-hidden
              />
              <span className="font-mono text-xs text-muted-foreground">{c}</span>
            </span>
          );
        },
      },
      { accessorKey: "name", header: "Name", enableSorting: true },
      { accessorKey: "scopeLabel", header: "Scope", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TagIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{record.name}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">{record.scopeLabel}</p>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {record.color ? (
            <span className="inline-flex items-center gap-2">
              <span
                className={cn("size-6 rounded border border-base-content/15")}
                style={{ backgroundColor: record.color }}
                aria-hidden
              />
              <span className="font-mono text-xs">{record.color}</span>
            </span>
          ) : (
            "No color"
          )}
          <ViewAsAlbumLink
            entityType="tag"
            entityId={record.id}
            className="w-full sm:w-auto"
            label="View tagged media"
            includeCount
          />
        </CardContent>
        <CardActionFooter
          onView={onView}
          onEdit={record.canEdit ? onEdit : undefined}
          onDelete={record.canDelete ? () => onDelete(record) : undefined}
        />
      </Card>
    ),
    actions: {
      add: { label: "New tag", handler: () => router.push("/admin/tags/new") },
      view: {
        label: "Open",
        handler: (r) => router.push(`/admin/tags/${r.id}/edit`),
      },
      edit: {
        label: "Edit",
        handler: (r) => router.push(`/admin/tags/${r.id}/edit`),
      },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminTagsPage() {
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const deleteTag = useDeleteTag();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } =
    useAdminListQFilters();

  const { data, isLoading } = useAdminTags(queryOpts);

  const me = currentUser ? { id: currentUser.id, isWebsiteOwner: currentUser.isWebsiteOwner } : null;
  const rows = useMemo(() => (data ? mapApiToRows(data, me) : []), [data, me]);

  const handleDelete = useCallback(
    async (r: TagRow) => {
      if (!r.canDelete) {
        toast.error(
          r.scopeLabel === "Global"
            ? "Only a site owner can delete global tags."
            : "You can only delete tags you own.",
        );
        return;
      }
      if (
        !window.confirm(
          `Delete tag “${r.name}”? This removes the tag and all links to media (and other tagged items). This cannot be undone.`,
        )
      ) {
        return;
      }
      try {
        await deleteTag.mutateAsync(r.id);
        toast.success(`Deleted “${r.name}”.`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete tag.");
      }
    },
    [deleteTag],
  );

  const config = useMemo(() => buildTagsConfig(router, handleDelete), [router, handleDelete]);

  return (
    <AdminListPageShell
      title="Tags"
      description="Labels you can attach to tree media. Global tags are shared; your own tags are private to your account."
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="tags-filter-q">Search tags</Label>
            <Input
              id="tags-filter-q"
              value={draft.q}
              onChange={(e) => updateDraft("q", e.target.value)}
              placeholder="Name contains…"
            />
            <p className="text-xs text-muted-foreground">
              Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
            </p>
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-tags-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
