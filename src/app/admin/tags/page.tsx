"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tag as TagIcon } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminTags, type AdminTagsListResponse } from "@/hooks/useAdminTags";
import { ADMIN_LIST_MAX_LIMIT } from "@/constants/admin";
import { displayTagName } from "@/lib/admin/display-tag-name";
import { cn } from "@/lib/utils";

interface TagRow {
  id: string;
  name: string;
  color: string | null;
  scopeLabel: string;
}

function mapApiToRows(api: AdminTagsListResponse): TagRow[] {
  return (api?.tags ?? []).map((t) => ({
    id: t.id,
    name: displayTagName(t.name),
    color: t.color,
    scopeLabel: t.isGlobal ? "Global" : "Yours",
  }));
}

function buildTagsConfig(router: ReturnType<typeof useRouter>): DataViewerConfig<TagRow> {
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
    renderCard: ({ record }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TagIcon className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{record.name}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">{record.scopeLabel}</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
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
        </CardContent>
        <CardActionFooter />
      </Card>
    ),
    actions: {
      add: { label: "New tag", handler: () => router.push("/admin/tags/new") },
    },
  };
}

export default function AdminTagsPage() {
  const router = useRouter();
  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const applyFilters = useCallback(() => setAppliedQ(draftQ), [draftQ]);
  const clearFilters = useCallback(() => {
    setDraftQ("");
    setAppliedQ("");
  }, []);

  const { data, isLoading } = useAdminTags({
    q: appliedQ.trim() || undefined,
    limit: ADMIN_LIST_MAX_LIMIT,
    offset: 0,
  });

  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);
  const config = useMemo(() => buildTagsConfig(router), [router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
        <p className="text-muted-foreground">
          Labels you can attach to tree media. Global tags are shared; your own tags are private to your account.
        </p>
      </div>

      <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={appliedQ.trim() ? 1 : 0}>
        <div className="space-y-2">
          <Label htmlFor="tags-filter-q">Search tags</Label>
          <Input
            id="tags-filter-q"
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
            placeholder="Name contains…"
          />
          <p className="text-xs text-muted-foreground">
            Matches the API <span className="font-medium">q</span> parameter. Click Apply to run the search.
          </p>
        </div>
      </FilterPanel>

      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-tags-view"
        skipClientGlobalFilter
        paginationResetKey={appliedQ}
        totalCount={data?.total}
      />
    </div>
  );
}
