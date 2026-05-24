"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, GitMerge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndividualSearchPicker } from "@/components/admin/IndividualSearchPicker";
import { postJson, fetchJson, ApiError } from "@/lib/infra/api";
import { formatDisplayNameFromNameForms } from "@/lib/gedcom/display-name";
import { RelationshipLabel } from "@ligneous/relationship-calculator";
import type { RelationshipResult } from "@ligneous/relationship-calculator";
import type { AdminIndividualListItem } from "@/hooks/useAdminIndividuals";

function personDisplayName(ind: AdminIndividualListItem): string {
  return (
    formatDisplayNameFromNameForms(ind.individualNameForms, ind.fullName).trim() ||
    ind.xref ||
    ind.id
  );
}

function SelectedPersonBadge({
  ind,
  label,
  onClear,
  locked,
}: {
  ind: AdminIndividualListItem;
  label: string;
  onClear: () => void;
  locked?: boolean;
}) {
  const name = personDisplayName(ind);
  const lifespan =
    ind.birthYear && ind.deathYear
      ? `${ind.birthYear}–${ind.deathYear}`
      : ind.birthYear
        ? `b. ${ind.birthYear}`
        : ind.deathYear
          ? `d. ${ind.deathYear}`
          : null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-medium text-foreground">{name}</p>
        {lifespan ? <p className="text-xs text-muted-foreground">{lifespan}</p> : null}
        <p className="font-mono text-[11px] text-muted-foreground">{ind.xref || ind.id}</p>
      </div>
      {!locked ? (
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Change
        </button>
      ) : null}
    </div>
  );
}

export default function RelationshipCalculatorPage() {
  const searchParams = useSearchParams();
  const sourceId = searchParams.get("sourceId");

  const [personA, setPersonA] = useState<AdminIndividualListItem | null>(null);
  const [personB, setPersonB] = useState<AdminIndividualListItem | null>(null);
  const [preloading, setPreloading] = useState(false);
  const [result, setResult] = useState<RelationshipResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Preload Person A from sourceId query param
  useEffect(() => {
    if (!sourceId) return;
    setPreloading(true);
    fetchJson<{ individual: Record<string, unknown> }>(`/api/admin/individuals/${encodeURIComponent(sourceId)}`)
      .then((data) => {
        const ind = data.individual;
        setPersonA({
          id: ind.id as string,
          xref: (ind.xref as string) ?? "",
          fullName: (ind.fullName as string | null) ?? null,
          sex: (ind.sex as string | null) ?? null,
          birthYear: (ind.birthYear as number | null) ?? null,
          deathYear: (ind.deathYear as number | null) ?? null,
          individualNameForms: ind.individualNameForms as AdminIndividualListItem["individualNameForms"],
        });
      })
      .catch(() => {
        toast.error("Could not load the pre-selected person.");
      })
      .finally(() => setPreloading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId]);

  const personALocked = Boolean(sourceId);
  const canCalculate = Boolean(personA && personB && personA.id !== personB.id);

  const handleSwap = () => {
    if (personALocked) return;
    setPersonA(personB);
    setPersonB(personA);
    setResult(null);
  };

  const handleCalculate = async () => {
    if (!personA || !personB) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await postJson<RelationshipResult>("/api/admin/relationship-between", {
        source_id: personA.id,
        target_id: personB.id,
      });
      setResult(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not calculate relationship.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Relationship calculator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find out how any two people in the tree are related.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Person A</CardTitle>
          </CardHeader>
          <CardContent>
            {preloading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : personA ? (
              <SelectedPersonBadge
                ind={personA}
                label="Person A"
                locked={personALocked}
                onClear={() => { setPersonA(null); setResult(null); }}
              />
            ) : (
              <IndividualSearchPicker
                idPrefix="person-a"
                excludeIds={personB ? new Set([personB.id]) : undefined}
                onPick={(ind) => { setPersonA(ind); setResult(null); }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Person B</CardTitle>
          </CardHeader>
          <CardContent>
            {personB ? (
              <SelectedPersonBadge
                ind={personB}
                label="Person B"
                onClear={() => { setPersonB(null); setResult(null); }}
              />
            ) : (
              <IndividualSearchPicker
                idPrefix="person-b"
                excludeIds={personA ? new Set([personA.id]) : undefined}
                onPick={(ind) => { setPersonB(ind); setResult(null); }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void handleCalculate()}
          disabled={!canCalculate || loading}
          className="gap-2"
        >
          <GitMerge className="size-4" />
          {loading ? "Calculating…" : "Calculate relationship"}
        </Button>
        {personA && personB && !personALocked ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSwap}
            className="gap-1.5"
          >
            <ArrowLeftRight className="size-3.5" />
            Swap A ↔ B
          </Button>
        ) : null}
        {personA && personA.id === personB?.id ? (
          <p className="text-sm text-muted-foreground">Pick two different people.</p>
        ) : null}
      </div>

      {result ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Result</CardTitle>
            {personA && personB ? (
              <p className="text-sm text-muted-foreground">
                {personDisplayName(personA)} relative to {personDisplayName(personB)}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <RelationshipLabel result={result} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
