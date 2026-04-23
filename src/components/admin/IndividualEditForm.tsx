"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import {
  IconGenderFemale,
  IconGenderMale,
  IconHeartbeat,
  IconHelpCircle,
  IconSkull,
} from "@tabler/icons-react";
import {
  Baby,
  BookOpen,
  CalendarDays,
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Image,
  Star,
  StickyNote,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClassName } from "@/components/data-viewer/constants";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { IndividualAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { ApiError, fetchJson, postJson } from "@/lib/infra/api";
import { GEDCOM_DATE_SPECIFIER_OPTIONS, gedcomDateSpecifierNeedsRange } from "@/lib/gedcom/gedcom-date-specifiers";
import {
  buildEditorSubmitBody,
  emptyIndividualEditorFormSeed,
  familyChildrenToSummaries,
  individualDetailToFormSeed,
  keyFactToApiValue,
  newEmptyNameFormEditorRow,
  parentSexFromIndividualRecord,
  previewFullNameFromParts,
  spouseFamilyRowFromFamilyRecord,
  SURNAME_PIECE_TYPE_OPTIONS,
  type ChildFamilyFormRow,
  type ChildInFamilySummary,
  type IndividualEditorFormSeed,
  type KeyFactFormState,
  type NameFormRole,
  type SpouseFamilyFormRow,
  type SurnameFormRow,
} from "@/lib/forms/individual-editor-form";
import {
  FAMILY_NAME_FILTER_COLUMNS_HELP,
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import type { LivingMode } from "@/lib/admin/admin-individual-living";
import { INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import {
  useAdminIndividualEvents,
  useAdminIndividualUserLinks,
  useCreateIndividual,
  useUpdateIndividual,
} from "@/hooks/useAdminIndividuals";
import { useCreateUserLink, useDeleteUserLink } from "@/hooks/useAdminUsers";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { cn } from "@/lib/utils";

type Props =
  | { mode: "create" }
  | { mode: "edit"; individualId: string; initialIndividual: Record<string, unknown> };

const RELATIONSHIP_OPTIONS = [
  { value: "biological", label: "Biological" },
  { value: "adopted", label: "Adopted" },
  { value: "foster", label: "Foster" },
  { value: "step", label: "Step" },
  { value: "sealing", label: "Sealing" },
];

const NEW_PARENT_SEX_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Select sex…" },
  { value: "M", label: "Male (M)" },
  { value: "F", label: "Female (F)" },
  { value: "U", label: "Unknown (U)" },
  { value: "X", label: "Other (X)" },
];

const EVENT_SOURCE_LABELS: Record<string, string> = {
  individual: "Self",
  family: "Family",
  spouseDeath: "Spouse",
  childBirth: "Child birth",
  childDeath: "Child death",
  childMarriage: "Child marriage",
  grandchildBirth: "Grandchild birth",
  parentDeath: "Parent",
  siblingDeath: "Sibling",
  grandparentDeath: "Grandparent",
};

type IndividualEditorTab = "identity" | "names" | "events" | "spouse" | "child" | "notes" | "media" | "sources";

const EDITOR_TAB_ITEMS: { id: IndividualEditorTab; label: string; icon: LucideIcon }[] = [
  { id: "identity", label: "Identity", icon: User },
  { id: "names", label: "Names", icon: CaseSensitive },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "spouse", label: "Families as Spouse", icon: Users },
  { id: "child", label: "Families as Child", icon: Baby },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "media", label: "Media", icon: Image },
  { id: "sources", label: "Sources", icon: BookOpen },
];

type ChildFamilySearchSlot = {
  id: string;
  p1Given: string;
  p1Last: string;
  p2Given: string;
  p2Last: string;
};

function createChildFamilySearchSlot(): ChildFamilySearchSlot {
  return {
    id: crypto.randomUUID(),
    p1Given: "",
    p1Last: "",
    p2Given: "",
    p2Last: "",
  };
}

type SpouseFamilySearchSlot = { id: string; partnerGiven: string; partnerLast: string };

function createSpouseFamilySearchSlot(): SpouseFamilySearchSlot {
  return { id: crypto.randomUUID(), partnerGiven: "", partnerLast: "" };
}

type SpouseNewFamilyExistingSearchSlot = { id: string; partnerGiven: string; partnerLast: string };

function createSpouseNewFamilyExistingSearchSlot(): SpouseNewFamilyExistingSearchSlot {
  return { id: crypto.randomUUID(), partnerGiven: "", partnerLast: "" };
}

type IndSearchHit = {
  id: string;
  xref: string;
  fullName: string | null;
  sex: string | null;
  birthDateDisplay?: string | null;
  birthYear?: number | null;
};

/** Same structured filters as the individuals admin list: given contains + GEDCOM slash-aware surname prefix. */
function NewSpousePartnerIndividualSearch({
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

  const rawRows = data?.individuals ?? [];
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

function spouseFamilyChildSearchExcludes(
  row: SpouseFamilyFormRow,
  editIndividualId: string | undefined,
  mode: "create" | "edit",
): Set<string> {
  const ids = new Set<string>();
  if (mode === "edit" && editIndividualId) ids.add(editIndividualId);
  if (row.husbandId) ids.add(row.husbandId);
  if (row.wifeId) ids.add(row.wifeId);
  for (const ch of row.childrenInFamily ?? []) ids.add(ch.individualId);
  for (const p of row.pendingSpouseFamilyChildren ?? []) {
    if (p.kind === "existing") ids.add(p.childIndividualId);
  }
  return ids;
}

const parentSexIconProps = { size: 18, stroke: 1.5 } as const;

function ParentSexIcon({ sex }: { sex?: string | null }) {
  const s = (sex ?? "").trim().toUpperCase();
  if (s === "M") {
    return (
      <IconGenderMale
        {...parentSexIconProps}
        className="shrink-0 text-muted-foreground"
        aria-hidden
      />
    );
  }
  if (s === "F") {
    return (
      <IconGenderFemale
        {...parentSexIconProps}
        className="shrink-0 text-muted-foreground"
        aria-hidden
      />
    );
  }
  return (
    <IconHelpCircle {...parentSexIconProps} className="shrink-0 text-muted-foreground" aria-hidden />
  );
}

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function KeyFactSection({
  title,
  fact,
  onChange,
  defaultOpen = false,
}: {
  title: string;
  fact: KeyFactFormState;
  onChange: (next: KeyFactFormState) => void;
  /** When true, the editor starts expanded. */
  defaultOpen?: boolean;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const showRange = gedcomDateSpecifierNeedsRange(fact.dateSpecifier);
  const set = (patch: Partial<KeyFactFormState>) => onChange({ ...fact, ...patch });

  return (
    <section className="rounded-lg border border-base-content/12 bg-base-200/20 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md text-left hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-base-content">{title}</h3>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label>Date type</Label>
          <select
            className={selectClassName}
            value={fact.dateSpecifier}
            onChange={(e) => set({ dateSpecifier: e.target.value })}
          >
            {GEDCOM_DATE_SPECIFIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Original phrase (optional)</Label>
          <Input value={fact.dateOriginal} onChange={(e) => set({ dateOriginal: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Year</Label>
          <Input value={fact.y} onChange={(e) => set({ y: e.target.value })} inputMode="numeric" />
        </div>
        <div className="space-y-2">
          <Label>Month</Label>
          <Input value={fact.m} onChange={(e) => set({ m: e.target.value })} inputMode="numeric" />
        </div>
        <div className="space-y-2">
          <Label>Day</Label>
          <Input value={fact.d} onChange={(e) => set({ d: e.target.value })} inputMode="numeric" />
        </div>
        {showRange ? (
          <>
            <div className="space-y-2">
              <Label>End year</Label>
              <Input value={fact.ey} onChange={(e) => set({ ey: e.target.value })} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>End month</Label>
              <Input value={fact.em} onChange={(e) => set({ em: e.target.value })} inputMode="numeric" />
            </div>
            <div className="space-y-2">
              <Label>End day</Label>
              <Input value={fact.ed} onChange={(e) => set({ ed: e.target.value })} inputMode="numeric" />
            </div>
          </>
        ) : null}
          </div>
          <div className="border-t border-base-content/10 pt-3">
        <h4 className="mb-2 text-xs font-medium text-muted-foreground">Place</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>City / locality</Label>
            <Input value={fact.placeName} onChange={(e) => set({ placeName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>County</Label>
            <Input value={fact.placeCounty} onChange={(e) => set({ placeCounty: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>State / province</Label>
            <Input value={fact.placeState} onChange={(e) => set({ placeState: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Country</Label>
            <Input value={fact.placeCountry} onChange={(e) => set({ placeCountry: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Full place text (optional)</Label>
            <Input value={fact.placeOriginal} onChange={(e) => set({ placeOriginal: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={fact.placeLat} onChange={(e) => set({ placeLat: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input value={fact.placeLng} onChange={(e) => set({ placeLng: e.target.value })} />
          </div>
        </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CollapsibleFormSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** When true, the section starts expanded. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-base-content/12 bg-base-200/20 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md text-left hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-base-content">{title}</h3>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="mt-3 space-y-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

type FamilyHit = {
  id: string;
  xref: string;
  husband: { id: string; fullName: string | null; sex?: string | null; gender?: string | null } | null;
  wife: { id: string; fullName: string | null; sex?: string | null; gender?: string | null } | null;
};

type ChildFamilyParentPickLabels = {
  husband: string;
  wife: string;
  husbandSex?: string;
  wifeSex?: string;
  husbandId?: string;
  wifeId?: string;
};

function ChildParentsFamilySearch({
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

  const rawFamilies = data?.families ?? [];
  const visibleFamilies = useMemo(
    () => rawFamilies.filter((f) => !excludedFamilyIds.has(f.id)),
    [rawFamilies, excludedFamilyIds],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {FAMILY_PARTNER_SLOT_SUBTITLE} {FAMILY_NAME_FILTER_COLUMNS_HELP} Last name uses the same GEDCOM slash-aware
        prefix as the Notes linked-record picker and the individuals list.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
          <p className="text-sm font-medium text-base-content">
            {FAMILY_PARTNER_1_LABEL} <span className="font-normal text-muted-foreground">(HUSB)</span>
          </p>
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
              placeholder="GEDCOM slash-aware prefix"
            />
          </div>
        </div>
        <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
          <p className="text-sm font-medium text-base-content">
            {FAMILY_PARTNER_2_LABEL} <span className="font-normal text-muted-foreground">(WIFE)</span>
          </p>
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
              placeholder="GEDCOM slash-aware prefix"
            />
          </div>
        </div>
      </div>
      {!enabled ? (
        <p className="text-xs text-muted-foreground">Enter at least one field for P1 and one for P2 to search.</p>
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

/**
 * Families with exactly one GEDCOM spouse, where that partner matches given (contains) + surname prefix
 * (GEDCOM slash-aware), same SQL as Families as child parent search.
 */
function SpouseSlotFamilySearch({
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

  const rawFamilies = data?.families ?? [];
  const visibleFamilies = useMemo(
    () => rawFamilies.filter((f) => !excludedFamilyIds.has(f.id)),
    [rawFamilies, excludedFamilyIds],
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Only families with <span className="font-medium text-base-content">one spouse</span> listed are shown (the
        other GEDCOM slot is empty), so this person can fill Partner 1 (HUSB) or Partner 2 (WIFE) depending on sex and
        which slot is open. Given name is a contains match; last name uses the same GEDCOM slash-aware prefix as
        Families as child.
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
            placeholder="GEDCOM slash-aware prefix"
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
                    <span className="block text-xs text-muted-foreground">Partner 2 (WIFE) slot is empty</span>
                  ) : openIsHusband ? (
                    <span className="block text-xs text-muted-foreground">Partner 1 (HUSB) slot is empty</span>
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

type UserHit = { user: { id: string; username: string; email: string; name: string | null } };

function UserSearchHits({
  query,
  onPick,
  excludeUserIds,
}: {
  query: string;
  onPick: (id: string, label: string) => void;
  /** Users already linked to this individual (edit mode). */
  excludeUserIds?: Set<string>;
}) {
  const q = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["admin", "users", "picker", q],
    queryFn: () => fetchJson<{ users: UserHit[] }>(`/api/admin/users?limit=15&q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2,
  });

  if (q.length < 2) {
    return <p className="text-xs text-muted-foreground">Type at least 2 characters to search users.</p>;
  }
  if (isFetching) return <p className="text-xs text-muted-foreground">Searching…</p>;
  const rows = data?.users ?? [];
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">No users found.</p>;
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-base-content/10 bg-base-100 p-2 text-sm">
      {rows.map(({ user: u }) => {
        const excluded = excludeUserIds?.has(u.id) ?? false;
        return (
          <li key={u.id}>
            <button
              type="button"
              disabled={excluded}
              className={cn(
                "w-full rounded px-2 py-1.5 text-left hover:bg-base-200",
                excluded && "cursor-not-allowed opacity-50",
              )}
              onClick={() => {
                if (!excluded) onPick(u.id, u.name?.trim() || u.username);
              }}
            >
              <span className="font-medium">{u.name || u.username}</span>
              <span className="block text-xs text-muted-foreground">
                {u.username} · {u.email}
              </span>
            </button>
            {excluded ? (
              <p className="px-2 pb-1 text-xs text-muted-foreground">Already linked to this individual.</p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function IndividualEditForm(props: Props) {
  const router = useRouter();
  const mode = props.mode;
  const individualId = mode === "edit" ? props.individualId : "";
  const initialIndividual = mode === "edit" ? props.initialIndividual : undefined;

  const [seed, setSeed] = useState<IndividualEditorFormSeed>(() =>
    props.mode === "edit" && "initialIndividual" in props && props.initialIndividual
      ? individualDetailToFormSeed(props.initialIndividual)
      : emptyIndividualEditorFormSeed(),
  );

  /** Re-load seed when switching to a different individual; same id + refetch does not wipe edits. */
  const syncedIndividualIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (mode !== "edit" || !initialIndividual) return;
    if (syncedIndividualIdRef.current === individualId) return;
    syncedIndividualIdRef.current = individualId;
    setSeed(individualDetailToFormSeed(initialIndividual));
    setChildFamilySearchSlots([]);
    setSpouseFamilySearchSlots([]);
    setSpouseNewFamilyExistingSearchSlots([]);
    setSpouseAddChildExistingSearch(null);
  }, [mode, individualId, initialIndividual]);

  const [spouseFamilySearchSlots, setSpouseFamilySearchSlots] = useState<SpouseFamilySearchSlot[]>([]);
  const [spouseNewFamilyExistingSearchSlots, setSpouseNewFamilyExistingSearchSlots] = useState<
    SpouseNewFamilyExistingSearchSlot[]
  >([]);
  const [spouseAddChildExistingSearch, setSpouseAddChildExistingSearch] = useState<{
    rowIndex: number;
    partnerGiven: string;
    partnerLast: string;
  } | null>(null);
  const [childFamilySearchSlots, setChildFamilySearchSlots] = useState<ChildFamilySearchSlot[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [linkUserLabel, setLinkUserLabel] = useState("");
  const [editorTab, setEditorTab] = useState<IndividualEditorTab>("identity");

  const createIndividual = useCreateIndividual();
  const updateIndividual = useUpdateIndividual();
  const { data: userLinksRes, isLoading: userLinksLoading, error: userLinksError } =
    useAdminIndividualUserLinks(individualId);
  const userLinks = userLinksRes?.links ?? [];
  const userLinksErrMsg = userLinksError instanceof Error ? userLinksError.message : "";
  const linkedUserIds = useMemo(() => new Set(userLinks.map((r) => r.user.id)), [userLinks]);

  const createUserLink = useCreateUserLink();
  const deleteUserLink = useDeleteUserLink();

  const pending = createIndividual.isPending || updateIndividual.isPending;
  const userLinkBusy = createUserLink.isPending || deleteUserLink.isPending;
  const err = createIndividual.error ?? updateIndividual.error;
  const errMsg = err instanceof Error ? err.message : "";
  const errStatus = err instanceof ApiError ? err.status : undefined;

  const primaryNameForm = useMemo(
    () => seed.nameForms.find((f) => f.role === "primary") ?? seed.nameForms[0],
    [seed.nameForms],
  );
  const displayPreview = useMemo(
    () =>
      primaryNameForm
        ? previewFullNameFromParts(
            primaryNameForm.givenNames,
            primaryNameForm.surnames.map((r) => r.text),
          )
        : "",
    [primaryNameForm],
  );

  const individualNotes = useMemo(() => {
    if (mode !== "edit" || !initialIndividual) return [];
    return (initialIndividual.individualNotes as { note: Record<string, unknown> }[]) ?? [];
  }, [mode, initialIndividual]);

  const individualMedia = useMemo(() => {
    if (mode !== "edit" || !initialIndividual) return [];
    return (initialIndividual.individualMedia as { media: Record<string, unknown> }[]) ?? [];
  }, [mode, initialIndividual]);

  const individualSources = useMemo(() => {
    if (mode !== "edit" || !initialIndividual) return [];
    return (
      (initialIndividual.individualSources as {
        source: Record<string, unknown>;
        page: string | null;
        quality: number | null;
        citationText: string | null;
      }[]) ?? []
    );
  }, [mode, initialIndividual]);

  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminIndividualEvents(individualId);
  const timelineEvents = eventsRes?.events ?? [];
  const eventsErr = eventsError ? "Events could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE,
  }));

  useEffect(() => {
    setEventPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [individualId]);

  const eventPageCount = Math.max(1, Math.ceil(timelineEvents.length / eventPagination.pageSize));

  useEffect(() => {
    if (eventPagination.pageIndex >= eventPageCount) {
      setEventPagination((p) => ({ ...p, pageIndex: Math.max(0, eventPageCount - 1) }));
    }
  }, [eventPageCount, eventPagination.pageIndex]);

  const paginatedTimelineEvents = useMemo(() => {
    const { pageIndex, pageSize } = eventPagination;
    return timelineEvents.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [timelineEvents, eventPagination]);

  const onEventPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setEventPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const individualNewEventLabel = useMemo(() => {
    const x = seed.xref.trim();
    if (x) return x;
    return displayPreview.trim() || individualId || "Individual";
  }, [seed.xref, displayPreview, individualId]);

  const setNameFormRole = (formIdx: number, role: NameFormRole) => {
    setSeed((s) => {
      const nf = s.nameForms;
      if (role === "primary") {
        return {
          ...s,
          nameForms: nf.map((f, j) => ({
            ...f,
            role: j === formIdx ? "primary" : "alias",
            aliasNameType:
              j === formIdx
                ? f.aliasNameType
                : f.aliasNameType === "birth" || !f.aliasNameType?.trim()
                  ? "aka"
                  : f.aliasNameType,
          })),
        };
      }
      const row = nf[formIdx];
      if (row.role === "primary" && nf.length === 1) return s;
      if (row.role === "primary") {
        const promoteIdx = formIdx === 0 ? 1 : 0;
        return {
          ...s,
          nameForms: nf.map((f, j) => {
            if (j === promoteIdx) return { ...f, role: "primary" as const, aliasNameType: "aka" };
            if (j === formIdx)
              return {
                ...f,
                role: "alias" as const,
                aliasNameType: f.aliasNameType === "birth" ? "aka" : f.aliasNameType || "aka",
              };
            return { ...f, role: "alias" as const };
          }),
        };
      }
      return s;
    });
  };

  const addNameForm = () =>
    setSeed((s) => ({ ...s, nameForms: [...s.nameForms, newEmptyNameFormEditorRow("alias")] }));

  const removeNameForm = (formIdx: number) => {
    setSeed((s) => {
      if (s.nameForms.length <= 1) return s;
      if (s.nameForms[formIdx].role === "primary") {
        const rest = s.nameForms.filter((_, j) => j !== formIdx);
        const next = rest.map((f, j) =>
          j === 0 ? { ...f, role: "primary" as const, aliasNameType: "aka" } : f,
        );
        return { ...s, nameForms: next };
      }
      return { ...s, nameForms: s.nameForms.filter((_, j) => j !== formIdx) };
    });
  };

  const setGiven = (formIdx: number, i: number, v: string) => {
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) => {
        if (j !== formIdx) return f;
        const next = [...f.givenNames];
        next[i] = v;
        return { ...f, givenNames: next };
      }),
    }));
  };
  const updateSurnameRow = (formIdx: number, i: number, patch: Partial<SurnameFormRow>) => {
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) =>
        j !== formIdx
          ? f
          : { ...f, surnames: f.surnames.map((row, k) => (k === i ? { ...row, ...patch } : row)) },
      ),
    }));
  };

  const addGiven = (formIdx: number) =>
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) =>
        j !== formIdx ? f : { ...f, givenNames: [...f.givenNames, ""] },
      ),
    }));
  const moveGiven = (formIdx: number, i: number, delta: number) => {
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) => {
        if (j !== formIdx) return f;
        const k = i + delta;
        if (k < 0 || k >= f.givenNames.length) return f;
        const next = [...f.givenNames];
        [next[i], next[k]] = [next[k], next[i]];
        return { ...f, givenNames: next };
      }),
    }));
  };
  const removeGiven = (formIdx: number, i: number) =>
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) => {
        if (j !== formIdx) return f;
        return {
          ...f,
          givenNames:
            f.givenNames.length > 1 ? f.givenNames.filter((_, k) => k !== i) : f.givenNames,
        };
      }),
    }));
  const addSurname = (formIdx: number) =>
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) =>
        j !== formIdx ? f : { ...f, surnames: [...f.surnames, { text: "", pieceType: "" }] },
      ),
    }));
  const removeSurname = (formIdx: number, i: number) =>
    setSeed((s) => ({
      ...s,
      nameForms: s.nameForms.map((f, j) => {
        if (j !== formIdx) return f;
        return {
          ...f,
          surnames:
            f.surnames.length > 1 ? f.surnames.filter((_, k) => k !== i) : f.surnames,
        };
      }),
    }));

  const addSpouseRow = useCallback(
    (familyId: string, extra?: Partial<Omit<SpouseFamilyFormRow, "familyId">>) => {
      setSeed((s) => {
        const fid = familyId.trim();
        if (fid && s.familiesAsSpouse.some((r) => r.familyId.trim() === fid)) return s;
        return { ...s, familiesAsSpouse: [...s.familiesAsSpouse, { familyId, ...extra }] };
      });
    },
    [],
  );

  const addSpouseNewFamilyExisting = useCallback((partnerId: string, partnerDisplay: string) => {
    setSeed((s) => {
      const pid = partnerId.trim();
      if (!pid) return s;
      if (s.familiesAsSpouse.some((r) => r.newFamilyExistingPartnerId === pid)) return s;
      return {
        ...s,
        familiesAsSpouse: [
          ...s.familiesAsSpouse,
          {
            familyId: "",
            newFamilyExistingPartnerId: pid,
            newFamilyPartnerDisplay: partnerDisplay.trim() || pid,
          },
        ],
      };
    });
  }, []);

  const addSpouseNewFamilyNewPersonRow = useCallback(() => {
    setSeed((s) => ({
      ...s,
      familiesAsSpouse: [
        ...s.familiesAsSpouse,
        { familyId: "", newFamilyNewPartner: { givenNames: "", surname: "" } },
      ],
    }));
  }, []);

  const excludedSpousePartnerIndividualIds = useMemo(() => {
    const ids = new Set<string>();
    if (mode === "edit" && individualId) ids.add(individualId);
    for (const r of seed.familiesAsSpouse) {
      const pid = r.newFamilyExistingPartnerId?.trim();
      if (pid) ids.add(pid);
      if (r.husbandId) ids.add(r.husbandId);
      if (r.wifeId) ids.add(r.wifeId);
    }
    return ids;
  }, [mode, individualId, seed.familiesAsSpouse]);

  const updateSpouseRow = (i: number, patch: Partial<SpouseFamilyFormRow>) => {
    setSeed((s) => ({
      ...s,
      familiesAsSpouse: s.familiesAsSpouse.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        if ("familyId" in patch && patch.familyId !== undefined && patch.familyId !== r.familyId) {
          delete next.husbandDisplay;
          delete next.wifeDisplay;
          delete next.husbandSex;
          delete next.wifeSex;
          delete next.husbandId;
          delete next.wifeId;
          delete next.childrenInFamily;
          delete next.newFamilyExistingPartnerId;
          delete next.newFamilyPartnerDisplay;
          delete next.newFamilyNewPartner;
          delete next.pendingSpouseFamilyChildren;
        }
        return next;
      }),
    }));
  };
  const removeSpouseRow = (i: number) => {
    setSpouseAddChildExistingSearch(null);
    setSeed((seedState) => ({
      ...seedState,
      familiesAsSpouse: seedState.familiesAsSpouse.filter((_, j) => j !== i),
    }));
  };

  const excludedChildSpouseFamilyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of seed.familiesAsChild) {
      const id = r.familyId.trim();
      if (id) ids.add(id);
    }
    for (const r of seed.familiesAsSpouse) {
      const id = r.familyId.trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [seed.familiesAsChild, seed.familiesAsSpouse]);

  const addChildRow = useCallback(
    (familyId: string, parentLabels?: ChildFamilyParentPickLabels, childrenInFamily?: ChildInFamilySummary[]) => {
      setSeed((s) => {
        const fid = familyId.trim();
        if (fid && s.familiesAsChild.some((r) => r.familyId.trim() === fid)) return s;
        const row: ChildFamilyFormRow = {
          familyId,
          relationshipType: "biological",
          pedigree: "",
          birthOrder: "",
          ...(parentLabels
            ? {
                parentHusbandDisplay: parentLabels.husband,
                parentWifeDisplay: parentLabels.wife,
                ...(parentLabels.husbandSex ? { parentHusbandSex: parentLabels.husbandSex } : {}),
                ...(parentLabels.wifeSex ? { parentWifeSex: parentLabels.wifeSex } : {}),
                ...(parentLabels.husbandId ? { parentHusbandId: parentLabels.husbandId } : {}),
                ...(parentLabels.wifeId ? { parentWifeId: parentLabels.wifeId } : {}),
              }
            : {}),
        };
        if (childrenInFamily !== undefined) {
          row.childrenInFamily = childrenInFamily;
        }
        return {
          ...s,
          familiesAsChild: [...s.familiesAsChild, row],
        };
      });
    },
    [],
  );

  const addChildNewParentsDraftRow = useCallback(() => {
    setSeed((s) => ({
      ...s,
      familiesAsChild: [
        ...s.familiesAsChild,
        {
          familyId: "",
          relationshipType: "biological",
          pedigree: "",
          birthOrder: "",
          pendingNewParents: {
            parent1: { givenNames: "", surname: "", sex: "", relationshipType: "biological" },
            parent2: { givenNames: "", surname: "", sex: "", relationshipType: "biological" },
          },
        },
      ],
    }));
  }, []);

  const updateChildRow = (i: number, patch: Partial<ChildFamilyFormRow>) => {
    setSeed((s) => ({
      ...s,
      familiesAsChild: s.familiesAsChild.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        if ("familyId" in patch && patch.familyId !== undefined && patch.familyId !== r.familyId) {
          delete next.parentHusbandDisplay;
          delete next.parentWifeDisplay;
          delete next.parentHusbandSex;
          delete next.parentWifeSex;
          delete next.parentHusbandId;
          delete next.parentWifeId;
          delete next.childrenInFamily;
          delete next.pendingNewParents;
        }
        return next;
      }),
    }));
  };
  const removeChildRow = (i: number) =>
    setSeed((s) => ({ ...s, familiesAsChild: s.familiesAsChild.filter((_, j) => j !== i) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasName = seed.nameForms.some(
      (nf) => nf.givenNames.some((g) => g.trim()) || nf.surnames.some((r) => r.text.trim()),
    );
    if (!hasName) return;

    for (const r of seed.familiesAsSpouse) {
      if (!r.newFamilyNewPartner) continue;
      const g = r.newFamilyNewPartner.givenNames.trim();
      const sur = r.newFamilyNewPartner.surname.trim();
      const tokens = g.split(/\s+/).filter(Boolean);
      if (!g && !sur) continue;
      if (tokens.length === 0 || !sur) {
        toast.error('New family with a new person: enter given names and a last name, or clear the row.');
        return;
      }
    }

    const okParentSex = (s: string) => {
      const u = s.trim().toUpperCase();
      return u === "M" || u === "F" || u === "U" || u === "X";
    };
    for (const r of seed.familiesAsChild) {
      if (!r.pendingNewParents) continue;
      const d = r.pendingNewParents;
      const g1 = d.parent1.givenNames.trim();
      const g2 = d.parent2.givenNames.trim();
      const s1 = d.parent1.surname.trim();
      const s2 = d.parent2.surname.trim();
      const any =
        g1 || s1 || d.parent1.sex.trim() || g2 || s2 || d.parent2.sex.trim();
      if (!any) continue;
      const t1 = g1.split(/\s+/).filter(Boolean);
      const t2 = g2.split(/\s+/).filter(Boolean);
      if (t1.length === 0 || !s1 || !okParentSex(d.parent1.sex)) {
        toast.error(
          "Add parents — create new people: complete parent 1 (given names, last name, and sex), or remove the row.",
        );
        return;
      }
      if (t2.length === 0 || !s2 || !okParentSex(d.parent2.sex)) {
        toast.error(
          "Add parents — create new people: complete parent 2 (given names, last name, and sex), or remove the row.",
        );
        return;
      }
    }

    for (const r of seed.familiesAsSpouse) {
      for (const p of r.pendingSpouseFamilyChildren ?? []) {
        if (p.kind !== "new") continue;
        const tokens = p.givenNames.trim().split(/\s+/).filter(Boolean);
        const sur = p.surname.trim();
        const sx = p.sex.trim();
        const isEmpty = tokens.length === 0 && !sur && !sx;
        if (isEmpty) {
          toast.error(
            'Remove empty "add child — new person" rows or fill in given names, last name, and sex.',
          );
          return;
        }
        if (tokens.length === 0 || !sur || !okParentSex(sx)) {
          toast.error(
            "Add child — new person: complete given names, last name, and sex for each new child row, or remove it.",
          );
          return;
        }
      }
    }

    const body = buildEditorSubmitBody(seed);

    try {
      if (mode === "create") {
        const res = (await createIndividual.mutateAsync(body)) as { individual?: { id: string; xref: string } };
        const newId = res?.individual?.id;
        const xref = res?.individual?.xref ?? "";
        if (linkUserId && xref) {
          try {
            await postJson(`/api/admin/users/${linkUserId}/links`, { individualXref: xref });
          } catch {
            // Link failure does not roll back individual; surface after navigation is confusing — use alert
            window.alert(
              "The person was created, but linking the user account failed. You can link from the user admin screen.",
            );
          }
        }
        if (newId) router.push(`/admin/individuals/${newId}`);
        else router.push("/admin/individuals");
        return;
      }

      await updateIndividual.mutateAsync({ id: individualId, ...body });
      router.push(`/admin/individuals/${individualId}`);
    } catch {
      /* mutation sets error */
    }
  };

  const livingStatus = useMemo(() => {
    if (seed.livingMode === "living") return { text: "Living" as const, deceased: false };
    if (seed.livingMode === "deceased") return { text: "Deceased" as const, deceased: true };
    if (keyFactToApiValue(seed.death) != null) return { text: "Deceased" as const, deceased: true };
    const by = parseYm(seed.birth.y);
    if (by == null) return { text: "Living" as const, deceased: false };
    const now = new Date();
    const ry = now.getUTCFullYear();
    const age = ry - by;
    if (age >= 120) return { text: "Deceased" as const, deceased: true };
    return { text: "Living" as const, deceased: false };
  }, [seed.birth.y, seed.death, seed.livingMode]);

  const spouseSlotHelp = useMemo(() => {
    const s = seed.sex.trim().toUpperCase();
    if (s === "M")
      return `With sex set to Male, this person is stored in the ${FAMILY_PARTNER_1_LABEL} (GEDCOM HUSB) column for each family below when the API assigns that slot from M/F.`;
    if (s === "F")
      return `With sex set to Female, this person is stored in the ${FAMILY_PARTNER_2_LABEL} (GEDCOM WIFE) column for each family below when the API assigns that slot from M/F.`;
    return null;
  }, [seed.sex]);

  const hasPendingNewSpouseFamily = seed.familiesAsSpouse.some(
    (r) =>
      Boolean(r.newFamilyExistingPartnerId?.trim()) ||
      Boolean(
        r.newFamilyNewPartner &&
          (r.newFamilyNewPartner.givenNames.trim() || r.newFamilyNewPartner.surname.trim()),
      ),
  );
  const hasPendingSpouseFamilyChildAdds = useMemo(
    () => seed.familiesAsSpouse.some((r) => (r.pendingSpouseFamilyChildren?.length ?? 0) > 0),
    [seed.familiesAsSpouse],
  );
  const hasPendingNewParentsChild = seed.familiesAsChild.some(
    (r) =>
      !!r.pendingNewParents &&
      (r.pendingNewParents.parent1.givenNames.trim() ||
        r.pendingNewParents.parent1.surname.trim() ||
        r.pendingNewParents.parent1.sex.trim() ||
        r.pendingNewParents.parent2.givenNames.trim() ||
        r.pendingNewParents.parent2.surname.trim() ||
        r.pendingNewParents.parent2.sex.trim()),
  );
  const spouseFamiliesNeedSex =
    (seed.familiesAsSpouse.some((r) => r.familyId.trim()) || hasPendingNewSpouseFamily) &&
    seed.sex.trim().toUpperCase() !== "M" &&
    seed.sex.trim().toUpperCase() !== "F";

  const onRemoveUserLink = useCallback(
    async (userId: string, linkId: string, label: string) => {
      if (!window.confirm(`Remove the link between this person and “${label}”?`)) return;
      try {
        await deleteUserLink.mutateAsync({ userId, linkId });
        toast.success("User unlinked from this individual.");
      } catch (e) {
        const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to remove link";
        toast.error(msg);
      }
    },
    [deleteUserLink],
  );

  const onAddUserLinkForEdit = useCallback(async () => {
    const xref = seed.xref.trim();
    if (!linkUserId) {
      toast.error("Search and select a user to link.");
      return;
    }
    if (!xref) {
      toast.error("This person needs an XREF before linking (save the record if it is missing).");
      return;
    }
    try {
      await createUserLink.mutateAsync({ userId: linkUserId, individualXref: xref });
      toast.success(`Linked ${linkUserLabel || linkUserId} to this person.`);
      setLinkUserId(null);
      setLinkUserLabel("");
      setUserSearch("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create link";
      toast.error(msg);
    }
  }, [createUserLink, linkUserId, linkUserLabel, seed.xref]);

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8">
      {errMsg ? (
        <p className="text-sm text-destructive" role="alert">
          {errMsg}
          {errStatus ? ` (HTTP ${errStatus})` : ""}
        </p>
      ) : null}

      <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
        <div
          className="flex gap-0 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Form sections"
        >
          {EDITOR_TAB_ITEMS.map((t) => {
            const Icon = t.icon;
            const selected = editorTab === t.id;
            const tabLabel =
              t.id === "spouse"
                ? `Families as Spouse (${seed.familiesAsSpouse.length})`
                : t.id === "child"
                  ? `Families as Child (${seed.familiesAsChild.length})`
                  : t.id === "notes"
                    ? `Notes (${individualNotes.length})`
                    : t.id === "media"
                      ? `Media (${individualMedia.length})`
                      : t.id === "sources"
                        ? `Sources (${individualSources.length})`
                        : t.label;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`individual-editor-panel-${t.id}`}
                id={`individual-editor-tab-${t.id}`}
                title={tabLabel}
                className={cn(
                  "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
                )}
                onClick={() => setEditorTab(t.id)}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="sr-only md:hidden">{tabLabel}</span>
                <span className="hidden md:inline">{tabLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="individual-editor-panel-identity"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-identity"
        hidden={editorTab !== "identity"}
        className="space-y-8 pt-2"
      >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Identity</CardTitle>
          {mode === "create" ? (
            <p className="text-sm text-muted-foreground">
              A new XREF is assigned automatically when you save. Sex uses GEDCOM codes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              XREF is system-assigned (shown for reference only). Sex and living follow GEDCOM rules.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "edit" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>XREF</Label>
                <p className="font-mono text-sm">{seed.xref || "—"}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="indi-sex">Sex</Label>
              <select
                id="indi-sex"
                className={selectClassName}
                value={seed.sex}
                onChange={(e) => setSeed((s) => ({ ...s, sex: e.target.value }))}
              >
                <option value="">Unknown</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Unknown (U)</option>
                <option value="X">Other (X)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

        {mode === "edit" ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Linked accounts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Website users linked to this person in the admin tree (by GEDCOM xref). Requires{" "}
                <code className="text-xs">ADMIN_TREE_ID</code>.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {userLinksLoading ? (
                <p className="text-sm text-muted-foreground">Loading linked accounts…</p>
              ) : userLinksErrMsg ? (
                <p className="text-sm text-destructive">{userLinksErrMsg}</p>
              ) : userLinks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No user accounts linked yet.</p>
              ) : (
                <ul className="space-y-3">
                  {userLinks.map((row) => {
                    const u = row.user;
                    const display =
                      stripSlashesFromName(u.name) || u.username || u.email || u.id;
                    return (
                      <li
                        key={row.linkId}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/users/${u.id}`} className="link link-primary font-medium">
                              {display}
                            </Link>
                            {row.verified ? (
                              <span className="badge badge-outline badge-primary badge-sm font-normal">Verified</span>
                            ) : null}
                            {!u.isActive ? (
                              <span className="badge badge-ghost badge-sm font-normal">Inactive</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <span className="font-mono">{u.username}</span>
                            {u.email ? ` · ${u.email}` : null}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 text-destructive"
                          disabled={userLinkBusy}
                          onClick={() => void onRemoveUserLink(u.id, row.linkId, display)}
                        >
                          Remove link
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="space-y-3 border-t border-base-content/10 pt-4">
                <h3 className="text-sm font-semibold text-base-content">Link another user</h3>
                <p className="text-xs text-muted-foreground">
                  Uses this person&apos;s current XREF ({seed.xref.trim() || "—"}). Save identity changes first if the
                  xref was updated elsewhere.
                </p>
                {linkUserId ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span>Selected: {linkUserLabel || linkUserId}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={userLinkBusy}
                      onClick={() => {
                        setLinkUserId(null);
                        setLinkUserLabel("");
                      }}
                    >
                      Clear
                    </Button>
                    <Button type="button" size="sm" disabled={userLinkBusy} onClick={() => void onAddUserLinkForEdit()}>
                      {userLinkBusy ? "Linking…" : "Add link"}
                    </Button>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label>Search users</Label>
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Username, email, or display name…"
                    disabled={userLinkBusy}
                  />
                  <UserSearchHits
                    query={userSearch}
                    excludeUserIds={linkedUserIds}
                    onPick={(id, label) => {
                      setLinkUserId(id);
                      setLinkUserLabel(label);
                      setUserSearch("");
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {mode === "create" ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Link user (optional)</CardTitle>
              <p className="text-sm text-muted-foreground">
                After save, creates a UserIndividualLink for the admin tree using the new xref. Requires{" "}
                <code className="text-xs">ADMIN_TREE_ID</code>.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {linkUserId ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Selected user: {linkUserLabel || linkUserId}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLinkUserId(null);
                      setLinkUserLabel("");
                    }}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Search users</Label>
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Username, email, or display name…"
                />
                <UserSearchHits
                  query={userSearch}
                  onPick={(id, label) => {
                    setLinkUserId(id);
                    setLinkUserLabel(label);
                    setUserSearch("");
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div
        id="individual-editor-panel-names"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-names"
        hidden={editorTab !== "names"}
        className="space-y-8 pt-2"
      >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Name(s)</CardTitle>
          <p className="text-sm text-muted-foreground">
            One primary name for labels and export; add more rows as aliases if needed.
          </p>
          <div className="mt-3 space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Effective label (primary)</p>
            <p className="font-medium text-base-content">{displayPreview || "—"}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <CollapsibleFormSection title="Info">
            <p className="text-sm text-muted-foreground">
              Mark exactly one name as <span className="font-medium text-base-content">Primary</span> (used for the
              person&apos;s main label and GEDCOM birth-name slot). Add additional names as{" "}
              <span className="font-medium text-base-content">Alias</span> (also known as). Given-name order matters for
              display and export—use the arrows in each block to reorder. Each surname can have a type (maiden, married,
              etc.).
            </p>
          </CollapsibleFormSection>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addNameForm}>
              Add name
            </Button>
          </div>
          {seed.nameForms.map((nf, formIdx) => (
            <div
              key={nf.clientId}
              className="space-y-4 rounded-lg border border-border p-4"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`name-type-${nf.clientId}`}>Name type</Label>
                  <select
                    id={`name-type-${nf.clientId}`}
                    className={selectClassName}
                    value={nf.role}
                    onChange={(e) => setNameFormRole(formIdx, e.target.value as NameFormRole)}
                  >
                    <option value="primary">Primary</option>
                    <option
                      value="alias"
                      disabled={nf.role === "primary" && seed.nameForms.length === 1}
                    >
                      Alias
                    </option>
                  </select>
                </div>
                {seed.nameForms.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => removeNameForm(formIdx)}
                  >
                    Remove name
                  </Button>
                ) : null}
              </div>
              <CollapsibleFormSection title="Given names">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => addGiven(formIdx)}>
                    Add given
                  </Button>
                </div>
                {nf.givenNames.map((g, i) => (
                  <div
                    key={`g-${nf.clientId}-${i}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          disabled={i === 0}
                          title="Move earlier"
                          aria-label={`Move given name ${i + 1} earlier`}
                          onClick={() => moveGiven(formIdx, i, -1)}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="h-8 w-8"
                          disabled={i === nf.givenNames.length - 1}
                          title="Move later"
                          aria-label={`Move given name ${i + 1} later`}
                          onClick={() => moveGiven(formIdx, i, 1)}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </div>
                      <Input
                        className="h-10 min-h-10 min-w-0 flex-1"
                        value={g}
                        onChange={(e) => setGiven(formIdx, i, e.target.value)}
                        placeholder={`Given ${i + 1}`}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 self-end sm:self-center"
                      onClick={() => removeGiven(formIdx, i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </CollapsibleFormSection>
              <CollapsibleFormSection title="Surnames">
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => addSurname(formIdx)}>
                    Add surname
                  </Button>
                </div>
                {nf.surnames.map((s, i) => (
                  <div
                    key={`s-${nf.clientId}-${i}`}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <Input
                      className="h-10 min-h-10 min-w-0 flex-1"
                      value={s.text}
                      onChange={(e) => updateSurnameRow(formIdx, i, { text: e.target.value })}
                      placeholder={`Surname ${i + 1}`}
                    />
                    <select
                      className={cn(selectClassName, "h-10 min-h-10 w-full shrink-0 sm:w-52")}
                      value={s.pieceType}
                      onChange={(e) => updateSurnameRow(formIdx, i, { pieceType: e.target.value })}
                      aria-label={`Surname ${i + 1} type`}
                    >
                      {SURNAME_PIECE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value || "__default"} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => removeSurname(formIdx, i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </CollapsibleFormSection>
            </div>
          ))}
        </CardContent>
      </Card>
      </div>

      <div
        id="individual-editor-panel-events"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-events"
        hidden={editorTab !== "events"}
        className="space-y-8 pt-2"
      >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Birth & Death</CardTitle>
          <p className="text-sm text-muted-foreground">
            One BIRT and one DEAT per person. Clear all date and place fields to remove the fact. Use the{" "}
            <span className="font-medium text-base-content">Birth</span> and{" "}
            <span className="font-medium text-base-content">Death</span> headers to show or hide each editor.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <KeyFactSection title="Birth" fact={seed.birth} onChange={(birth) => setSeed((s) => ({ ...s, birth }))} />
          <KeyFactSection title="Death" fact={seed.death} onChange={(death) => setSeed((s) => ({ ...s, death }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Living status</CardTitle>
          <p
            className={cn(
              "flex items-center gap-2 text-lg font-semibold",
              livingStatus.deceased
                ? "text-destructive"
                : "text-green-600 dark:text-green-500",
            )}
          >
            {livingStatus.deceased ? (
              <IconSkull size={24} stroke={1.5} className="shrink-0" aria-hidden />
            ) : (
              <IconHeartbeat size={24} stroke={1.5} className="shrink-0" aria-hidden />
            )}
            {livingStatus.text}
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="living-mode">Mode</Label>
            <select
              id="living-mode"
              className={selectClassName}
              value={seed.livingMode}
              onChange={(e) => setSeed((s) => ({ ...s, livingMode: e.target.value as LivingMode }))}
            >
              <option value="auto">Automatic (death + 120-year rule)</option>
              <option value="living">Force living</option>
              <option value="deceased">Force deceased</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Other events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Full timeline for this person (self, family, and relative-derived events). Birth and death above are the
              canonical BIRT/DEAT editors; open any row below in Events admin to change other types or add more.
            </p>
          </div>
          {individualId ? (
            <Link
              href={`/admin/events/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add event
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {!individualId ? (
            <p className="text-sm text-muted-foreground">
              Save this person first to load events and attach new ones to their record.
            </p>
          ) : eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : eventsErr ? (
            <p className="text-sm text-destructive">{eventsErr}</p>
          ) : timelineEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other events yet.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedTimelineEvents.map((e, i) => (
                  <div
                    key={
                      e.eventId ??
                      `ev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.familyId ?? ""}`
                    }
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                  >
                    <p className="font-mono text-xs text-muted-foreground">
                      {e.eventType}
                      {e.customType ? ` · ${e.customType}` : ""}
                    </p>
                    <div className="mt-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2">
                          <GedcomEventTypeIcon eventType={e.eventType} />
                          <span className="font-semibold text-base-content">
                            {labelGedcomEventType(e.eventType)}
                          </span>
                        </span>
                        <span className="badge badge-ghost badge-sm inline-flex items-center px-2.5 py-1 font-normal">
                          {EVENT_SOURCE_LABELS[e.source] ?? e.source}
                        </span>
                      </div>
                      <p className="text-sm">{formatEventDate(e)}</p>
                      <p className="text-sm text-muted-foreground">{e.placeName || e.placeOriginal || "—"}</p>
                      {e.value ? <p className="text-xs">{e.value}</p> : null}
                      <IndividualAdminEventContext e={e} />
                      {e.eventId ? (
                        <p className="pt-1">
                          <Link
                            href={`/admin/events/${e.eventId}`}
                            className="link link-primary text-xs font-medium"
                          >
                            Open in Events admin
                          </Link>
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {timelineEvents.length > INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE ? (
                <div className="flex justify-end pt-1">
                  <DataViewerPagination
                    pagination={eventPagination}
                    pageCount={eventPageCount}
                    onPaginationChange={onEventPaginationChange}
                  />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
      </div>

      <div
        id="individual-editor-panel-spouse"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-spouse"
        hidden={editorTab !== "spouse"}
        className="space-y-8 pt-2"
      >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Families as spouse</CardTitle>
          <p className="text-sm text-muted-foreground">Link partner families by id or search.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CollapsibleFormSection title="Info">
            <p className="text-sm text-muted-foreground">
              {FAMILY_PARTNER_SLOT_SUBTITLE} Slot assignment when linking parents uses the rules below. Set sex in
              Identity before saving spouse links (current API requires M or F for automatic placement). Empty list
              removes spouse links.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
            {spouseSlotHelp ? <p className="text-xs text-muted-foreground">{spouseSlotHelp}</p> : null}
          </CollapsibleFormSection>
          {spouseFamiliesNeedSex ? (
            <p className="text-sm text-destructive" role="alert">
              Set sex to Male or Female to save spouse family links; unknown/other sex cannot be assigned to a husband
              or wife slot automatically.
            </p>
          ) : null}
          {seed.familiesAsSpouse.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-base-content">Existing families</h3>
              <ul className="space-y-4">
                {seed.familiesAsSpouse.map((row, i) => {
                  if (row.newFamilyExistingPartnerId) {
                    return (
                      <li
                        key={`spouse-newfam-ex-${i}-${row.newFamilyExistingPartnerId}`}
                        className="space-y-3 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <p className="text-sm font-semibold text-base-content">New family (created when you save)</p>
                        <p className="text-sm text-base-content/90">
                          Partner:{" "}
                          <span className="font-medium">
                            {row.newFamilyPartnerDisplay || row.newFamilyExistingPartnerId}
                          </span>
                        </p>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }
                  if (row.newFamilyNewPartner) {
                    const np = row.newFamilyNewPartner;
                    return (
                      <li
                        key={`spouse-newfam-new-${i}`}
                        className="space-y-3 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <p className="text-sm font-semibold text-base-content">
                          New family with a new person (created when you save)
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs">Given names (split on spaces into name parts)</Label>
                            <Input
                              value={np.givenNames}
                              onChange={(e) =>
                                updateSpouseRow(i, {
                                  newFamilyNewPartner: { ...np, givenNames: e.target.value },
                                })
                              }
                              placeholder="e.g. Maria Jose"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-xs">Last name</Label>
                            <Input
                              value={np.surname}
                              onChange={(e) =>
                                updateSpouseRow(i, {
                                  newFamilyNewPartner: { ...np, surname: e.target.value },
                                })
                              }
                              placeholder="e.g. Gonsalves"
                            />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }

                  const husbandLabel = row.husbandDisplay?.trim() || "—";
                  const wifeLabel = row.wifeDisplay?.trim() || "—";
                  const husbandId = row.husbandId;
                  const wifeId = row.wifeId;
                  const husbandLinked =
                    !!husbandId &&
                    !(mode === "edit" && husbandId === individualId) &&
                    husbandLabel !== "—";
                  const wifeLinked =
                    !!wifeId && !(mode === "edit" && wifeId === individualId) && wifeLabel !== "—";
                  const isHusbandSelf =
                    mode === "edit" && !!individualId && !!husbandId && husbandId === individualId;
                  const isWifeSelf = mode === "edit" && !!individualId && !!wifeId && wifeId === individualId;
                  const otherSpouseOnly = isHusbandSelf || isWifeSelf;
                  const otherSex = isHusbandSelf ? row.wifeSex : isWifeSelf ? row.husbandSex : undefined;
                  const otherId = isHusbandSelf ? wifeId : isWifeSelf ? husbandId : undefined;
                  const otherLabel = isHusbandSelf ? wifeLabel : isWifeSelf ? husbandLabel : "";
                  const showOtherLink =
                    otherSpouseOnly && !!otherId && !(mode === "edit" && otherId === individualId);
                  return (
                    <li key={`spouse-${i}-${row.familyId}`} className="space-y-3 rounded-lg border border-base-content/10 p-3">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-base-content">
                          {otherSpouseOnly ? "Partner" : "Spouses"}
                        </p>
                        {otherSpouseOnly ? (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                            <span className="inline-flex items-center gap-1.5">
                              <ParentSexIcon sex={otherSex} />
                              {showOtherLink ? (
                                <Link href={`/admin/individuals/${otherId}`} className="link link-primary font-medium">
                                  {otherLabel !== "—" ? otherLabel : "Partner"}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">No other spouse linked</span>
                              )}
                            </span>
                          </p>
                        ) : (
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {FAMILY_PARTNER_1_LABEL}
                              </span>
                              <ParentSexIcon sex={row.husbandSex} />
                              {husbandLinked && husbandId ? (
                                <Link href={`/admin/individuals/${husbandId}`} className="link link-primary font-medium">
                                  {husbandLabel}
                                </Link>
                              ) : (
                                <span>{husbandLabel}</span>
                              )}
                            </span>
                            <span className="text-muted-foreground" aria-hidden>
                              ·
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {FAMILY_PARTNER_2_LABEL}
                              </span>
                              <ParentSexIcon sex={row.wifeSex} />
                              {wifeLinked && wifeId ? (
                                <Link href={`/admin/individuals/${wifeId}`} className="link link-primary font-medium">
                                  {wifeLabel}
                                </Link>
                              ) : (
                                <span>{wifeLabel}</span>
                              )}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-base-content">Children in family</p>
                        {row.childrenInFamily === undefined ? (
                          <p className="text-sm text-muted-foreground">
                            Children list not loaded. Add this family via search below, or open the family page.
                          </p>
                        ) : row.childrenInFamily.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No children linked in this family.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {row.childrenInFamily.map((ch) => {
                              const isSelf = mode === "edit" && ch.individualId === individualId;
                              return (
                                <li key={ch.individualId}>
                                  <span className="inline-flex items-center gap-1.5 text-sm text-base-content/90">
                                    <ParentSexIcon sex={ch.sex} />
                                    {isSelf ? (
                                      <Star
                                        className="size-4 shrink-0 fill-amber-400 text-amber-500"
                                        aria-label="This person"
                                      />
                                    ) : null}
                                    {isSelf ? (
                                      <span className="font-medium text-base-content">{ch.displayName}</span>
                                    ) : (
                                      <Link
                                        href={`/admin/individuals/${ch.individualId}`}
                                        className="link link-primary font-medium"
                                      >
                                        {ch.displayName}
                                      </Link>
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {row.familyId.trim() ? (
                        <div className="space-y-3 rounded-md border border-base-content/10 bg-base-100/40 p-3">
                          <p className="text-xs font-medium text-base-content">
                            Add children (applied when you save this person)
                          </p>
                          {(row.pendingSpouseFamilyChildren?.length ?? 0) > 0 ? (
                            <ul className="space-y-3">
                              {row.pendingSpouseFamilyChildren!.map((pch) => (
                                <li
                                  key={pch.clientId}
                                  className="space-y-2 rounded border border-dashed border-base-content/15 bg-base-200/20 p-2"
                                >
                                  {pch.kind === "existing" ? (
                                    <>
                                      <p className="text-sm font-medium text-base-content">
                                        {pch.displayLabel || pch.childIndividualId}
                                      </p>
                                      <p className="font-mono text-xs text-muted-foreground">
                                        {pch.childIndividualId.slice(0, 8)}…
                                      </p>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Relationship to parents</Label>
                                          <select
                                            className={selectClassName}
                                            value={pch.relationshipType}
                                            onChange={(e) =>
                                              updateSpouseRow(i, {
                                                pendingSpouseFamilyChildren: (
                                                  row.pendingSpouseFamilyChildren ?? []
                                                ).map((x) =>
                                                  x.clientId === pch.clientId && x.kind === "existing"
                                                    ? { ...x, relationshipType: e.target.value }
                                                    : x,
                                                ),
                                              })
                                            }
                                          >
                                            {RELATIONSHIP_OPTIONS.map((o) => (
                                              <option key={o.value} value={o.value}>
                                                {o.label}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Birth order (optional)</Label>
                                          <Input
                                            value={pch.birthOrder}
                                            onChange={(e) =>
                                              updateSpouseRow(i, {
                                                pendingSpouseFamilyChildren: (
                                                  row.pendingSpouseFamilyChildren ?? []
                                                ).map((x) =>
                                                  x.clientId === pch.clientId && x.kind === "existing"
                                                    ? { ...x, birthOrder: e.target.value }
                                                    : x,
                                                ),
                                              })
                                            }
                                            inputMode="numeric"
                                            placeholder="Optional"
                                          />
                                        </div>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="grid gap-2 sm:grid-cols-2">
                                      <div className="space-y-1 sm:col-span-2">
                                        <Label className="text-xs">Given names</Label>
                                        <Input
                                          value={pch.givenNames}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, givenNames: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                          placeholder="e.g. Maria Jose"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Last name</Label>
                                        <Input
                                          value={pch.surname}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, surname: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Sex</Label>
                                        <select
                                          className={selectClassName}
                                          value={pch.sex}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, sex: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                        >
                                          {NEW_PARENT_SEX_OPTIONS.map((o) => (
                                            <option key={o.value === "" ? "__unset" : o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Relationship to parents</Label>
                                        <select
                                          className={selectClassName}
                                          value={pch.relationshipType}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, relationshipType: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                        >
                                          {RELATIONSHIP_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Birth order (optional)</Label>
                                        <Input
                                          value={pch.birthOrder}
                                          onChange={(e) =>
                                            updateSpouseRow(i, {
                                              pendingSpouseFamilyChildren: (
                                                row.pendingSpouseFamilyChildren ?? []
                                              ).map((x) =>
                                                x.clientId === pch.clientId && x.kind === "new"
                                                  ? { ...x, birthOrder: e.target.value }
                                                  : x,
                                              ),
                                            })
                                          }
                                          inputMode="numeric"
                                          placeholder="Optional"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      updateSpouseRow(i, {
                                        pendingSpouseFamilyChildren: (
                                          row.pendingSpouseFamilyChildren ?? []
                                        ).filter((x) => x.clientId !== pch.clientId),
                                      })
                                    }
                                  >
                                    Remove from list
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSpouseAddChildExistingSearch((cur) =>
                                  cur?.rowIndex === i ? null : { rowIndex: i, partnerGiven: "", partnerLast: "" },
                                )
                              }
                            >
                              Add child — existing person
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                updateSpouseRow(i, {
                                  pendingSpouseFamilyChildren: [
                                    ...(row.pendingSpouseFamilyChildren ?? []),
                                    {
                                      clientId:
                                        typeof crypto !== "undefined" && "randomUUID" in crypto
                                          ? crypto.randomUUID()
                                          : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                                      kind: "new" as const,
                                      givenNames: "",
                                      surname: "",
                                      sex: "",
                                      relationshipType: "biological",
                                      birthOrder: "",
                                    },
                                  ],
                                })
                              }
                            >
                              Add child — new person
                            </Button>
                          </div>
                          {spouseAddChildExistingSearch?.rowIndex === i ? (
                            <div className="space-y-2 rounded-md border border-base-content/10 bg-base-content/[0.02] p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <Label className="text-sm font-medium text-base-content">
                                  Search for an existing person to add as a child
                                </Label>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSpouseAddChildExistingSearch(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                              <NewSpousePartnerIndividualSearch
                                inputIdPrefix={`spouse-add-child-${i}`}
                                partnerGiven={spouseAddChildExistingSearch.partnerGiven}
                                partnerLast={spouseAddChildExistingSearch.partnerLast}
                                setPartnerGiven={(v) =>
                                  setSpouseAddChildExistingSearch((s) =>
                                    s && s.rowIndex === i
                                      ? {
                                          ...s,
                                          partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                                        }
                                      : s,
                                  )
                                }
                                setPartnerLast={(v) =>
                                  setSpouseAddChildExistingSearch((s) =>
                                    s && s.rowIndex === i
                                      ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                                      : s,
                                  )
                                }
                                excludeIndividualIds={spouseFamilyChildSearchExcludes(row, individualId, mode)}
                                onPick={(childId, displayLabel) => {
                                  const cid =
                                    typeof crypto !== "undefined" && "randomUUID" in crypto
                                      ? crypto.randomUUID()
                                      : `sc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                                  updateSpouseRow(i, {
                                    pendingSpouseFamilyChildren: [
                                      ...(row.pendingSpouseFamilyChildren ?? []),
                                      {
                                        clientId: cid,
                                        kind: "existing",
                                        childIndividualId: childId,
                                        displayLabel,
                                        relationshipType: "biological",
                                        birthOrder: "",
                                      },
                                    ],
                                  });
                                  setSpouseAddChildExistingSearch(null);
                                }}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="grid gap-2 sm:grid-cols-1">
                        <div className="space-y-1">
                          <Label className="text-xs">Family id</Label>
                          <Input
                            className="font-mono text-xs"
                            value={row.familyId}
                            onChange={(e) => updateSpouseRow(i, { familyId: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/families/${row.familyId}`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "whitespace-nowrap")}
                        >
                          Open family
                        </Link>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpouseRow(i)}>
                          Remove
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No spouse families yet.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSpouseFamilySearchSlots((s) => [...s, createSpouseFamilySearchSlot()])}
            >
              Add as spouse to an existing family
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSpouseNewFamilyExistingSearchSlots((s) => [...s, createSpouseNewFamilyExistingSearchSlot()])
              }
            >
              New family with existing person
            </Button>
            <Button type="button" variant="outline" onClick={addSpouseNewFamilyNewPersonRow}>
              New family with new person
            </Button>
          </div>

          <div className="space-y-3">
            {spouseFamilySearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">Find a one-spouse family</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpouseFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <SpouseSlotFamilySearch
                  inputIdPrefix={`spouse-fam-${slot.id}`}
                  partnerGiven={slot.partnerGiven}
                  partnerLast={slot.partnerLast}
                  setPartnerGiven={(v) =>
                    setSpouseFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? {
                              ...s,
                              partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                            }
                          : s,
                      ),
                    )
                  }
                  setPartnerLast={(v) =>
                    setSpouseFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                          : s,
                      ),
                    )
                  }
                  excludedFamilyIds={excludedChildSpouseFamilyIds}
                  onPick={async (familyId) => {
                    let extra: Partial<Omit<SpouseFamilyFormRow, "familyId">> | undefined;
                    try {
                      const data = await fetchJson<{ family: Record<string, unknown> }>(
                        `/api/admin/families/${familyId}`,
                      );
                      const built = spouseFamilyRowFromFamilyRecord(familyId, data.family);
                      const { familyId: _fid, ...rest } = built;
                      extra = rest;
                    } catch {
                      /* row is family id only */
                    }
                    addSpouseRow(familyId, extra);
                    setSpouseFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}

            {spouseNewFamilyExistingSearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">
                    New family — search for an existing partner
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSpouseNewFamilyExistingSearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <NewSpousePartnerIndividualSearch
                  inputIdPrefix={`spouse-newfam-ex-${slot.id}`}
                  partnerGiven={slot.partnerGiven}
                  partnerLast={slot.partnerLast}
                  setPartnerGiven={(v) =>
                    setSpouseNewFamilyExistingSearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? {
                              ...s,
                              partnerGiven: typeof v === "function" ? v(s.partnerGiven) : v,
                            }
                          : s,
                      ),
                    )
                  }
                  setPartnerLast={(v) =>
                    setSpouseNewFamilyExistingSearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, partnerLast: typeof v === "function" ? v(s.partnerLast) : v }
                          : s,
                      ),
                    )
                  }
                  excludeIndividualIds={excludedSpousePartnerIndividualIds}
                  onPick={(id, label) => {
                    addSpouseNewFamilyExisting(id, label);
                    setSpouseNewFamilyExistingSearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}
          </div>

          {hasPendingNewSpouseFamily || hasPendingSpouseFamilyChildAdds ? (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-sm font-medium text-base-content">Save spouse-family changes</p>
              <p className="text-sm text-muted-foreground">
                {hasPendingNewSpouseFamily
                  ? "New partners and families are not stored until you save. "
                  : ""}
                {hasPendingSpouseFamilyChildAdds
                  ? "Children you add below are linked when you save. "
                  : ""}
                This uses the same primary save button at the bottom of the page.
              </p>
              <Button type="submit" disabled={pending || spouseFamiliesNeedSex}>
                {pending
                  ? "Saving…"
                  : mode === "create"
                    ? "Save person & spouse updates"
                    : "Save & apply spouse updates"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>

      <div
        id="individual-editor-panel-child"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-child"
        hidden={editorTab !== "child"}
        className="space-y-8 pt-2"
      >
        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Families as child</CardTitle>
          <p className="text-sm text-muted-foreground">Link parental families by id or search.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <CollapsibleFormSection title="Info">
            <p className="text-sm text-muted-foreground">
              Child-of-family links and parent relationships. {FAMILY_PARTNER_SLOT_SUBTITLE} Use birth order when known.
            </p>
          </CollapsibleFormSection>
          {seed.familiesAsChild.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-base-content">Existing families</h3>
              <ul className="space-y-4">
                {seed.familiesAsChild.map((row, i) => {
                  if (row.pendingNewParents) {
                    const d = row.pendingNewParents;
                    return (
                      <li
                        key={`child-draft-parents-${i}`}
                        className="space-y-4 rounded-lg border border-dashed border-base-content/20 bg-base-200/20 p-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-base-content">
                            New parents &amp; family (created when you save)
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Two new individuals and a family are created; you are linked as their child.{" "}
                            {FAMILY_PARTNER_1_LABEL} / {FAMILY_PARTNER_2_LABEL} (HUSB/WIFE) follow the same sex rules
                            as elsewhere (e.g. M with F → M in partner 1, F in partner 2). Given names are split on
                            spaces.
                          </p>
                        </div>
                        {(["parent1", "parent2"] as const).map((pk) => {
                          const p = d[pk];
                          const label = pk === "parent1" ? "Parent 1" : "Parent 2";
                          return (
                            <div
                              key={pk}
                              className="space-y-3 rounded-md border border-base-content/10 bg-base-100/80 p-3"
                            >
                              <p className="text-xs font-medium text-base-content">{label}</p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-2 sm:col-span-2">
                                  <Label className="text-xs">Given names</Label>
                                  <Input
                                    value={p.givenNames}
                                    onChange={(e) =>
                                      updateChildRow(i, {
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, givenNames: e.target.value },
                                        },
                                      })
                                    }
                                    placeholder="e.g. Maria Jose"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Last name</Label>
                                  <Input
                                    value={p.surname}
                                    onChange={(e) =>
                                      updateChildRow(i, {
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, surname: e.target.value },
                                        },
                                      })
                                    }
                                    placeholder="e.g. Gonsalves"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-xs">Sex (for HUSB/WIFE placement)</Label>
                                  <select
                                    className={selectClassName}
                                    value={p.sex}
                                    onChange={(e) =>
                                      updateChildRow(i, {
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, sex: e.target.value },
                                        },
                                      })
                                    }
                                  >
                                    {NEW_PARENT_SEX_OPTIONS.map((o) => (
                                      <option key={o.value === "" ? "__unset" : o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                  <Label className="text-xs">Relationship to this parent</Label>
                                  <select
                                    className={selectClassName}
                                    value={p.relationshipType}
                                    onChange={(e) =>
                                      updateChildRow(i, {
                                        pendingNewParents: {
                                          ...d,
                                          [pk]: { ...p, relationshipType: e.target.value },
                                        },
                                      })
                                    }
                                  >
                                    {RELATIONSHIP_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Pedigree (optional)</Label>
                            <Input
                              value={row.pedigree}
                              onChange={(e) => updateChildRow(i, { pedigree: e.target.value })}
                              placeholder="e.g. birth"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Birth order (optional)</Label>
                            <Input
                              value={row.birthOrder}
                              onChange={(e) => updateChildRow(i, { birthOrder: e.target.value })}
                              inputMode="numeric"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeChildRow(i)}>
                          Remove
                        </Button>
                      </li>
                    );
                  }

                  const husbandLabel = row.parentHusbandDisplay?.trim() || "—";
                  const wifeLabel = row.parentWifeDisplay?.trim() || "—";
                  const husbandId = row.parentHusbandId;
                  const wifeId = row.parentWifeId;
                  const husbandLinked =
                    !!husbandId &&
                    !(mode === "edit" && husbandId === individualId) &&
                    husbandLabel !== "—";
                  const wifeLinked =
                    !!wifeId && !(mode === "edit" && wifeId === individualId) && wifeLabel !== "—";
                  return (
                  <li key={`child-${i}-${row.familyId}`} className="space-y-3 rounded-lg border border-base-content/10 p-3">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-base-content">Parents</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-normal leading-snug text-base-content/90">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {FAMILY_PARTNER_1_LABEL}
                          </span>
                          <ParentSexIcon sex={row.parentHusbandSex} />
                          {husbandLinked && husbandId ? (
                            <Link href={`/admin/individuals/${husbandId}`} className="link link-primary font-medium">
                              {husbandLabel}
                            </Link>
                          ) : (
                            <span>{husbandLabel}</span>
                          )}
                        </span>
                        <span className="text-muted-foreground" aria-hidden>
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {FAMILY_PARTNER_2_LABEL}
                          </span>
                          <ParentSexIcon sex={row.parentWifeSex} />
                          {wifeLinked && wifeId ? (
                            <Link href={`/admin/individuals/${wifeId}`} className="link link-primary font-medium">
                              {wifeLabel}
                            </Link>
                          ) : (
                            <span>{wifeLabel}</span>
                          )}
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-base-content">Children in family</p>
                      {row.childrenInFamily === undefined ? (
                        <p className="text-sm text-muted-foreground">
                          Sibling list not loaded. Add this family via search above, or open the family page to see
                          children.
                        </p>
                      ) : row.childrenInFamily.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No children linked in this family.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {row.childrenInFamily.map((ch) => {
                            const isSelf = mode === "edit" && ch.individualId === individualId;
                            return (
                              <li key={ch.individualId}>
                                <span className="inline-flex items-center gap-1.5 text-sm text-base-content/90">
                                  <ParentSexIcon sex={ch.sex} />
                                  {isSelf ? (
                                    <Star
                                      className="size-4 shrink-0 fill-amber-400 text-amber-500"
                                      aria-label="This person"
                                    />
                                  ) : null}
                                  {isSelf ? (
                                    <span className="font-medium text-base-content">{ch.displayName}</span>
                                  ) : (
                                    <Link
                                      href={`/admin/individuals/${ch.individualId}`}
                                      className="link link-primary font-medium"
                                    >
                                      {ch.displayName}
                                    </Link>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Family id</Label>
                        <Input
                          className="font-mono text-xs"
                          value={row.familyId}
                          onChange={(e) => updateChildRow(i, { familyId: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Relationship to parents</Label>
                        <select
                          className={selectClassName}
                          value={row.relationshipType}
                          onChange={(e) => updateChildRow(i, { relationshipType: e.target.value })}
                        >
                          {RELATIONSHIP_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Pedigree (optional)</Label>
                        <Input
                          value={row.pedigree}
                          onChange={(e) => updateChildRow(i, { pedigree: e.target.value })}
                          placeholder="e.g. birth"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Birth order</Label>
                        <Input
                          value={row.birthOrder}
                          onChange={(e) => updateChildRow(i, { birthOrder: e.target.value })}
                          inputMode="numeric"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/admin/families/${row.familyId}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        Open family
                      </Link>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeChildRow(i)}>
                        Remove
                      </Button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not linked as a child.</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChildFamilySearchSlots((s) => [...s, createChildFamilySearchSlot()])}
            >
              Add as child to an existing family
            </Button>
            <Button type="button" variant="outline" onClick={addChildNewParentsDraftRow}>
              Add parents — create new people
            </Button>
          </div>

          <div className="space-y-3">
            {childFamilySearchSlots.map((slot) => (
              <div
                key={slot.id}
                className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">Search parents&apos; family</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setChildFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id))}
                  >
                    Cancel
                  </Button>
                </div>
                <ChildParentsFamilySearch
                  inputIdPrefix={`child-fam-${slot.id}`}
                  p1Given={slot.p1Given}
                  p1Last={slot.p1Last}
                  p2Given={slot.p2Given}
                  p2Last={slot.p2Last}
                  setP1Given={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, p1Given: typeof v === "function" ? v(s.p1Given) : v }
                          : s,
                      ),
                    )
                  }
                  setP1Last={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id ? { ...s, p1Last: typeof v === "function" ? v(s.p1Last) : v } : s,
                      ),
                    )
                  }
                  setP2Given={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id
                          ? { ...s, p2Given: typeof v === "function" ? v(s.p2Given) : v }
                          : s,
                      ),
                    )
                  }
                  setP2Last={(v) =>
                    setChildFamilySearchSlots((slots) =>
                      slots.map((s) =>
                        s.id === slot.id ? { ...s, p2Last: typeof v === "function" ? v(s.p2Last) : v } : s,
                      ),
                    )
                  }
                  excludedFamilyIds={excludedChildSpouseFamilyIds}
                  onPick={async (familyId, labels) => {
                    let children: ChildInFamilySummary[] | undefined;
                    let mergedLabels: ChildFamilyParentPickLabels = { ...labels };
                    try {
                      const data = await fetchJson<{ family: Record<string, unknown> }>(
                        `/api/admin/families/${familyId}`,
                      );
                      const fam = data.family;
                      children = familyChildrenToSummaries(fam?.familyChildren);
                      const h = fam?.husband as Record<string, unknown> | null | undefined;
                      const w = fam?.wife as Record<string, unknown> | null | undefined;
                      if (h && typeof h.id === "string") mergedLabels = { ...mergedLabels, husbandId: h.id };
                      if (w && typeof w.id === "string") mergedLabels = { ...mergedLabels, wifeId: w.id };
                    } catch {
                      /* roster / parent ids may be incomplete; picker still sent labels */
                    }
                    addChildRow(familyId, mergedLabels, children);
                    setChildFamilySearchSlots((s) => s.filter((x) => x.id !== slot.id));
                  }}
                />
              </div>
            ))}
          </div>

          {hasPendingNewParentsChild ? (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
              <p className="text-sm font-medium text-base-content">Save new parents &amp; family</p>
              <p className="text-sm text-muted-foreground">
                New parents and their family are not stored until you save. This runs the same save as the primary
                button at the bottom of the page.
              </p>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Saving…"
                  : mode === "create"
                    ? "Save person & new parental family"
                    : "Save & create new parental family"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>

      <div
        id="individual-editor-panel-notes"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-notes"
        hidden={editorTab !== "notes"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">Notes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Notes linked to this person. Edit content on each note&apos;s admin page.
              </p>
            </div>
            {mode === "edit" && individualId ? (
              <Link
                href={`/admin/notes/new?individualId=${encodeURIComponent(individualId)}&individualLabel=${encodeURIComponent(individualNewEventLabel)}&returnTo=${encodeURIComponent(`/admin/individuals/${individualId}/edit`)}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                Add note
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Save this person first to see notes linked to their record.
              </p>
            ) : individualNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes linked to this individual.</p>
            ) : (
              individualNotes.map((jn) => {
                const n = jn.note;
                const nid = String(n.id);
                return (
                  <EmbeddedNoteCard
                    key={nid}
                    noteId={nid}
                    xref={String(n.xref ?? "")}
                    content={String(n.content ?? "")}
                  />
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div
        id="individual-editor-panel-media"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-media"
        hidden={editorTab !== "media"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Media</CardTitle>
            <p className="text-sm text-muted-foreground">OBJE records linked to this person.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Save this person first to see media linked to their record.
              </p>
            ) : individualMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media linked to this individual.</p>
            ) : (
              individualMedia.map((im) => {
                const m = im.media;
                const mid = m.id as string;
                return (
                  <div
                    key={mid}
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                  >
                    <p className="font-medium">
                      <Link href={`/admin/media/${mid}`} className="link link-primary">
                        {String(m.title ?? m.fileRef ?? "Media")}
                      </Link>
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">{String(m.xref ?? "")}</p>
                    <p className="text-xs text-muted-foreground">Media id: {mid}</p>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div
        id="individual-editor-panel-sources"
        role="tabpanel"
        aria-labelledby="individual-editor-tab-sources"
        hidden={editorTab !== "sources"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Sources</CardTitle>
            <p className="text-sm text-muted-foreground">Source citations linked to this person.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Save this person first to see sources linked to their record.
              </p>
            ) : individualSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources linked to this individual.</p>
            ) : (
              individualSources.map((row) => {
                const s = row.source;
                return (
                  <div
                    key={String(s.id)}
                    className="rounded-box border border-base-content/[0.08] bg-base-content/[0.035] p-3 text-sm shadow-sm shadow-black/15"
                  >
                    <p className="font-medium">{String(s.title ?? s.xref ?? "Source")}</p>
                    <p className="text-xs font-mono text-muted-foreground">{String(s.xref ?? "")}</p>
                    {s.author ? <p className="text-muted-foreground">Author: {String(s.author)}</p> : null}
                    {s.publication ? <p className="text-muted-foreground">{String(s.publication)}</p> : null}
                    {row.page ? <p>Page: {row.page}</p> : null}
                    {row.citationText ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs">{row.citationText}</p>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create individual" : "Save changes"}
        </Button>
        <Link href={mode === "edit" ? `/admin/individuals/${individualId}` : "/admin/individuals"} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
