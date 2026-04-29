"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import type { IndividualEditSourceJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorSourcesTabPanelProps = {
  hidden: boolean;
  noCardShell?: boolean;
  mode: "create" | "edit";
  individualSources: IndividualEditSourceJoin[];
};

export function IndividualEditorSourcesTabPanel({
  hidden,
  noCardShell = false,
  mode,
  individualSources,
}: IndividualEditorSourcesTabPanelProps) {
  const listBlock =
    mode === "create" ? (
      <p className="text-sm text-muted-foreground">Save this person first to attach sources and citations.</p>
    ) : individualSources.length === 0 ? (
      <div className="rounded-lg border border-dashed border-base-content/15 bg-base-content/[0.02] px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No sources added yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Link books, certificates, or web citations from the Sources area of the admin site.
        </p>
      </div>
    ) : (
      individualSources.map((row) => {
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

  const body = noCardShell ? (
    <div className="space-y-3">{listBlock}</div>
  ) : (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Sources</CardTitle>
        <p className="text-sm text-muted-foreground">Citations linked to this person.</p>
      </CardHeader>
      <CardContent className="space-y-3">{listBlock}</CardContent>
    </Card>
  );

  return (
    <div role="region" aria-label="Sources" hidden={hidden} className={noCardShell ? "space-y-3" : "space-y-8 pt-2"}>
      {body}
    </div>
  );
}
