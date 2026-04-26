"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IndividualEditSourceJoin } from "@/components/admin/individual-editor/individual-editor-types";

export type IndividualEditorSourcesTabPanelProps = {
  hidden: boolean;
  mode: "create" | "edit";
  individualSources: IndividualEditSourceJoin[];
};

export function IndividualEditorSourcesTabPanel({
  hidden,
  mode,
  individualSources,
}: IndividualEditorSourcesTabPanelProps) {
  return (
    <div
      id="individual-editor-panel-sources"
      role="tabpanel"
      aria-labelledby="individual-editor-tab-sources"
      hidden={hidden}
      className="space-y-8 pt-2"
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Sources</CardTitle>
          <p className="text-sm text-muted-foreground">Source citations linked to this person.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              Save this person first to see sources linked to their record.
            </p>
          ) : individualSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources linked to this individual.</p>
          ) : (
            individualSources.map((row) => {
              const s = row.source;
              return (
                <div
                  key={String(s.id)}
                  className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                >
                  <p className="font-medium">{String(s.title ?? s.xref ?? "Source")}</p>
                  <p className="text-xs font-mono text-muted-foreground">{String(s.xref ?? "")}</p>
                  {s.author ? <p className="text-muted-foreground">Author: {String(s.author)}</p> : null}
                  {s.publication ? <p className="text-muted-foreground">{String(s.publication)}</p> : null}
                  {row.page ? <p>Page: {row.page}</p> : null}
                  {row.citationText ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs">{row.citationText}</p>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
