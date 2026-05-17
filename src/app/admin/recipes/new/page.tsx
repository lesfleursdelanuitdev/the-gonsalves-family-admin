"use client";

import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { RecipeEditForm } from "@/components/admin/recipe-editor/RecipeEditForm";

export default function AdminNewRecipePage() {
  return (
    <NoteEditorPageLayout backHref="/admin/recipes" backLabel="Recipes" fullWidth hideBackLink>
      <RecipeEditForm mode="create" contextReturnHref="/admin/recipes" />
    </NoteEditorPageLayout>
  );
}
