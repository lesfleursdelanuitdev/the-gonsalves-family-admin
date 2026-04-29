"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { cn } from "@/lib/utils";
import type { FamilyEditSourceJoin } from "@/components/admin/family-editor/family-editor-types";

export type FamilyEditorSourcesTabPanelProps = {
  noCardShell?: boolean;
  mode: "create" | "edit";
  familySources: FamilyEditSourceJoin[];
};

export function FamilyEditorSourcesTabPanel({
  noCardShell = true,
  mode,
  familySources,
}: FamilyEditorSourcesTabPanelProps) {
  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Finish creating the family before attaching sources.</p>
    ) : familySources.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No sources added yet.</p>
      </div>
    ) : (
      familySources.map((row) => {
        const s = row.source;
        return (
          <div
            key={String(s.id)}
            className="rounded-lg border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
          >
            <p className="font-medium">{String(s.title ?? s.xref ?? "Source")}</p>
            {s.author ? <p className="text-muted-foreground">Author: {String(s.author)}</p> : null}
            {s.publication ? <p className="text-muted-foreground">{String(s.publication)}</p> : null}
            <CollapsibleFormSection title="Citation details">
              <p className="font-mono text-xs text-muted-foreground">Record id: {String(s.xref ?? "")}</p>
              {row.page ? <p>Page: {row.page}</p> : null}
              {row.citationText ? <p className="mt-1 whitespace-pre-wrap text-xs">{row.citationText}</p> : null}
            </CollapsibleFormSection>
          </div>
        );
      })
    );

  const actions =
    mode === "edit" ? (
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href="/admin/sources"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "inline-flex min-h-11 flex-1 items-center justify-center gap-2 border-dashed sm:flex-none",
          )}
        >
          <Plus className="size-4" aria-hidden />
          Add source
        </Link>
        <Link
          href="/admin/sources"
          className={cn(buttonVariants({ variant: "outline" }), "inline-flex min-h-11 flex-1 items-center justify-center sm:flex-none")}
        >
          Choose from archive
        </Link>
      </div>
    ) : null;

  const inner = (
    <div className="space-y-4">
      <div className="space-y-3">{listBlock}</div>
      {actions}
    </div>
  );

  if (noCardShell) {
    return (
      <div role="region" aria-label="Sources" className="space-y-3">
        {inner}
      </div>
    );
  }

  return <div role="region" aria-label="Sources">{inner}</div>;
}
