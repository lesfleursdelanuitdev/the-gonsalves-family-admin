"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, StickyNote } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminNote } from "@/hooks/useAdminNotes";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { LinkedIndividualLink } from "@/components/admin/LinkedIndividualLink";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NoteContentMarkdown } from "@/components/admin/NoteContentMarkdown";

export default function AdminNoteDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const { data, isLoading, error } = useAdminNote(id);

  const note = data?.note as Record<string, unknown> | undefined;

  const xref = (note?.xref as string | null) ?? "";
  const content = String(note?.content ?? "");
  const isTopLevel = Boolean(note?.isTopLevel);

  const individualNotes =
    (note?.individualNotes as { individual: Record<string, unknown> }[] | undefined) ?? [];
  const familyNotes = (note?.familyNotes as { family: Record<string, unknown> }[] | undefined) ?? [];
  const eventNotes =
    (note?.eventNotes as { event: Record<string, unknown> }[] | undefined) ?? [];
  const sourceNotes =
    (note?.sourceNotes as { source: Record<string, unknown> }[] | undefined) ?? [];

  const hasLinks =
    individualNotes.length > 0 ||
    familyNotes.length > 0 ||
    eventNotes.length > 0 ||
    sourceNotes.length > 0;

  return (
    <DetailPageShell
      backHref="/admin/notes"
      backLabel="Notes"
      isLoading={isLoading}
      error={error}
      data={note}
      notFoundMessage="Could not load this note."
    >
      <header className="space-y-4 border-b border-base-content/[0.08] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-base-content">
            <StickyNote className="size-8 shrink-0 text-base-content/80 sm:size-9" aria-hidden />
            <span className="min-w-0 leading-tight">
              {xref ? <span className="font-mono text-[0.95em]">{xref}</span> : "Note"}
            </span>
          </h1>
          <Link
            href={`/admin/notes/${id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex gap-1.5")}
          >
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </Link>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">UUID</dt>
            <dd className="break-all font-mono text-xs">{id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Top-level</dt>
            <dd>{isTopLevel ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </header>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-4 text-sm shadow-sm shadow-black/15">
            <NoteContentMarkdown markdown={content} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Linked to</CardTitle>
          <p className="text-sm text-muted-foreground">
            Records this note is attached to (GEDCOM links).
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasLinks ? (
            <p className="text-sm text-muted-foreground">Not linked to any record (top-level note).</p>
          ) : null}

          {individualNotes.map((row) => (
            <LinkedIndividualLink key={String(row.individual.id)} ind={row.individual} />
          ))}

          {familyNotes.map((row) => {
            const fam = row.family;
            const famId = fam.id as string;
            const famXref = (fam.xref as string) ?? "";
            const h = fam.husband as Record<string, unknown> | null;
            const w = fam.wife as Record<string, unknown> | null;
            return (
              <div
                key={famId}
                className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 shadow-sm shadow-black/15"
              >
                <p className="mb-3 font-mono text-xs">
                  <span className="text-muted-foreground">Family </span>
                  <Link href={`/admin/families/${famId}`} className="link link-primary">
                    {famXref || famId}
                  </Link>
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Partner</p>
                    {h ? <LinkedIndividualLink ind={h} /> : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Partner</p>
                    {w ? <LinkedIndividualLink ind={w} /> : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                </div>
              </div>
            );
          })}

          {eventNotes.map((row) => {
            const ev = row.event;
            const evId = ev.id as string;
            const eventType = (ev.eventType as string) ?? "";
            const customType = ((ev.customType as string) ?? "").trim();
            const label = labelGedcomEventType(eventType);
            return (
              <div key={evId} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  <GedcomEventTypeIcon eventType={eventType} />
                </span>
                <div className="min-w-0">
                  <Link href={`/admin/events/${evId}`} className="link link-primary font-medium">
                    {label}
                    {customType ? (
                      <span className="font-normal text-muted-foreground"> ({customType})</span>
                    ) : null}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">{eventType}</p>
                </div>
              </div>
            );
          })}

          {sourceNotes.map((row) => {
            const s = row.source;
            const sid = s.id as string;
            const title = String(s.title ?? s.xref ?? "Source");
            const sx = String(s.xref ?? "");
            return (
              <div key={sid} className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15">
                <p className="font-medium">{title}</p>
                {sx ? <p className="font-mono text-xs text-muted-foreground">{sx}</p> : null}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </DetailPageShell>
  );
}
