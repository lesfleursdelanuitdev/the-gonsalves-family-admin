"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { OpenQuestionForm } from "@/components/admin/OpenQuestionForm";

function AdminOpenQuestionNewPageInner() {
  const sp = useSearchParams();
  const initialLink = useMemo(() => {
    const ind = sp.get("individualId")?.trim();
    if (ind) {
      return {
        entityType: "individual" as const,
        entityId: ind,
        label: sp.get("label")?.trim() || undefined,
      };
    }
    const fam = sp.get("familyId")?.trim();
    if (fam) {
      return { entityType: "family" as const, entityId: fam, label: sp.get("label")?.trim() || undefined };
    }
    const ev = sp.get("eventId")?.trim();
    if (ev) {
      return { entityType: "event" as const, entityId: ev, label: sp.get("label")?.trim() || undefined };
    }
    const med = sp.get("mediaId")?.trim();
    if (med) {
      return { entityType: "media" as const, entityId: med, label: sp.get("label")?.trim() || undefined };
    }
    return undefined;
  }, [sp]);

  const returnTo = sp.get("returnTo")?.trim();
  const contextReturnHref =
    returnTo?.startsWith("/admin/") && !returnTo.includes("://") ? returnTo : undefined;

  return (
    <NoteEditorPageLayout backHref="/admin/open-questions" backLabel="Open Questions" fullWidth>
      <header className="mb-6 space-y-1 border-b border-base-content/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">New open question</h1>
        <p className="text-sm text-muted-foreground">
          Capture something that needs research or verification, then link it to relevant records.
        </p>
      </header>
      <OpenQuestionForm mode="create" hideBackLink contextReturnHref={contextReturnHref} initialLink={initialLink} />
    </NoteEditorPageLayout>
  );
}

export default function AdminOpenQuestionNewPage() {
  return (
    <Suspense
      fallback={
        <NoteEditorPageLayout backHref="/admin/open-questions" backLabel="Open Questions" fullWidth>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </NoteEditorPageLayout>
      }
    >
      <AdminOpenQuestionNewPageInner />
    </Suspense>
  );
}
