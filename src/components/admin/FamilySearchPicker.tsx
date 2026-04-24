"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import {
  ADMIN_FAMILIES_QUERY_KEY,
  buildFamiliesParams,
  type AdminFamiliesListResponse,
  type AdminFamilyListItem,
  type UseAdminFamiliesOpts,
} from "@/hooks/useAdminFamilies";
import { familyUnionMetaLine, familyUnionPrimaryLine } from "@/lib/gedcom/family-search-display";
import { FamilyPartnerSearchFields } from "@/components/admin/FamilyPartnerSearchFields";
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

export type FamilySearchPickerProps = {
  idPrefix?: string;
  label?: string;
  description?: string;
  excludeIds?: Set<string>;
  isPickDisabled?: (fam: AdminFamilyListItem) => boolean;
  onPick: (family: AdminFamilyListItem) => void;
  allowEmptySearch?: boolean;
  limit?: number;
  className?: string;
  p1GivenValue?: string;
  p1LastValue?: string;
  p2GivenValue?: string;
  p2LastValue?: string;
  onP1GivenChange?: (value: string) => void;
  onP1LastChange?: (value: string) => void;
  onP2GivenChange?: (value: string) => void;
  onP2LastChange?: (value: string) => void;
};

export function FamilySearchPicker({
  idPrefix = "fam-search",
  label,
  description,
  excludeIds,
  isPickDisabled,
  onPick,
  allowEmptySearch = false,
  limit = 25,
  className,
  p1GivenValue: p1GivenControlled,
  p1LastValue: p1LastControlled,
  p2GivenValue: p2GivenControlled,
  p2LastValue: p2LastControlled,
  onP1GivenChange,
  onP1LastChange,
  onP2GivenChange,
  onP2LastChange,
}: FamilySearchPickerProps) {
  const [p1GivenInternal, setP1GivenInternal] = useState("");
  const [p1LastInternal, setP1LastInternal] = useState("");
  const [p2GivenInternal, setP2GivenInternal] = useState("");
  const [p2LastInternal, setP2LastInternal] = useState("");

  const p1GivenInput = p1GivenControlled !== undefined ? p1GivenControlled : p1GivenInternal;
  const p1LastInput = p1LastControlled !== undefined ? p1LastControlled : p1LastInternal;
  const p2GivenInput = p2GivenControlled !== undefined ? p2GivenControlled : p2GivenInternal;
  const p2LastInput = p2LastControlled !== undefined ? p2LastControlled : p2LastInternal;

  const setP1Given = (v: string) => {
    if (onP1GivenChange) onP1GivenChange(v);
    else setP1GivenInternal(v);
  };
  const setP1Last = (v: string) => {
    if (onP1LastChange) onP1LastChange(v);
    else setP1LastInternal(v);
  };
  const setP2Given = (v: string) => {
    if (onP2GivenChange) onP2GivenChange(v);
    else setP2GivenInternal(v);
  };
  const setP2Last = (v: string) => {
    if (onP2LastChange) onP2LastChange(v);
    else setP2LastInternal(v);
  };

  const debouncedP1Given = useDebouncedValue(p1GivenInput.trim().toLowerCase(), 250);
  const debouncedP1Last = useDebouncedValue(p1LastInput.trim(), 250);
  const debouncedP2Given = useDebouncedValue(p2GivenInput.trim().toLowerCase(), 250);
  const debouncedP2Last = useDebouncedValue(p2LastInput.trim(), 250);

  const hasFilter = !!(debouncedP1Given || debouncedP1Last || debouncedP2Given || debouncedP2Last);
  const queryEnabled = allowEmptySearch || hasFilter;

  const listOpts: UseAdminFamiliesOpts = useMemo(
    () => ({
      p1Given: debouncedP1Given || undefined,
      p1Last: debouncedP1Last || undefined,
      p2Given: debouncedP2Given || undefined,
      p2Last: debouncedP2Last || undefined,
      limit,
      offset: 0,
    }),
    [debouncedP1Given, debouncedP1Last, debouncedP2Given, debouncedP2Last, limit],
  );

  const qs = useMemo(() => buildFamiliesParams(listOpts).toString(), [listOpts]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...ADMIN_FAMILIES_QUERY_KEY, "picker", qs],
    queryFn: () => fetchJson<AdminFamiliesListResponse>(`/api/admin/families${qs ? `?${qs}` : ""}`),
    enabled: queryEnabled,
  });

  const rows = useMemo(() => {
    const all = data?.families ?? [];
    if (!excludeIds?.size) return all;
    return all.filter((r) => !excludeIds.has(r.id));
  }, [data?.families, excludeIds]);

  const loading = isLoading || isFetching;

  return (
    <div className={cn("space-y-3", className)}>
      {label ? <Label className="text-base font-medium text-base-content">{label}</Label> : null}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}

      <FamilyPartnerSearchFields
        idPrefix={idPrefix}
        p1Given={p1GivenInput}
        p1Last={p1LastInput}
        p2Given={p2GivenInput}
        p2Last={p2LastInput}
        onP1GivenChange={setP1Given}
        onP1LastChange={setP1Last}
        onP2GivenChange={setP2Given}
        onP2LastChange={setP2Last}
        showUnorderedPairHint={false}
      />
      <p className="text-xs text-muted-foreground">
        Search does not assume which partner is stored as which GEDCOM parent link; with two partners
        filled, either parent order matches.
      </p>

      {!queryEnabled ? (
        <p className="text-sm text-muted-foreground">
          Type given name and/or surname prefix for one or both partners (same rules as the families
          list).
        </p>
      ) : null}

      {queryEnabled ? (
        <div className="max-h-60 overflow-auto rounded-box border border-base-content/10 bg-base-100 py-1 text-sm shadow-md">
          {loading ? (
            <p className="px-3 py-2 text-muted-foreground">Searching…</p>
          ) : rows.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground">No matches.</p>
          ) : (
            <ul className="divide-y divide-base-content/[0.06]">
              {rows.map((fam) => {
                const primary = familyUnionPrimaryLine(fam);
                const meta = familyUnionMetaLine(fam);
                const disabled = isPickDisabled?.(fam) ?? false;
                return (
                  <li key={fam.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-base-200/80 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onPick(fam)}
                    >
                      <span className="font-medium text-base-content">{primary}</span>
                      {meta ? (
                        <span className="font-mono text-xs text-muted-foreground">{meta}</span>
                      ) : null}
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
