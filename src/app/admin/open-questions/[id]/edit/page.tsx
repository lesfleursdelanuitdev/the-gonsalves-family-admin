"use client";

import { useParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { OpenQuestionForm } from "@/components/admin/OpenQuestionForm";
import { routeDynamicId } from "@/lib/navigation/route-dynamic-segment";

export default function AdminOpenQuestionEditPage() {
  const params = useParams();
  const id = routeDynamicId(params);

  if (!id) {
    return (
      <NoteEditorPageLayout backHref="/admin/open-questions" backLabel="Open Questions">
        <p className="text-sm text-muted-foreground">Missing id.</p>
      </NoteEditorPageLayout>
    );
  }

  return (
    <NoteEditorPageLayout backHref="/admin/open-questions" backLabel="Open Questions" fullWidth hideBackLink>
      <header className="mb-6 space-y-1 border-b border-base-content/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Edit open question</h1>
      </header>
      <OpenQuestionForm mode="edit" openQuestionId={id} hideBackLink />
    </NoteEditorPageLayout>
  );
}
