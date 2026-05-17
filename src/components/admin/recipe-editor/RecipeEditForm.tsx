"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ChefHat, FileText, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { ApiError, postJson } from "@/lib/infra/api";
import { useRecipeDetail, useCreateRecipe, useUpdateRecipe, useDeleteRecipe } from "@/hooks/useAdminRecipes";
import type { AdminRecipeDetailResponse } from "@/hooks/useAdminRecipes";

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

function chipBtn(active: boolean) {
  return cn(
    "rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
    active
      ? "border-primary/45 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/15"
      : "border-base-content/12 bg-base-100/70 text-base-content/75 hover:border-base-content/20",
  );
}

export type RecipeEditFormProps = { contextReturnHref?: string } & (
  | { mode: "create" }
  | { mode: "edit"; recipeId: string }
);

export function RecipeEditForm(props: RecipeEditFormProps) {
  const router = useRouter();
  const mode = props.mode;
  const recipeId = mode === "edit" ? props.recipeId : "";
  const backHref = props.contextReturnHref ?? "/admin/recipes";
  const formId = "recipe-edit-form";

  const { data, isLoading, error } = useRecipeDetail(recipeId);
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [recipeYield, setRecipeYield] = useState("");
  const [servings, setServings] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [restMinutes, setRestMinutes] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detail = data as AdminRecipeDetailResponse | undefined;
  const canEdit = mode === "create" ? true : Boolean(detail?.recipe.canEdit);

  useEffect(() => {
    if (mode !== "edit" || !detail?.recipe) return;
    const r = detail.recipe;
    setTitle(r.title);
    setSlug(r.slug);
    setDescription(r.description ?? "");
    setRecipeYield(r.yield ?? "");
    setServings(r.servings != null ? String(r.servings) : "");
    setPrepMinutes(r.prepMinutes != null ? String(r.prepMinutes) : "");
    setCookMinutes(r.cookMinutes != null ? String(r.cookMinutes) : "");
    setRestMinutes(r.restMinutes != null ? String(r.restMinutes) : "");
    setDifficulty(r.difficulty);
    setStatus(r.status);
    setTags(r.tags.join(", "));
  }, [mode, detail?.recipe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) { toast.error("Title is required."); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: t,
        slug: slug.trim() || undefined,
        description: description.trim() || null,
        yield: recipeYield.trim() || null,
        servings: servings ? parseInt(servings, 10) : null,
        prepMinutes: prepMinutes ? parseInt(prepMinutes, 10) : null,
        cookMinutes: cookMinutes ? parseInt(cookMinutes, 10) : null,
        restMinutes: restMinutes ? parseInt(restMinutes, 10) : null,
        difficulty,
        status,
        tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      };
      if (mode === "create") {
        const res = await postJson<{ id: string }>("/api/admin/recipes", payload);
        toast.success("Recipe created.");
        router.push(`/admin/recipes/${res.id}/edit`);
        return;
      }
      await updateRecipe.mutateAsync({ id: recipeId, ...payload });
      toast.success("Recipe saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (mode !== "edit" || !detail?.recipe.canDelete) return;
    if (!window.confirm(`Delete "${detail.recipe.title}"? This cannot be undone.`)) return;
    try {
      await deleteRecipe.mutateAsync(recipeId);
      toast.success("Recipe deleted.");
      router.push("/admin/recipes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not delete.");
    }
  };

  if (mode === "edit" && isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (mode === "edit" && (error || !detail?.recipe)) return <p className="text-sm text-destructive">Could not load this recipe.</p>;

  return (
    <div className="w-full space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-base-content/10 pb-5">
        <div className="space-y-1">
          <Link href={backHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-1 inline-flex gap-1.5 px-0")}>
            <ArrowLeft className="size-4" aria-hidden />
            Recipes
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "New recipe" : "Edit recipe"}</h1>
          <p className="text-muted-foreground">
            {mode === "create" ? "Create a standalone recipe with ingredients and steps." : "Update recipe details, timing, and content."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>Cancel</Link>
          <button type="submit" form={formId} className={cn(buttonVariants())} disabled={submitting || !canEdit}>
            {submitting ? "Saving…" : mode === "create" ? "Create recipe" : "Save recipe"}
          </button>
        </div>
      </header>

      <form id={formId} onSubmit={(e) => void handleSubmit(e)} className="w-full space-y-6">
        {/* Basic details */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ChefHat className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">Basic details</h2>
              <p className="text-sm text-muted-foreground">Title, slug, and description shown in listings.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recipe-title">Title</Label>
              <Input id="recipe-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Grandmother's Pepper Pot" disabled={!canEdit} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recipe-slug">URL slug</Label>
              <Input id="recipe-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. grandmothers-pepper-pot" className="font-mono text-sm" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, hyphens. Auto-generated from title if left blank.</p>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="recipe-description">Short description</Label>
              <textarea
                id="recipe-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={!canEdit}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Brief teaser for listings and search…"
              />
            </div>
          </div>
        </section>

        {/* Timing & servings */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Settings2 className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">Timing &amp; servings</h2>
              <p className="text-sm text-muted-foreground">How long it takes and how much it makes.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="recipe-yield">Yield</Label>
              <Input id="recipe-yield" value={recipeYield} onChange={(e) => setRecipeYield(e.target.value)} placeholder="e.g. 1 loaf" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-servings">Servings</Label>
              <Input id="recipe-servings" type="number" min={1} value={servings} onChange={(e) => setServings(e.target.value)} placeholder="4" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-prep">Prep time (min)</Label>
              <Input id="recipe-prep" type="number" min={0} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} placeholder="15" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-cook">Cook time (min)</Label>
              <Input id="recipe-cook" type="number" min={0} value={cookMinutes} onChange={(e) => setCookMinutes(e.target.value)} placeholder="30" disabled={!canEdit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-rest">Rest time (min)</Label>
              <Input id="recipe-rest" type="number" min={0} value={restMinutes} onChange={(e) => setRestMinutes(e.target.value)} placeholder="10" disabled={!canEdit} />
            </div>
          </div>
        </section>

        {/* Publishing state */}
        <section className="rounded-xl border border-base-content/10 bg-card/60 p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <FileText className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-semibold">Publishing</h2>
              <p className="text-sm text-muted-foreground">Difficulty level, status, and tags.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Difficulty</Label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" className={chipBtn(difficulty === opt.value)} onClick={() => setDifficulty(opt.value)} disabled={!canEdit}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" className={chipBtn(status === opt.value)} onClick={() => setStatus(opt.value)} disabled={!canEdit}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipe-tags">Tags</Label>
              <Input id="recipe-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. traditional, caribbean" disabled={!canEdit} />
              <p className="text-xs text-muted-foreground">Comma-separated keywords for organization and search.</p>
            </div>
          </div>
        </section>

        {mode === "edit" && detail?.recipe.canDelete ? (
          <section className="rounded-xl border border-destructive/25 bg-destructive/[0.04] p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                <Trash2 className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="text-base font-semibold">Danger zone</h2>
                <p className="text-sm text-muted-foreground">Deletes the recipe and all its ingredients and steps.</p>
              </div>
            </div>
            <button type="button" className={cn(buttonVariants({ variant: "destructive" }))} onClick={() => void onDelete()} disabled={deleteRecipe.isPending}>
              {deleteRecipe.isPending ? "Deleting…" : "Delete recipe"}
            </button>
          </section>
        ) : null}
      </form>
    </div>
  );
}
