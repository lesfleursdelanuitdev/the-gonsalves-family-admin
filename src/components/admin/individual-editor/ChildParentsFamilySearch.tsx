"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ADMIN_LAST_NAME_PREFIX_PLACEHOLDER,
  FAMILY_NAME_FILTER_COLUMNS_HELP,
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import { parentSexFromIndividualRecord } from "@/lib/forms/individual-editor-form";
import { fetchJson } from "@/lib/infra/api";
import {
  STABLE_EMPTY_FAMILY_HITS,
  type ChildFamilyParentPickLabels,
  type FamilyHit,
} from "@/components/admin/individual-editor/individual-family-search-types";

export function ChildParentsFamilySearch({
  inputIdPrefix,
  p1Given,
  p1Last,
  p2Given,
  p2Last,
  setP1Given,
  setP1Last,
  setP2Given,
  setP2Last,
  excludedFamilyIds,
  onPick,
}: {
  inputIdPrefix: string;
  p1Given: string;
  p1Last: string;
  p2Given: string;
  p2Last: string;
  setP1Given: Dispatch<SetStateAction<string>>;
  setP1Last: Dispatch<SetStateAction<string>>;
  setP2Given: Dispatch<SetStateAction<string>>;
  setP2Last: Dispatch<SetStateAction<string>>;
  excludedFamilyIds: ReadonlySet<string>;
  onPick: (familyId: string, parentLabels: ChildFamilyParentPickLabels) => void | Promise<void>;
}) {
  const g1 = p1Given.trim().toLowerCase();
  const l1 = p1Last.trim();
  const g2 = p2Given.trim().toLowerCase();
  const l2 = p2Last.trim();
  const hasP1 = !!(g1 || l1);
  const hasP2 = !!(g2 || l2);
  const enabled = hasP1 && hasP2;

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "12");
    if (g1) params.set("p1Given", g1);
    if (l1) params.set("p1Last", l1);
    if (g2) params.set("p2Given", g2);
    if (l2) params.set("p2Last", l2);
    return `/api/admin/families?${params.toString()}`;
  }, [g1, l1, g2, l2]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "families", "childParents", g1, l1, g2, l2],
    queryFn: () => fetchJson<{ families: FamilyHit[] }>(searchUrl),
    enabled,
  });

  const rawFamilies = data?.families != null ? data.families : STABLE_EMPTY_FAMILY_HITS;
  const visibleFamilies = useMemo(
    () => rawFamilies.filter((f) => !excludedFamilyIds.has(f.id)),
    [rawFamilies, excludedFamilyIds],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {FAMILY_PARTNER_SLOT_SUBTITLE} {FAMILY_NAME_FILTER_COLUMNS_HELP} Last name uses the same slash-aware surname
        prefix as the notes linked-record picker and the individuals list.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
          <p className="text-sm font-medium text-base-content">{FAMILY_PARTNER_1_LABEL}</p>
          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-p1-given`}>Given name contains</Label>
            <Input
              id={`${inputIdPrefix}-p1-given`}
              value={p1Given}
              onChange={(e) => setP1Given(e.target.value)}
              placeholder="e.g. Maria"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-p1-last`}>Last name prefix</Label>
            <Input
              id={`${inputIdPrefix}-p1-last`}
              value={p1Last}
              onChange={(e) => setP1Last(e.target.value)}
              placeholder={ADMIN_LAST_NAME_PREFIX_PLACEHOLDER}
            />
          </div>
        </div>
        <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
          <p className="text-sm font-medium text-base-content">{FAMILY_PARTNER_2_LABEL}</p>
          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-p2-given`}>Given name contains</Label>
            <Input
              id={`${inputIdPrefix}-p2-given`}
              value={p2Given}
              onChange={(e) => setP2Given(e.target.value)}
              placeholder="e.g. João"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${inputIdPrefix}-p2-last`}>Last name prefix</Label>
            <Input
              id={`${inputIdPrefix}-p2-last`}
              value={p2Last}
              onChange={(e) => setP2Last(e.target.value)}
              placeholder={ADMIN_LAST_NAME_PREFIX_PLACEHOLDER}
            />
          </div>
        </div>
      </div>
      {!enabled ? (
        <p className="text-xs text-muted-foreground">
          Enter at least one field for {FAMILY_PARTNER_1_LABEL} and one for {FAMILY_PARTNER_2_LABEL} to search.
        </p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Searching…</p>
      ) : rawFamilies.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matching families.</p>
      ) : visibleFamilies.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          All matches are already linked to this person as a child or spouse, so they are hidden here.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
          {visibleFamilies.map((f) => {
            const h = f.husband?.fullName ?? "—";
            const w = f.wife?.fullName ?? "—";
            const husbandSex = parentSexFromIndividualRecord(f.husband);
            const wifeSex = parentSexFromIndividualRecord(f.wife);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-base-200"
                  onClick={() =>
                    onPick(f.id, {
                      husband: h,
                      wife: w,
                      ...(husbandSex ? { husbandSex } : {}),
                      ...(wifeSex ? { wifeSex } : {}),
                      ...(f.husband?.id ? { husbandId: f.husband.id } : {}),
                      ...(f.wife?.id ? { wifeId: f.wife.id } : {}),
                    })
                  }
                >
                  <span className="font-mono text-xs text-muted-foreground">{f.xref || f.id.slice(0, 8)}</span>
                  <span className="block text-xs text-base-content/80">
                    <span className="font-medium text-muted-foreground">P1</span> {h}
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="font-medium text-muted-foreground">P2</span> {w}
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
