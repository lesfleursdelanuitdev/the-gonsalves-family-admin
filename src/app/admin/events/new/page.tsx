"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import type { SelectedNoteLink } from "@/lib/forms/note-form-links";

function NewEventFormWithQuery() {
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const prefillLinks = useMemo((): SelectedNoteLink[] | undefined => {
    const sp = new URLSearchParams(qs);
    const links: SelectedNoteLink[] = [];
    const iid = sp.get("individualId")?.trim();
    if (iid) {
      const label = sp.get("individualLabel")?.trim() || iid;
      links.push({ kind: "individual", id: iid, label });
    }
    const fid = sp.get("familyId")?.trim();
    if (fid) {
      const label = sp.get("familyLabel")?.trim() || fid;
      links.push({ kind: "family", id: fid, label });
    }
    return links.length ? links : undefined;
  }, [qs]);

  return <EventForm key={qs || "new"} mode="create" hideBackLink prefillLinks={prefillLinks} />;
}

export default function AdminNewEventPage() {
  return (
    <NoteEditorPageLayout backHref="/admin/events" backLabel="Events" fullWidth>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <NewEventFormWithQuery />
      </Suspense>
    </NoteEditorPageLayout>
  );
}
