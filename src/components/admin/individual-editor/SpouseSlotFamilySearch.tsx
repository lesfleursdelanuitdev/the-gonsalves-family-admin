"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, type Dispatch, type SetStateAction } from "react";
import { ParentSexIcon } from "@/components/admin/individual-editor/ParentSexIcon";
import {
  STABLE_EMPTY_FAMILY_HITS,
  type FamilyHit,
} from "@/components/admin/individual-editor/individual-family-search-types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parentSexFromIndividualRecord } from "@/lib/forms/individual-editor-form";
import { fetchJson } from "@/lib/infra/api";
import {
  ADMIN_LAST_NAME_PREFIX_PLACEHOLDER,
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
} from "@/lib/gedcom/family-partner-slots";

/**
 * Families with exactly one GEDCOM spouse, where that partner matches given (contains) + surname prefix
 * (GEDCOM slash-aware), same SQL as Families as child parent search.
 */
export function SpouseSlotFamilySearch({
  inputIdPrefix,
  partnerGiven,
  partnerLast,
  setPartnerGiven,
  setPartnerLast,
  excludedFamilyIds,
  onPick,
}: {
  inputIdPrefix: string;
  partnerGiven: string;
  partnerLast: string;
  setPartnerGiven: Dispatch<SetStateAction<string>>;
  setPartnerLast: Dispatch<SetStateAction<string>>;
  excludedFamilyIds: ReadonlySet<string>;
  onPick: (familyId: string) => void | Promise<void>;
}) {
  const g = partnerGiven.trim().toLowerCase();
  const l = partnerLast.trim();
  const enabled = g.length > 0 && l.length > 0;

  const searchUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "12");
    params.set("partnerCount", "one");
    params.set("p1Given", g);
    params.set("p1Last", l);
    return `/api/admin/families?${params.toString()}`;
  }, [g, l]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "families", "spouseSinglePartner", g, l],
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
        Only families with <span className="font-medium text-base-content">one partner</span> listed are shown (the
        other position is empty), so this person can fill {FAMILY_PARTNER_1_LABEL} or {FAMILY_PARTNER_2_LABEL}{" "}
        depending on sex and which side is open. Given name is a contains match; last name uses the same slash-aware
        surname prefix as the child-parent family search.
      </p>
      <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
        <p className="text-sm font-medium text-base-content">Partner already in the family</p>
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
            placeholder={ADMIN_LAST_NAME_PREFIX_PLACEHOLDER}
          />
        </div>
      </div>
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Enter both given name and last name prefix to search.</p>
      ) : isFetching ? (
        <p className="text-xs text-muted-foreground">Searching…</p>
      ) : rawFamilies.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matching families.</p>
      ) : visibleFamilies.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          All matches are already linked to this person as a spouse or child, so they are hidden here.
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
          {visibleFamilies.map((f) => {
            const listed = f.husband ?? f.wife;
            const listedLabel = listed?.fullName ?? "—";
            const listedSex = parentSexFromIndividualRecord(listed);
            const openIsWife = !!f.husband && !f.wife;
            const openIsHusband = !f.husband && !!f.wife;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-base-200"
                  onClick={() => onPick(f.id)}
                >
                  <span className="font-mono text-xs text-muted-foreground">{f.xref || f.id.slice(0, 8)}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-base-content/80">
                    <ParentSexIcon sex={listedSex} />
                    <span>{listedLabel}</span>
                  </span>
                  {openIsWife ? (
                    <span className="block text-xs text-muted-foreground">{FAMILY_PARTNER_2_LABEL} is open</span>
                  ) : openIsHusband ? (
                    <span className="block text-xs text-muted-foreground">{FAMILY_PARTNER_1_LABEL} is open</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
