"use client";

import { createAdminCrudHooks } from "@/hooks/createAdminCrudHooks";

export interface AdminRecipeListItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminRecipesListResponse {
  recipes: AdminRecipeListItem[];
  total: number;
  hasMore: boolean;
}

export interface AdminRecipeIngredient {
  id: string;
  sortOrder: number;
  group: string | null;
  quantity: string | null;
  unit: string | null;
  item: string;
  note: string | null;
}

export interface AdminRecipeStep {
  id: string;
  stepNum: number;
  body: unknown;
  imageId: string | null;
}

export interface AdminRecipeDetail {
  id: string;
  treeId: string;
  authorId: string | null;
  title: string;
  slug: string;
  description: string | null;
  introduction: unknown | null;
  yield: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  restMinutes: number | null;
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  coverMediaId: string | null;
  coverMediaKind: string | null;
  tags: string[];
  ingredients: AdminRecipeIngredient[];
  steps: AdminRecipeStep[];
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AdminRecipeDetailResponse {
  recipe: AdminRecipeDetail;
}

function buildRecipesParams(opts: {
  q?: string;
  status?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.difficulty) params.set("difficulty", opts.difficulty);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return params;
}

const recipesHooks = createAdminCrudHooks<
  { q?: string; status?: string; difficulty?: string; limit?: number; offset?: number },
  AdminRecipesListResponse
>({
  base: "/api/admin/recipes",
  queryKey: ["admin", "recipes"],
  buildParams: buildRecipesParams,
});

export const useAdminRecipes = recipesHooks.useList;
export const useCreateRecipe = recipesHooks.useCreate;
export const useUpdateRecipe = recipesHooks.useUpdate;
export const useDeleteRecipe = recipesHooks.useDelete;

export function useRecipeDetail(id: string) {
  return recipesHooks.useDetail<AdminRecipeDetailResponse>(id);
}
