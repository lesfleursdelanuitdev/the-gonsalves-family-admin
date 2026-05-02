"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Eye,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { cn } from "@/lib/utils";

/** Max people shown by name on the card; additional count is summarized. */
export const EVENT_CARD_MAX_LINKED_INDIVIDUALS = 3;

/** Row shape from the admin events list (presentation only; no xrefs/uuids on the card). */
export type EventCardRecord = {
  id: string;
  eventType: string;
  typeLabel: string;
  customType: string;
  date: string;
  place: string;
  linkedType: "individual" | "family" | "none";
  /** Display name when linked to an individual (same as former “linked to” human text). */
  linkedPersonDisplay: string | null;
  /** First linked individual id (same as `linkedIndividuals[0]` when non-empty). */
  linkedIndividualId: string | null;
  /** All individuals linked to this event (not via a family row). Deduped and ordered as from the API. */
  linkedIndividuals: ReadonlyArray<{ id: string; label: string }>;
  linkedFamilyId: string | null;
  linkedFamilyHusband: { id: string; label: string } | null;
  linkedFamilyWife: { id: string; label: string } | null;
};

function relationshipBlockLabel(
  eventType: string,
  linkedType: EventCardRecord["linkedType"],
  individualLinkCount: number,
): string {
  if (linkedType === "none") return "";
  if (linkedType === "family") return "Couple";
  if (individualLinkCount > 1) return "People";
  const t = (eventType ?? "").toUpperCase().trim();
  if (t === "BIRT" || t === "CHR" || t === "BAPM" || t === "CHRA" || t === "ADOP") return "Child";
  return "Person";
}

/** Name links: same weight as Individual card title, primary only on hover (matches list link affordance). */
const nameLinkClass =
  "font-medium text-base-content underline-offset-2 transition-colors hover:text-primary hover:underline";

function RelationshipBlock({ record }: { record: EventCardRecord }) {
  const people = record.linkedIndividuals;
  const relLabel = relationshipBlockLabel(record.eventType, record.linkedType, people.length);

  if (record.linkedType === "individual" && people.length > 0) {
    const shown = people.slice(0, EVENT_CARD_MAX_LINKED_INDIVIDUALS);
    const extra = people.length - shown.length;
    return (
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{relLabel}</p>
        <div className="space-y-1.5">
          {shown.map((p) => {
            const name =
              p.label.trim() && p.label !== "—" ? p.label.trim() : "Unnamed individual";
            return (
              <p key={p.id} className="flex items-start gap-2">
                <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Link
                  href={`/admin/individuals/${p.id}`}
                  className={cn(nameLinkClass, "min-w-0 text-pretty text-base leading-snug")}
                  onClick={(e) => e.stopPropagation()}
                >
                  {name}
                </Link>
              </p>
            );
          })}
          {extra > 0 ? (
            <p className="ps-6 text-sm leading-snug text-muted-foreground" aria-live="polite">
              +{extra} more
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  if (record.linkedType === "family" && record.linkedFamilyId) {
    const h = record.linkedFamilyHusband;
    const w = record.linkedFamilyWife;
    return (
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{relLabel}</p>
        <div className="space-y-1.5">
          {h ? (
            <p className="flex items-start gap-2">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Link
                href={`/admin/individuals/${h.id}`}
                className={cn(nameLinkClass, "min-w-0 text-pretty text-base leading-snug")}
                onClick={(e) => e.stopPropagation()}
              >
                {h.label}
              </Link>
            </p>
          ) : null}
          {w ? (
            <p className="flex items-start gap-2">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Link
                href={`/admin/individuals/${w.id}`}
                className={cn(nameLinkClass, "min-w-0 text-pretty text-base leading-snug")}
                onClick={(e) => e.stopPropagation()}
              >
                {w.label}
              </Link>
            </p>
          ) : null}
          {!h && !w ? (
            <p className="flex items-start gap-2">
              <User className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <Link
                href={`/admin/families/${record.linkedFamilyId}`}
                className={cn(nameLinkClass)}
                onClick={(e) => e.stopPropagation()}
              >
                View family
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return <p className="flex-1 text-center text-sm text-muted-foreground">No person or family link</p>;
}

export function EventCard({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: EventCardRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasMenu = Boolean(onDelete || onView || onEdit);
  const dateText = record.date.trim();
  const placeText = record.place.trim();
  const secondary = record.customType.trim();

  return (
    <Card
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden border-base-content/12 bg-base-100/95",
        "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20",
      )}
    >
      <CardHeader className="relative space-y-2 pb-2 pt-3 text-center">
        {hasMenu ? (
          <div className="absolute end-2 top-2 z-[1]">
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "size-8 shrink-0 text-base-content/60 opacity-0 transition-opacity hover:bg-base-content/[0.04] hover:text-base-content",
                  "group-hover:opacity-100 focus-visible:z-10 focus-visible:opacity-100 focus-visible:outline-none",
                )}
                aria-label="More actions for this event"
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuGroup>
                  {onView ? (
                    <DropdownMenuItem onClick={() => onView()}>
                      <Eye className="size-4 text-muted-foreground" aria-hidden />
                      View
                    </DropdownMenuItem>
                  ) : null}
                  {onEdit ? (
                    <DropdownMenuItem onClick={() => onEdit()}>
                      <Pencil className="size-4 text-muted-foreground" aria-hidden />
                      Edit
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                {onDelete && (onView || onEdit) ? <DropdownMenuSeparator /> : null}
                {onDelete ? (
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" nativeButton onClick={() => onDelete()}>
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}

        <div
          className="mx-auto flex size-11 shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/8 text-base-content"
          aria-hidden
        >
          <GedcomEventTypeIcon eventType={record.eventType} className="size-6 text-base-content/85" />
        </div>

        <CardTitle className="text-balance text-base font-semibold leading-tight text-base-content sm:text-lg">
          {record.typeLabel}
        </CardTitle>
        {secondary ? (
          <p className="px-2 text-xs leading-snug text-muted-foreground">{secondary}</p>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 pb-3 pt-1 text-sm">
        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2 text-left">
          {dateText ? (
            <p className="flex min-w-0 items-start gap-1.5 text-xs text-base-content/90">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 text-pretty">{dateText}</span>
            </p>
          ) : (
            <p className="flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="mt-0.5 size-4 shrink-0 opacity-60" aria-hidden />
              <span>—</span>
            </p>
          )}
          {placeText ? (
            <p className="flex min-w-0 items-start gap-1.5 text-xs text-base-content/90">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 text-pretty">{placeText}</span>
            </p>
          ) : null}
        </div>

        <div className="mx-1 border-t border-base-content/10 sm:mx-2" />

        <div className="min-h-0 flex-1 px-1 pb-1 sm:px-2">
          <div
            className={cn(
              "group/rel flex w-full items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
              onView ? "hover:bg-base-content/[0.04]" : undefined,
            )}
          >
            <RelationshipBlock record={record} />
            {onView ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 size-7 shrink-0 text-base-content/35 hover:bg-base-content/[0.04] hover:text-base-content/65"
                onClick={onView}
                aria-label={`View event: ${record.typeLabel}`}
                title="View event"
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
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
            aria-label={`View ${record.typeLabel}`}
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
            aria-label={`Edit ${record.typeLabel}`}
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
            aria-label={`Delete ${record.typeLabel}`}
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
