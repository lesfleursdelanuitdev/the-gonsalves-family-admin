"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChefHat } from "lucide-react";
import { DataViewer, type DataViewerConfig } from "@/components/data-viewer";
import { FilterPanel } from "@/components/data-viewer/FilterPanel";
import { CardActionFooter } from "@/components/data-viewer/CardActionFooter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { useAdminRecipes, useDeleteRecipe, type AdminRecipesListResponse } from "@/hooks/useAdminRecipes";
import { adminListQActiveFilterCount, useAdminListQFilters } from "@/hooks/useAdminListQFilters";
import { ApiError } from "@/lib/infra/api";

interface RecipeRow {
  id: string;
  title: string;
  slug: string;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  servings: number | null;
  totalMinutes: number | null;
  updatedAt: string;
}

function mapApiToRows(api: AdminRecipesListResponse): RecipeRow[] {
  return (api?.recipes ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    difficulty: r.difficulty,
    status: r.status,
    servings: r.servings,
    totalMinutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
    updatedAt: new Date(r.updatedAt).toLocaleDateString(),
  }));
}

function buildRecipesConfig(
  router: ReturnType<typeof useRouter>,
  onDelete: (row: RecipeRow) => void,
): DataViewerConfig<RecipeRow> {
  return {
    id: "recipes",
    labels: { singular: "Recipe", plural: "Recipes" },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    columns: [
      { accessorKey: "title", header: "Title", enableSorting: true },
      { accessorKey: "difficulty", header: "Difficulty", enableSorting: true },
      { accessorKey: "status", header: "Status", enableSorting: true },
      {
        accessorKey: "totalMinutes",
        header: "Total time",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.getValue("totalMinutes") as number | null;
          return m ? <span>{m} min</span> : <span className="text-muted-foreground">—</span>;
        },
      },
      { accessorKey: "updatedAt", header: "Updated", enableSorting: true },
    ],
    renderCard: ({ record, onView, onEdit }) => (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ChefHat className="size-5 text-muted-foreground" />
            <CardTitle className="text-base">{record.title}</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground capitalize">{record.status} · {record.difficulty}</p>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {record.servings ? `${record.servings} servings` : null}
          {record.totalMinutes ? ` · ${record.totalMinutes} min` : null}
          {!record.servings && !record.totalMinutes ? "No timing info" : null}
        </CardContent>
        <CardActionFooter onView={onView} onEdit={onEdit} onDelete={() => onDelete(record)} />
      </Card>
    ),
    actions: {
      add: { label: "New recipe", handler: () => router.push("/admin/recipes/new") },
      view: { label: "Open", handler: (r) => router.push(`/admin/recipes/${r.id}/edit`) },
      edit: { label: "Edit", handler: (r) => router.push(`/admin/recipes/${r.id}/edit`) },
      delete: { label: "Delete", handler: onDelete },
    },
  };
}

export default function AdminRecipesPage() {
  const router = useRouter();
  const deleteRecipe = useDeleteRecipe();
  const { draft, applied, queryOpts, updateDraft, apply: applyFilters, clear: clearFilters } = useAdminListQFilters();
  const { data, isLoading } = useAdminRecipes(queryOpts);
  const rows = useMemo(() => (data ? mapApiToRows(data) : []), [data]);

  const handleDelete = useCallback(
    async (r: RecipeRow) => {
      if (!window.confirm(`Delete recipe "${r.title}"? This cannot be undone.`)) return;
      try {
        await deleteRecipe.mutateAsync(r.id);
        toast.success(`Deleted "${r.title}".`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Could not delete recipe.");
      }
    },
    [deleteRecipe],
  );

  const config = useMemo(() => buildRecipesConfig(router, handleDelete), [router, handleDelete]);

  return (
    <AdminListPageShell
      title="Recipes"
      description="Standalone family recipes with ingredients, steps, and linked individuals."
      filters={
        <FilterPanel onApply={applyFilters} onClear={clearFilters} activeFilterCount={adminListQActiveFilterCount(applied)}>
          <div className="space-y-2">
            <Label htmlFor="recipes-filter-q">Search recipes</Label>
            <Input id="recipes-filter-q" value={draft.q} onChange={(e) => updateDraft("q", e.target.value)} placeholder="Title contains…" />
          </div>
        </FilterPanel>
      }
    >
      <DataViewer
        config={config}
        data={rows}
        isLoading={isLoading}
        defaultViewMode="table"
        viewModeKey="admin-recipes-view"
        skipClientGlobalFilter
        paginationResetKey={applied.q}
        totalCount={data?.total}
      />
    </AdminListPageShell>
  );
}
