"use client";

import { Suspense } from "react";
import { AdminListPageShell } from "@/components/admin/AdminListPageShell";
import { TimelineCreator } from "@/components/admin/timeline/TimelineCreator";

export default function AdminTimelinesPage() {
  return (
    <AdminListPageShell
      title="Timelines"
      description="Choose a person, family, or note, then preview a card-style chronology of linked GEDCOM events. Layout options sync to the URL for sharing."
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <TimelineCreator />
      </Suspense>
    </AdminListPageShell>
  );
}
