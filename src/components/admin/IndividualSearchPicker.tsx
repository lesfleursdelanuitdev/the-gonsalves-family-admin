"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import {
  ADMIN_INDIVIDUALS_QUERY_KEY,
  buildIndividualsParams,
  type AdminIndividualListItem,
  type AdminIndividualsListResponse,
  type UseAdminIndividualsOpts,
} from "@/hooks/useAdminIndividuals";
import { individualSearchDisplayName, individualSearchMetaLine } from "@/lib/gedcom/individual-search-display";
import { IndividualNameSearchFields } from "@/components/admin/IndividualNameSearchFields";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function useDebouncedValue<T>(value: T, ms: number): T {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

export type IndividualSearchPickerProps = {
  idPrefix?: string;
  label?: string;
  description?: string;
  /** Rows omitted from the result list. */
  excludeIds?: Set<string>;
  /** If provided, row cannot be chosen (e.g. already linked). */
  isPickDisabled?: (ind: AdminIndividualListItem) => boolean;
  onPick: (individual: AdminIndividualListItem) => void;
  allowEmptySearch?: boolean;
  limit?: number;
  className?: string;
  /** Controlled given-name field (substring match, lowercased for API). */
  givenValue?: string;
  lastValue?: string;
  onGivenChange?: (value: string) => void;
  onLastChange?: (value: string) => void;
};

export function IndividualSearchPicker({
  idPrefix = "ind-search",
  label,
  description,
  excludeIds,
  isPickDisabled,
  onPick,
  allowEmptySearch = false,
  limit = 25,
  className,
  givenValue: givenControlled,
  lastValue: lastControlled,
  onGivenChange,
  onLastChange,
}: IndividualSearchPickerProps) {
  const [givenInternal, setGivenInternal] = useState("");
  const [lastInternal, setLastInternal] = useState("");

  const givenInput = givenControlled !== undefined ? givenControlled : givenInternal;
  const lastInput = lastControlled !== undefined ? lastControlled : lastInternal;

  const setGivenInput = (v: string) => {
    if (onGivenChange) onGivenChange(v);
    else setGivenInternal(v);
  };
  const setLastInput = (v: string) => {
    if (onLastChange) onLastChange(v);
    else setLastInternal(v);
  };

  const debouncedGiven = useDebouncedValue(givenInput.trim().toLowerCase(), 250);
  const debouncedLast = useDebouncedValue(lastInput.trim(), 250);

  const hasFilter = !!(debouncedGiven || debouncedLast);
  const queryEnabled = allowEmptySearch || hasFilter;

  const listOpts: UseAdminIndividualsOpts = useMemo(
    () => ({
      givenName: debouncedGiven || undefined,
      lastName: debouncedLast || undefined,
      limit,
      offset: 0,
    }),
    [debouncedGiven, debouncedLast, limit],
  );

  const qs = useMemo(() => buildIndividualsParams(listOpts).toString(), [listOpts]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...ADMIN_INDIVIDUALS_QUERY_KEY, "picker", qs],
    queryFn: () => fetchJson<AdminIndividualsListResponse>(`/api/admin/individuals${qs ? `?${qs}` : ""}`),
    enabled: queryEnabled,
  });

  const rows = useMemo(() => {
    const all = data?.individuals ?? [];
    if (!excludeIds?.size) return all;
    return all.filter((r) => !excludeIds.has(r.id));
  }, [data?.individuals, excludeIds]);

  const loading = isLoading || isFetching;

  return (
    <div className={cn("space-y-3", className)}>
      {label ? <Label className="text-base font-medium text-base-content">{label}</Label> : null}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

      <IndividualNameSearchFields
        idPrefix={idPrefix}
        givenValue={givenInput}
        lastValue={lastInput}
        onGivenChange={setGivenInput}
        onLastChange={setLastInput}
      />

      {!queryEnabled ? (
        <p className="text-sm text-muted-foreground">Type part of a given name and/or a surname prefix to search.</p>
      ) : null}

      {queryEnabled ? (
        <div className="max-h-60 overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-muted-foreground">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y divide-base-content/[0.06]">
              {rows.map((ind) => {
                const primary = individualSearchDisplayName(ind);
                const meta = individualSearchMetaLine(ind);
                const disabled = isPickDisabled?.(ind) ?? false;
                return (
                  <li key={ind.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-base-200/80 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onPick(ind)}
                    >
                      <span className="font-medium text-base-content">{primary}</span>
                      {meta ? (
                        <span className="font-mono text-xs text-muted-foreground">{meta}</span>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">{ind.xref || ind.id}</span>
                      )}
                      {disabled ? <span className="text-xs text-muted-foreground">(already linked)</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
