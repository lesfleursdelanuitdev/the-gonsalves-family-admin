"use client";

import Link from "next/link";
import { MoreHorizontal, Plus, Star } from "lucide-react";
import { ParentSexIcon } from "@/components/admin/individual-editor/ParentSexIcon";
import { spouseFamilyCardPartnerTitle } from "@/components/admin/individual-editor/individual-editor-family-card-label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SpouseFamilyFormRow } from "@/lib/forms/individual-editor-form";

export type IndividualEditorChildrenGroupedSectionProps = {
  mode: "create" | "edit";
  individualId: string;
  familiesAsSpouse: SpouseFamilyFormRow[];
  onAddChildForFamily: (familyId: string) => void;
};

function isCommittedSpouseFamilyRow(row: SpouseFamilyFormRow): boolean {
  if (row.newFamilyExistingPartnerId || row.newFamilyNewPartner) return false;
  return !!row.familyId.trim();
}

export function IndividualEditorChildrenGroupedSection({
  mode,
  individualId,
  familiesAsSpouse,
  onAddChildForFamily,
}: IndividualEditorChildrenGroupedSectionProps) {
  const rows = familiesAsSpouse.filter(isCommittedSpouseFamilyRow);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No children shown yet — add a partner family first, or use Add child with &quot;unknown other parent&quot; to
          start a one-parent family.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">Children</h3>
        <p className="text-sm text-muted-foreground">
          Children connected to this person through a family record.
        </p>
      </div>
      <ul className="space-y-4">
        {rows.map((row) => {
          const title = spouseFamilyCardPartnerTitle(row, individualId, mode);
          const children = row.childrenInFamily ?? [];
          const n = children.length;
          return (
            <li key={row.familyId}>
              <Card className="overflow-hidden border-base-content/10 shadow-none">
                <CardHeader className="border-b border-base-content/10 bg-base-content/[0.02] pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <CardTitle className="text-base font-semibold leading-snug">
                        Family with {title}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {n === 0 ? "No children in this family yet" : `${n} child${n === 1 ? "" : "ren"}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <Link
                        href={`/admin/families/${row.familyId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")}
                      >
                        Open family
                      </Link>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="gap-1 whitespace-nowrap border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15"
                        onClick={() => onAddChildForFamily(row.familyId)}
                      >
                        <Plus className="size-4" aria-hidden />
                        Add child
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          type="button"
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "icon" }),
                            "size-9 shrink-0 text-muted-foreground",
                          )}
                          aria-label="Family actions"
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onAddChildForFamily(row.familyId)}>
                            Add child…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {children.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No children linked in this family.</p>
                  ) : (
                    <ul className="space-y-2">
                      {children.map((ch) => {
                        const isSelf = mode === "edit" && ch.individualId === individualId;
                        return (
                          <li key={ch.individualId}>
                            <span className="inline-flex items-center gap-2 text-sm text-base-content/90">
                              <ParentSexIcon sex={ch.sex} />
                              {isSelf ? (
                                <Star
                                  className="size-4 shrink-0 fill-amber-400 text-amber-500"
                                  aria-label="This person"
                                />
                              ) : null}
                              {isSelf ? (
                                <span className="font-medium text-foreground">{ch.displayName}</span>
                              ) : (
                                <Link
                                  href={`/admin/individuals/${ch.individualId}`}
                                  className="link link-primary font-medium"
                                >
                                  {ch.displayName}
                                </Link>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
