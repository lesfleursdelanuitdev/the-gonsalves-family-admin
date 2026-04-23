"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { NoteForm } from "@/components/admin/NoteForm";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

function sanitizeReturnTo(raw: string | null): string | undefined {
  if (raw == null || raw === "") return undefined;
  let t: string;
  try {
    t = decodeURIComponent(raw).trim();
  } catch {
    return undefined;
  }
  if (!t.startsWith("/admin/")) return undefined;
  if (t.includes("://")) return undefined;
  if (t.includes("//")) return undefined;
  return t;
}

function initialLinksFromSearchParams(sp: URLSearchParams): SelectedNoteLink[] {
  const links: SelectedNoteLink[] = [];
  const indId = sp.get("individualId")?.trim();
  if (indId) {
    const label = sp.get("individualLabel")?.trim() || "Individual";
    links.push({ kind: "individual", id: indId, label });
  }
  const famId = sp.get("familyId")?.trim();
  if (famId) {
    const label = sp.get("familyLabel")?.trim() || "Family";
    links.push({ kind: "family", id: famId, label });
  }
  return links;
}

function AdminNewNotePageInner() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const { initialLinks, contextReturnHref, backHref, backLabel } = useMemo(() => {
    const sp = new URLSearchParams(qs);
    const returnTo = sanitizeReturnTo(sp.get("returnTo"));
    return {
      initialLinks: initialLinksFromSearchParams(sp),
      contextReturnHref: returnTo,
      backHref: returnTo ?? "/admin/notes",
      backLabel: returnTo ? "Back to editor" : "Notes",
    };
  }, [qs]);

  return (
    <NoteEditorPageLayout backHref={backHref} backLabel={backLabel}>
      <NoteForm
        hideBackLink
        mode="create"
        initialContent=""
        initialIsTopLevel={false}
        initialLinks={initialLinks}
        contextReturnHref={contextReturnHref}
      />
    </NoteEditorPageLayout>
  );
}

export default function AdminNewNotePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl pb-20 text-sm text-muted-foreground md:pb-24">Loading…</div>
      }
    >
      <AdminNewNotePageInner />
    </Suspense>
  );
}
