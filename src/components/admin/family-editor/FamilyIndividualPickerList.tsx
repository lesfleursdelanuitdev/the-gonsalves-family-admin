"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { SexIcon } from "@/components/admin/SexIcon";
import { cn } from "@/lib/utils";
import { FAMILY_PARTNER_1_LABEL, FAMILY_PARTNER_2_LABEL } from "@/lib/gedcom/family-partner-slots";

type IndHit = {
  id: string;
  xref: string;
  fullName: string | null;
  sex: string | null;
};

export function FamilyIndividualPickerList({
  query,
  excludeIds,
  allowedSexes,
  onPick,
}: {
  query: string;
  excludeIds: Set<string>;
  allowedSexes: Set<"M" | "F"> | null;
  onPick: (id: string) => void;
}) {
  const q = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["admin", "individuals", "family-edit-picker", q],
    queryFn: () =>
      fetchJson<{ individuals: IndHit[] }>(`/api/admin/individuals?limit=25&q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });

  if (q.length < 2) {
    return <p className="text-xs text-muted-foreground">Type at least 2 characters to search by name.</p>;
  }
  if (isFetching) return <p className="text-xs text-muted-foreground">Searching…</p>;
  const rows = data?.individuals ?? [];
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No matches.</p>;

  return (
    <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
      {rows.map((row) => {
        const excluded = excludeIds.has(row.id);
        const sx = row.sex != null ? String(row.sex).trim().toUpperCase() : "";
        const sexOk =
          allowedSexes == null
            ? true
            : sx === "M" || sx === "F"
              ? allowedSexes.has(sx as "M" | "F")
              : false;
        const disabled = excluded || !sexOk;
        const label = stripSlashesFromName(row.fullName) || row.xref || row.id.slice(0, 8);
        return (
          <li key={row.id}>
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "flex w-full min-h-11 items-center gap-2 rounded px-2 py-2 text-left hover:bg-base-200 sm:min-h-0 sm:py-1.5",
                disabled && "cursor-not-allowed opacity-50",
              )}
              onClick={() => {
                if (!disabled) onPick(row.id);
              }}
            >
              <SexIcon sex={row.sex} />
              <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
              {sx ? <span className="shrink-0 font-mono text-xs text-muted-foreground">{sx}</span> : null}
            </button>
            {excluded ? (
              <p className="px-2 pb-1 text-xs text-muted-foreground">Already in this family.</p>
            ) : !sexOk && allowedSexes != null ? (
              <p className="px-2 pb-1 text-xs text-muted-foreground">
                {sx !== "M" && sx !== "F"
                  ? "Set sex to Male or Female to match this open partner position."
                  : `Recorded sex does not match the open ${FAMILY_PARTNER_1_LABEL} or ${FAMILY_PARTNER_2_LABEL} position for this family.`}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
