"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SexIcon } from "@/components/admin/SexIcon";
import {
  STABLE_EMPTY_SEARCH_HITS,
  type IndSearchHit,
} from "@/components/admin/individual-editor/individual-family-search-types";
import { fetchJson } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";

/**
 * Same discovery pattern as {@link FamilyIndividualPickerList}: `GET /api/admin/individuals?q=…`
 * (at least 2 characters). Rows show xref, full name, and birth like other individual pickers.
 */
export function NewSpousePartnerIndividualSearch({
  inputIdPrefix,
  nameQuery,
  setNameQuery,
  excludeIndividualIds,
  onPick,
}: {
  inputIdPrefix: string;
  /** May be undefined briefly from parent state; coerced to "". */
  nameQuery?: string | null;
  setNameQuery: Dispatch<SetStateAction<string>>;
  excludeIndividualIds: ReadonlySet<string>;
  onPick: (id: string, displayLabel: string) => void | Promise<void>;
}) {
  const q = (nameQuery ?? "").trim();
  const enabled = q.length >= 2;

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "25");
    params.set("q", q);
    return `/api/admin/individuals?${params.toString()}`;
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "individuals", "newSpousePartnerQ", q],
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
        Search by any part of the name (same as the family editor individual picker). Type at least two characters;
        results match on structured name parts and full name.
      </p>
      <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
        <div className="space-y-2">
          <Label htmlFor={`${inputIdPrefix}-q`}>Name search</Label>
          <Input
            id={`${inputIdPrefix}-q`}
            value={nameQuery ?? ""}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Given or surname…"
            autoComplete="off"
            className="min-h-11 sm:min-h-10"
          />
        </div>
      </div>
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Type at least 2 characters to search by name.</p>
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
                  className="flex w-full gap-2 rounded px-2 py-2 text-left hover:bg-base-200 sm:py-1.5"
                  onClick={() => onPick(r.id, name)}
                >
                  <span className="pt-0.5">
                    <SexIcon sex={r.sex} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-xs text-muted-foreground">{xref}</span>
                    <span className="block font-medium text-base-content">{name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {birth ? <>Birth: {birth}</> : <>Birth: —</>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
