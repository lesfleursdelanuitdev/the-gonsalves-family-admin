"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

function useGedcomImports() {
  return useQuery({
    queryKey: ["admin", "gedcom-imports", "list"],
    queryFn: () => fetchJson<{ imports: GedcomImportRow[] }>("/api/admin/imports/gedcom"),
  });
}

export function ReviewQueuePanel() {
  const router = useRouter();
  const { data: importsData, isLoading: importsLoading } = useGedcomImports();
  const { data: scansData, isLoading: scansLoading } = useQuery({
    queryKey: [...SCANS_QUERY_KEY, "list"],
    queryFn: () => fetchJson<{ scans: ScanListItem[] }>("/api/admin/merge-records/scans"),
  });

  const isLoading = importsLoading || scansLoading;

  const pendingImports = (importsData?.imports ?? []).filter(
    (i) => i.status !== "applied" && i.status !== "discarded",
  );

  const pendingScans = (scansData?.scans ?? []).filter((s) => s.status === "pending");

  const totalItems = pendingImports.length + pendingScans.length;

  return (
    <Card className="border-base-content/10 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">Review Queue</CardTitle>
        <CardDescription>
          Items waiting for a decision across GEDCOM imports and internal duplicate scans.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : totalItems === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing pending — the queue is clear.</p>
        ) : (
          <div className="divide-y divide-base-content/10 text-sm">
            {pendingImports.map((imp) => (
              <div
                key={imp.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-outline text-[10px] uppercase">GEDCOM</span>
                  <div>
                    <p className="font-medium text-foreground">{imp.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {statusLabel(imp.status)} · {new Date(imp.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/merge-records?tab=gedcom")}
                >
                  Review →
                </Button>
              </div>
            ))}
            {pendingScans.map((scan) => (
              <div
                key={scan.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="badge badge-sm badge-outline text-[10px] uppercase">Scan</span>
                  <div>
                    <p className="font-medium text-foreground">
                      {scan.summary.total} pair{scan.summary.total !== 1 ? "s" : ""} to review
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scanned {new Date(scan.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/merge-records?tab=duplicates")}
                >
                  Review →
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "validated": return "awaiting compare";
    case "compared": return "awaiting decisions";
    case "pending": return "in progress";
    default: return status;
  }
}
