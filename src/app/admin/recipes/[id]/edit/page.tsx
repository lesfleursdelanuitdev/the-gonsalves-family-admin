"use client";

import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { RecipeEditForm } from "@/components/admin/recipe-editor/RecipeEditForm";

export default function AdminRecipeEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return (
      <NoteEditorPageLayout backHref="/admin/recipes" backLabel="Recipes" fullWidth>
        <p className="text-muted-foreground">Missing recipe id.</p>
      </NoteEditorPageLayout>
    );
  }

  return (
    <NoteEditorPageLayout backHref="/admin/recipes" backLabel="Recipes" fullWidth hideBackLink>
      <RecipeEditForm mode="edit" recipeId={id} contextReturnHref="/admin/recipes" />
    </NoteEditorPageLayout>
  );
}
