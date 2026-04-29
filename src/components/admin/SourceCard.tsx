"use client";

import { Eye, Link2, Pencil, PenLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { initialsFromPersonLabel } from "@/lib/gedcom/display-name";
import { cn } from "@/lib/utils";

/** Row shape for the admin sources list (card + table). */
export type SourceCardRecord = {
  id: string;
  xref: string;
  title: string;
  author: string;
  linkedTo: string;
};

export function SourceCard({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: SourceCardRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const xrefDisplay = record.xref.trim() || "—";
  const titleDisplay = record.title.trim() && record.title !== "—" ? record.title.trim() : "—";
  const authorDisplay = record.author.trim() && record.author !== "—" ? record.author.trim() : "—";
  const linkedDisplay = record.linkedTo.trim() && record.linkedTo !== "—" ? record.linkedTo.trim() : "—";
  const avatarLabel = titleDisplay !== "—" ? titleDisplay : xrefDisplay !== "—" ? xrefDisplay : "Source";
  const avatarInitials = initialsFromPersonLabel(avatarLabel);
  return (
    <Card
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden border-base-content/12 bg-base-100/95",
        "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20",
      )}
    >
      <CardHeader className="space-y-2 pb-2 pt-3 text-center">
        <div className="flex justify-center">
          <span
            className="inline-flex max-w-full items-center rounded-full border border-base-content/15 bg-base-content/[0.03] px-2.5 py-0.5 font-mono text-[10px] leading-tight tracking-wide text-base-content/70"
            title={xrefDisplay}
          >
            {xrefDisplay}
          </span>
        </div>
        <div
          className="mx-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/8 text-sm font-bold text-base-content"
          aria-hidden
        >
          {avatarInitials}
        </div>
        <CardTitle className="text-balance text-base font-semibold leading-tight text-base-content sm:text-lg">
          {titleDisplay}
        </CardTitle>
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <PenLine className="size-3.5 shrink-0 opacity-90" aria-hidden />
          <span>{authorDisplay}</span>
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 pb-3 pt-1 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <PenLine className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="shrink-0 font-medium text-base-content/80">Author</span>
            <span className="ml-auto min-w-0 truncate text-muted-foreground" title={authorDisplay}>
              {authorDisplay}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="shrink-0 font-medium text-base-content/80">Linked</span>
            <span className="ml-auto min-w-0 truncate text-muted-foreground" title={linkedDisplay}>
              {linkedDisplay}
            </span>
          </p>
        </div>
        <div
          className="truncate rounded-md border border-base-content/10 bg-base-content/[0.015] px-2 py-1 text-center font-mono text-[10px] leading-tight text-base-content/45"
          title={record.id}
        >
          {record.id}
        </div>
      </CardContent>
      <div className="mt-auto grid grid-cols-3 divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]">
        {onView ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
            onClick={onView}
            aria-label={`View ${titleDisplay}`}
            title="View"
          >
            <Eye className="size-4" aria-hidden />
          </Button>
        ) : (
          <span />
        )}
        {onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
            onClick={onEdit}
            aria-label={`Edit ${titleDisplay}`}
            title="Edit"
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <span />
        )}
        {onDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-9 w-full rounded-none border-0 text-base-content/55 hover:bg-destructive/10 hover:text-destructive focus-visible:z-10 focus-visible:text-destructive"
            onClick={onDelete}
            aria-label={`Delete ${titleDisplay}`}
            title="Delete"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </Card>
  );
}
