"use client";

import Link from "next/link";
import {
  CalendarHeart,
  Copy,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
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
import { initialsFromPersonLabel } from "@/lib/gedcom/display-name";
import { cn } from "@/lib/utils";

export type FamilyCardRecord = {
  id: string;
  xref: string;
  husbandId: string | null;
  wifeId: string | null;
  partner1: string;
  partner2: string;
  childCount: number;
  marriageYear: string;
};

const partnerLinkClass =
  "font-semibold text-primary underline-offset-2 transition-colors hover:underline";
const partnerPlainClass = "font-semibold text-primary";

async function copyToClipboard(label: string, value: string) {
  const v = value.trim();
  if (!v) {
    toast.error("Nothing to copy");
    return;
  }
  try {
    await navigator.clipboard.writeText(v);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

export function FamilyCard({
  record,
  onView,
  onEdit,
  onDelete,
}: {
  record: FamilyCardRecord;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const hasFooter = Boolean(onView || onEdit || onDelete);
  const xrefTrim = record.xref.trim();
  const hInitials = initialsFromPersonLabel(record.partner1);
  const wInitials = initialsFromPersonLabel(record.partner2);
  const marriageDisplay = record.marriageYear.trim() || "—";
  const childLabel = `${record.childCount} ${record.childCount === 1 ? "child" : "children"}`;

  const partner1El =
    record.husbandId && record.partner1 !== "—" ? (
      <Link
        href={`/admin/individuals/${record.husbandId}`}
        className={partnerLinkClass}
        onClick={(e) => e.stopPropagation()}
      >
        {record.partner1}
      </Link>
    ) : (
      <span className={partnerPlainClass}>{record.partner1}</span>
    );

  const partner2El =
    record.wifeId && record.partner2 !== "—" ? (
      <Link
        href={`/admin/individuals/${record.wifeId}`}
        className={partnerLinkClass}
        onClick={(e) => e.stopPropagation()}
      >
        {record.partner2}
      </Link>
    ) : (
      <span className={partnerPlainClass}>{record.partner2}</span>
    );

  return (
    <Card
      className={cn(
        "group flex h-full min-h-0 flex-col overflow-hidden border-base-content/12 bg-base-100/95",
        "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-black/20",
      )}
    >
      <CardHeader className="relative space-y-2 pb-2 pt-3 text-center">
        <div className="absolute start-3 top-3 z-[1]">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Family
          </span>
        </div>
        <div className="absolute end-2 top-2 z-[1]">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8 shrink-0 text-base-content/60 opacity-0 transition-opacity hover:bg-base-content/[0.04] hover:text-base-content",
                "group-hover:opacity-100 focus-visible:z-10 focus-visible:opacity-100 focus-visible:outline-none",
              )}
              aria-label="More actions for this family"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
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
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => copyToClipboard("Record ID", record.id)}
                  disabled={!record.id}
                >
                  <Copy className="size-4 text-muted-foreground" aria-hidden />
                  Copy record ID
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => copyToClipboard("XREF", xrefTrim)}
                  disabled={!xrefTrim}
                >
                  <Copy className="size-4 text-muted-foreground" aria-hidden />
                  Copy XREF
                </DropdownMenuItem>
              </DropdownMenuGroup>
              {onDelete ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" nativeButton onClick={() => onDelete()}>
                      <Trash2 className="size-4" aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex justify-center ps-3 pt-1" aria-hidden>
          <div className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/8 text-sm font-bold text-base-content">
            {hInitials}
          </div>
          <div className="relative z-20 -ms-3 flex size-11 shrink-0 items-center justify-center rounded-full border border-base-content/12 bg-white/10 text-sm font-bold text-base-content">
            {wInitials}
          </div>
        </div>

        <CardTitle className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-balance px-1 text-base font-semibold leading-snug sm:text-lg">
          {partner1El}
          <span className="font-normal text-muted-foreground" aria-hidden>
            ·
          </span>
          {partner2El}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col space-y-3 pb-3 pt-1 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-md border border-base-content/10 bg-base-content/[0.02] px-2.5 py-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <CalendarHeart className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium text-base-content/80">Married</span>
            <span className="ml-auto min-w-0 truncate text-muted-foreground">{marriageDisplay}</span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs">
            <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium text-base-content/80">Children</span>
            <span className="ml-auto min-w-0 shrink-0 text-end">
              <Link
                href={`/admin/families/${record.id}`}
                className="text-muted-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
              >
                {childLabel}
              </Link>
            </span>
          </p>
        </div>
      </CardContent>

      {hasFooter ? (
        <div className="mt-auto grid grid-cols-3 divide-x divide-base-content/10 border-t border-base-content/10 bg-base-content/[0.015]">
          {onView ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-9 w-full rounded-none border-0 text-base-content/70 hover:bg-base-content/[0.04] hover:text-base-content focus-visible:z-10"
              onClick={onView}
              aria-label={`View family ${record.partner1} · ${record.partner2}`}
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
              aria-label={`Edit family ${record.partner1} · ${record.partner2}`}
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
              aria-label={`Delete family ${record.partner1} · ${record.partner2}`}
              title="Delete"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </Card>
  );
}
