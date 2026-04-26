"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  STABLE_EMPTY_SEARCH_HITS,
  type IndSearchHit,
} from "@/components/admin/individual-editor/individual-family-search-types";
import { fetchJson } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

export function NewSpousePartnerIndividualSearch({
  inputIdPrefix,
  partnerGiven,
  partnerLast,
  setPartnerGiven,
  setPartnerLast,
  excludeIndividualIds,
  onPick,
}: {
  inputIdPrefix: string;
  partnerGiven: string;
  partnerLast: string;
  setPartnerGiven: Dispatch<SetStateAction<string>>;
  setPartnerLast: Dispatch<SetStateAction<string>>;
  excludeIndividualIds: ReadonlySet<string>;
  onPick: (id: string, displayLabel: string) => void | Promise<void>;
}) {
  const g = partnerGiven.trim().toLowerCase();
  const l = partnerLast.trim();
  const enabled = g.length > 0 && l.length > 0;

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "25");
    params.set("givenName", g);
    params.set("lastName", l);
    return `/api/admin/individuals?${params.toString()}`;
  }, [g, l]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "individuals", "newSpousePartner", g, l],
    queryFn: () => fetchJson<{ individuals: IndSearchHit[] }>(searchUrl),
    enabled,
  });

  const rawRows = data?.individuals != null ? data.individuals : STABLE_EMPTY_SEARCH_HITS;
  const visibleRows = useMemo(
    () => rawRows.filter((r) => !excludeIndividualIds.has(r.id)),
    [rawRows, excludeIndividualIds],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Given name is a contains match; last name uses the same GEDCOM slash-aware prefix as the Individuals list
        (e.g. <span className="font-medium text-base-content">Gonsalves</span> matches{" "}
        <span className="font-mono">/Gonsalves/</span>; <span className="font-medium text-base-content">G</span> matches{" "}
        <span className="font-mono">/Gon/</span>).
      </p>
      <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
        <div className="space-y-2">
          <Label htmlFor={`${inputIdPrefix}-given`}>Given name contains</Label>
          <Input
            id={`${inputIdPrefix}-given`}
            value={partnerGiven}
            onChange={(e) => setPartnerGiven(e.target.value)}
            placeholder="e.g. Maria"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${inputIdPrefix}-last`}>Last name prefix</Label>
          <Input
            id={`${inputIdPrefix}-last`}
            value={partnerLast}
            onChange={(e) => setPartnerLast(e.target.value)}
            placeholder="GEDCOM slash-aware prefix"
          />
        </div>
      </div>
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Enter both given name and last name prefix to search.</p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Searching…</p>
      ) : rawRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matching individuals.</p>
      ) : visibleRows.length === 0 ? (
        <p className="text-xs text-muted-foreground">All matches are excluded (e.g. this person or already chosen).</p>
      ) : (
        <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
          {visibleRows.map((r) => {
            const name = stripSlashesFromName(r.fullName) || "—";
            const xref = r.xref?.trim() || r.id.slice(0, 8);
            const birth =
              (r.birthDateDisplay && String(r.birthDateDisplay).trim()) ||
              (r.birthYear != null && Number.isFinite(Number(r.birthYear))
                ? String(Math.trunc(Number(r.birthYear)))
                : "");
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 rounded px-2 py-2 text-left hover:bg-base-200 sm:py-1.5"
                  onClick={() => onPick(r.id, name)}
                >
                  <span className="font-mono text-xs text-muted-foreground">{xref}</span>
                  <span className="font-medium text-base-content">{name}</span>
                  {birth ? (
                    <span className="text-xs text-muted-foreground">Birth: {birth}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Birth: —</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
