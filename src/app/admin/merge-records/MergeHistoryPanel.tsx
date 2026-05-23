"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchJson } from "@/lib/infra/api";
import { SCANS_QUERY_KEY, type ScanListItem } from "@/hooks/useInternalDuplicateScans";

type GedcomImportRow = {
  id: string;
  filename: string;
  status: string;
  createdAt: string;
  appliedAt: string | null;
  discardedAt: string | null;
};

type HistoryEntry = {
  key: string;
  kind: "gedcom" | "scan";
  label: string;
  status: string;
  date: string;
  stats?: string;
};

function useGedcomImports() {
  return useQuery({
    queryKey: ["admin", "gedcom-imports", "list"],
    queryFn: () => fetchJson<{ imports: GedcomImportRow[] }>("/api/admin/imports/gedcom"),
  });
}

export function MergeHistoryPanel() {
  const { data: importsData, isLoading: importsLoading } = useGedcomImports();
  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: [...SCANS_QUERY_KEY, "list"],
    queryFn: () => fetchJson<{ scans: ScanListItem[] }>("/api/admin/merge-records/scans"),
  });

  const isLoading = importsLoading || scansLoading;

  const entries: HistoryEntry[] = [];

  for (const imp of importsData?.imports ?? []) {
    if (imp.status !== "applied" && imp.status !== "discarded") continue;
    entries.push({
      key: `gedcom-${imp.id}`,
      kind: "gedcom",
      label: imp.filename,
      status: imp.status,
      date: imp.appliedAt ?? imp.discardedAt ?? imp.createdAt,
    });
  }

  for (const scan of scansData?.scans ?? []) {
    if (scan.status !== "applied" && scan.status !== "discarded") continue;
    entries.push({
      key: `scan-${scan.id}`,
      kind: "scan",
      label: `Scan — ${scan.summary.total} pairs`,
      status: scan.status,
      date: scan.appliedAt ?? scan.completedAt ?? scan.startedAt,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card className="border-base-content/10 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">Merge History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No applied or discarded items yet.</p>
        ) : (
          <div className="divide-y divide-base-content/10 text-sm">
            {entries.map((e) => (
              <div key={e.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-outline text-[10px] uppercase">
                    {e.kind === "gedcom" ? "GEDCOM" : "Scan"}
                  </span>
                  <span className="font-medium text-foreground">{e.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {e.stats ? <span>{e.stats}</span> : null}
                  <span
                    className={
                      e.status === "applied"
                        ? "text-success"
                        : e.status === "discarded"
                          ? "text-error"
                          : ""
                    }
                  >
                    {e.status}
                  </span>
                  <span>{new Date(e.date).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
