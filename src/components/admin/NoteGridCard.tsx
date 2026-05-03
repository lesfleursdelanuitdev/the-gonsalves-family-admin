"use client";

import Link from "next/link";
import { BookOpen, CalendarDays, Eye, FileText, Link2, Pencil, Trash2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type NoteLinkedKind = "individual" | "family" | "event" | "source";

export interface NoteGridCardLinkedTarget {
  kind: NoteLinkedKind;
  label: string;
  href: string | null;
}

export interface NoteGridCardRecord {
  id: string;
  xref: string;
  contentPreview: string;
  linkedTargets: NoteGridCardLinkedTarget[];
}

function LinkedRow({ kind, label, href }: NoteGridCardLinkedTarget) {
  const icon =
    kind === "individual" ? (
      <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    ) : kind === "family" ? (
      <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    ) : kind === "event" ? (
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    ) : (
      <BookOpen className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    );

  const body = href ? (
    <Link
      href={href}
      className="min-w-0 truncate font-medium text-primary underline-offset-2 hover:underline"
    >
      {label}
    </Link>
  ) : (
    <span className="min-w-0 truncate text-base-content/85">{label}</span>
  );

  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      {icon}
      <div className="min-w-0 flex-1">{body}</div>
    </div>
  );
}

export function NoteGridCard({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: NoteGridCardRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const xrefRaw = record.xref.trim();
  const hasXref = xrefRaw.length > 0 && xrefRaw !== "—";
  const xrefDisplay = hasXref ? xrefRaw : "—";
  const titleDisplay = hasXref ? xrefRaw : "Note";

  const previewText = record.contentPreview.trim();
  const hasPreview = previewText.length > 0;

  return (
    <Card className="group flex h-full min-h-0 flex-col overflow-hidden border-base-content/12 bg-base-100/95 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20">
      <CardHeader className="relative space-y-2 pb-2 pt-3 text-center">
        <div className="flex justify-center">
          <span
            className="inline-flex max-w-full items-center rounded-full border border-base-content/15 bg-base-content/[0.03] px-2.5 py-0.5 font-mono text-[10px] leading-tight tracking-wide text-base-content/70"
            title={xrefDisplay}
          >
            {xrefDisplay}
          </span>
        </div>
        <div
          className="mx-auto flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-base-content/12 bg-base-content/[0.03] text-muted-foreground"
          aria-hidden
        >
          <FileText className="size-5" />
        </div>
        <CardTitle className="text-balance text-base font-semibold leading-tight text-base-content sm:text-lg">
          {titleDisplay}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hasXref ? "Note" : "No cross-reference"}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 pb-3 pt-1 text-sm">
        <div className="min-h-[4.25rem] rounded-md border border-base-content/10 bg-base-content/[0.03] px-2.5 py-2">
          <p
            className={`line-clamp-3 text-sm leading-snug ${hasPreview ? "text-base-content/[0.92]" : "text-muted-foreground"}`}
          >
            {hasPreview ? previewText : "No content"}
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-base-content">
            <Link2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            Linked
          </p>
          {record.linkedTargets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No linked entities</p>
          ) : (
            <div className="space-y-2">
              {record.linkedTargets.map((t, i) => (
                <LinkedRow key={`${t.kind}-${t.label}-${i}`} {...t} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <div className="grid grid-cols-3 divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
          onClick={onView}
          aria-label={`View note ${titleDisplay}`}
          title="View"
        >
          <Eye className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
          onClick={onEdit}
          aria-label={`Edit note ${titleDisplay}`}
          title="Edit"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-9 w-full rounded-none border-0 text-base-content/55 hover:bg-destructive/10 hover:text-destructive focus-visible:z-10 focus-visible:text-destructive"
          onClick={onDelete}
          aria-label={`Delete note ${titleDisplay}`}
          title="Delete"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
