"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { EventForm } from "@/components/admin/EventForm";
import { EntityOpenQuestionsSection } from "@/components/admin/EntityOpenQuestionsSection";
import { NoteEditorPageLayout } from "@/components/admin/NoteEditorPageLayout";
import { useAdminEvent } from "@/hooks/useAdminEvents";

export default function AdminEditEventPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminEvent(id);

  const event = data?.event as Record<string, unknown> | undefined;

  const shell = (body: ReactNode, hideBackLink: boolean) => (
    <NoteEditorPageLayout backHref="/admin/events" backLabel="Back to events" fullWidth hideBackLink={hideBackLink}>
      {body}
    </NoteEditorPageLayout>
  );

  if (!id) {
    return shell(<p className="text-muted-foreground">Missing event id.</p>, false);
  }

  if (isLoading) {
    return shell(<p className="text-muted-foreground">Loading…</p>, false);
  }

  if (error || !event) {
    return shell(<p className="text-destructive">Could not load this event.</p>, false);
  }

  const ev = event as Record<string, unknown>;
  const titleForOq = `${String(ev.eventType ?? "")}${ev.customType ? ` (${String(ev.customType)})` : ""}`.trim() || id;

  return shell(
    <div className="space-y-8">
      <EventForm key={id} mode="edit" eventId={id} initialEvent={event} hideBackLink />
      <EntityOpenQuestionsSection entityType="event" entityId={id} variant="edit" entityLabel={titleForOq} />
    </div>,
    true,
  );
}
