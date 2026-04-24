"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { useAdminEvent } from "@/hooks/useAdminEvents";

export default function AdminEditEventPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminEvent(id);

  const event = data?.event as Record<string, unknown> | undefined;

  const shell = (body: ReactNode) => (
    <NoteEditorPageLayout backHref="/admin/events" backLabel="Events" fullWidth>
      {body}
    </NoteEditorPageLayout>
  );

  if (!id) {
    return shell(<p className="text-muted-foreground">Missing event id.</p>);
  }

  if (isLoading) {
    return shell(<p className="text-muted-foreground">Loading…</p>);
  }

  if (error || !event) {
    return shell(<p className="text-destructive">Could not load this event.</p>);
  }

  return shell(
    <EventForm key={id} mode="edit" eventId={id} initialEvent={event} hideBackLink />,
  );
}
