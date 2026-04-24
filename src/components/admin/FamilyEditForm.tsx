"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { toast } from "sonner";
import {
  Baby,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Image,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { selectClassName } from "@/components/data-viewer/constants";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { AssociatedMediaThumbnailGrid } from "@/components/admin/AssociatedMediaThumbnailGrid";
import { EmbeddedNoteCard } from "@/components/admin/EmbeddedNoteCard";
import { MediaPicker } from "@/components/admin/media-picker";
import { FamilyAdminEventContext } from "@/components/admin/AdminEventContextLinks";
import { GedcomEventTypeIcon } from "@/components/admin/GedcomEventTypeIcon";
import { KeyFactSection } from "@/components/admin/IndividualEditForm";
import { SexIcon } from "@/components/admin/SexIcon";
import { DataViewerPagination } from "@/components/data-viewer/DataViewerPagination";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, fetchJson } from "@/lib/infra/api";
import { buildMiniIndividualEditorBody, type MiniIndividualFields } from "@/lib/forms/family-mini-individual-payload";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import {
  emptyKeyFactFormState,
  enrichKeyFactFromDenormalized,
  keyFactStateFromDateAndPlace,
  keyFactToApiValue,
  type KeyFactFormState,
} from "@/lib/forms/individual-editor-form";
import { FAMILY_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import { useAdminFamily, useUpdateFamily } from "@/hooks/useAdminFamilies";
import { useAdminFamilyEvents } from "@/hooks/useAdminFamilyEvents";
import { useCreateIndividual } from "@/hooks/useAdminIndividuals";
import { useFamilyMembershipMutation } from "@/hooks/useFamilyMembershipMutation";
import { formatEventDate } from "@/lib/gedcom/format-event-date";
import { labelGedcomEventType } from "@/lib/gedcom/gedcom-event-labels";
import { cn } from "@/lib/utils";
import {
  FAMILY_PARTNER_1_LABEL,
  FAMILY_PARTNER_2_LABEL,
  FAMILY_PARTNER_ASSIGNMENT_RULES,
  FAMILY_PARTNER_SLOT_SUBTITLE,
} from "@/lib/gedcom/family-partner-slots";
import { editFamilyPageTitle } from "@/lib/gedcom/family-page-title";

const RELATIONSHIP_OPTIONS = [
  { value: "biological", label: "Biological" },
  { value: "adopted", label: "Adopted" },
  { value: "foster", label: "Foster" },
  { value: "step", label: "Step" },
  { value: "sealing", label: "Sealing" },
];

const EVENT_SOURCE_LABELS: Record<string, string> = {
  familyRecord: "Family record",
  member: "Member",
};

type FamilyEditTab = "events" | "parents" | "children" | "notes" | "media" | "sources";

type FamilyMemberAddStep = "existing" | "create";

const FAMILY_EDITOR_TAB_ITEMS: { id: FamilyEditTab; label: string; icon: LucideIcon }[] = [
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "parents", label: "Parents", icon: Users },
  { id: "children", label: "Children", icon: Baby },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "media", label: "Media", icon: Image },
  { id: "sources", label: "Sources", icon: BookOpen },
];

type Partner = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex: string | null;
} | null;

type FamilyChildRow = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex?: string | null;
};

type IndHit = {
  id: string;
  xref: string;
  fullName: string | null;
  sex: string | null;
};

function emptyMiniFields(): MiniIndividualFields {
  return {
    givenNamesLine: "",
    surnameLine: "",
    sex: "",
    birth: emptyKeyFactFormState(),
    death: emptyKeyFactFormState(),
  };
}

const MINI_PARENT_SEX_VALUES = new Set(["M", "F", "U", "X"]);

function miniFieldsDisplayName(fields: MiniIndividualFields): string {
  const parts = [fields.givenNamesLine.trim(), fields.surnameLine.trim()].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

function isMiniParentSexChosen(sex: string): boolean {
  return MINI_PARENT_SEX_VALUES.has(sex.trim().toUpperCase());
}

function allowedParentSexes(husbandId: string | null | undefined, wifeId: string | null | undefined): Set<"M" | "F"> | null {
  const h = !!husbandId;
  const w = !!wifeId;
  if (h && w) return new Set();
  if (!h && !w) return null;
  if (h && !w) return new Set(["F"]);
  return new Set(["M"]);
}

function IndividualPickerList({
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
                  ? "Sex must be M or F for this open slot with the current API."
                  : "Wrong sex for the open partner slot (Partner 1 = HUSB, Partner 2 = WIFE)."}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function FamilyEditForm({
  familyId,
  mode = "edit",
}: {
  familyId: string;
  /** `create`: add flow (e.g. `/admin/families/create`); omits parent-based edit title and XREF line. */
  mode?: "create" | "edit";
}) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAdminFamily(familyId);
  const membership = useFamilyMembershipMutation(familyId);
  const updateFamily = useUpdateFamily();
  const createIndividual = useCreateIndividual();

  const fam = data?.family as Record<string, unknown> | undefined;
  const husband = (fam?.husband as Partner) ?? null;
  const wife = (fam?.wife as Partner) ?? null;
  const familyChildren = (fam?.familyChildren as { child: FamilyChildRow }[]) ?? [];
  const familyNotes = (fam?.familyNotes as { note: Record<string, unknown> }[]) ?? [];
  const familyMedia = (fam?.familyMedia as { media: Record<string, unknown> }[]) ?? [];
  const linkedFamilyMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of familyMedia) {
      const id = String(row.media?.id ?? "").trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [familyMedia]);
  const familySources =
    (fam?.familySources as {
      source: Record<string, unknown>;
      page: string | null;
      quality: number | null;
      citationText: string | null;
    }[]) ?? [];

  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminFamilyEvents(familyId);
  const events = eventsRes?.events ?? [];
  const eventsErr = eventsError ? "Events could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: FAMILY_DETAIL_EVENTS_PAGE_SIZE,
  }));

  useEffect(() => {
    setEventPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [familyId]);

  const eventPageCount = Math.max(1, Math.ceil(events.length / eventPagination.pageSize));

  useEffect(() => {
    if (eventPagination.pageIndex >= eventPageCount) {
      setEventPagination((p) => ({ ...p, pageIndex: Math.max(0, eventPageCount - 1) }));
    }
  }, [eventPageCount, eventPagination.pageIndex]);

  const paginatedEvents = useMemo(() => {
    const { pageIndex, pageSize } = eventPagination;
    return events.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [events, eventPagination]);

  const onEventPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setEventPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const [marriageFact, setMarriageFact] = useState<KeyFactFormState>(() => emptyKeyFactFormState());
  const [divorceFact, setDivorceFact] = useState<KeyFactFormState>(() => emptyKeyFactFormState());
  const [isDivorced, setIsDivorced] = useState(false);
  const marriageSyncKeyRef = useRef<string>("");
  const divorceSyncKeyRef = useRef<string>("");
  const isDivorcedSyncKeyRef = useRef<string>("");

  useEffect(() => {
    marriageSyncKeyRef.current = "";
    divorceSyncKeyRef.current = "";
    isDivorcedSyncKeyRef.current = "";
  }, [familyId]);

  const marriageServerKey = useMemo(() => {
    if (!fam) return "";
    const md = fam.marriageDate as { id?: string } | null | undefined;
    const mp = fam.marriagePlace as { id?: string } | null | undefined;
    return [
      familyId,
      md?.id ?? "",
      mp?.id ?? "",
      String(fam.marriageDateDisplay ?? ""),
      String(fam.marriagePlaceDisplay ?? ""),
      fam.marriageYear != null ? String(fam.marriageYear) : "",
      String(fam.updatedAt ?? ""),
    ].join("|");
  }, [fam, familyId]);

  const divorceServerKey = useMemo(() => {
    if (!fam) return "";
    const dd = fam.divorceDate as { id?: string } | null | undefined;
    const dp = fam.divorcePlace as { id?: string } | null | undefined;
    return [familyId, dd?.id ?? "", dp?.id ?? "", String(fam.updatedAt ?? "")].join("|");
  }, [fam, familyId]);

  const isDivorcedServerKey = useMemo(() => {
    if (!fam) return "";
    return `${familyId}|${Boolean(fam.isDivorced)}`;
  }, [fam, familyId]);

  useEffect(() => {
    if (!fam || marriageServerKey === marriageSyncKeyRef.current) return;
    marriageSyncKeyRef.current = marriageServerKey;
    const base = keyFactStateFromDateAndPlace(fam.marriageDate, fam.marriagePlace);
    setMarriageFact(
      enrichKeyFactFromDenormalized(base, {
        displayDate: fam.marriageDateDisplay,
        displayPlace: fam.marriagePlaceDisplay,
        year: fam.marriageYear,
      }),
    );
  }, [fam, marriageServerKey]);

  useEffect(() => {
    if (!fam || divorceServerKey === divorceSyncKeyRef.current) return;
    divorceSyncKeyRef.current = divorceServerKey;
    setDivorceFact(keyFactStateFromDateAndPlace(fam.divorceDate, fam.divorcePlace));
  }, [fam, divorceServerKey]);

  useEffect(() => {
    if (!fam || isDivorcedServerKey === isDivorcedSyncKeyRef.current) return;
    isDivorcedSyncKeyRef.current = isDivorcedServerKey;
    setIsDivorced(Boolean(fam.isDivorced));
  }, [fam, isDivorcedServerKey]);

  const xref = (fam?.xref as string) ?? "";

  const familyNewEventLabel = useMemo(() => {
    const x = xref.trim();
    if (x) return x;
    return (
      [stripSlashesFromName(husband?.fullName), stripSlashesFromName(wife?.fullName)].filter(Boolean).join(" & ").trim() ||
      familyId
    );
  }, [xref, husband?.fullName, wife?.fullName, familyId]);

  const editModeFamilyTitle = useMemo(
    () => (mode === "edit" ? editFamilyPageTitle(husband, wife) : ""),
    [mode, husband, wife],
  );

  const excludeMemberIds = useMemo(() => {
    const s = new Set<string>();
    if (husband?.id) s.add(husband.id);
    if (wife?.id) s.add(wife.id);
    for (const row of familyChildren) {
      if (row.child?.id) s.add(row.child.id);
    }
    return s;
  }, [husband?.id, wife?.id, familyChildren]);

  const parentSexFilter = useMemo(
    () => allowedParentSexes(husband?.id ?? null, wife?.id ?? null),
    [husband?.id, wife?.id],
  );

  const canAddParent = parentSexFilter == null || parentSexFilter.size > 0;

  const [parentAddStep, setParentAddStep] = useState<FamilyMemberAddStep | null>(null);
  const [parentSearchQ, setParentSearchQ] = useState("");
  const [miniParent, setMiniParent] = useState<MiniIndividualFields>(() => emptyMiniFields());

  const [childAddStep, setChildAddStep] = useState<FamilyMemberAddStep | null>(null);
  const [childSearchQ, setChildSearchQ] = useState("");
  const [miniChild, setMiniChild] = useState<MiniIndividualFields>(() => emptyMiniFields());
  const [childRelationshipType, setChildRelationshipType] = useState("biological");
  const [childBirthOrder, setChildBirthOrder] = useState("");
  const [familyEditTab, setFamilyEditTab] = useState<FamilyEditTab>("events");
  const [parentSlotRulesOpen, setParentSlotRulesOpen] = useState(false);
  const parentSlotRulesPanelId = useId();

  const resetParentPanel = useCallback(() => {
    setParentSearchQ("");
    setMiniParent(emptyMiniFields());
  }, []);

  const resetChildPanel = useCallback(() => {
    setChildSearchQ("");
    setMiniChild(emptyMiniFields());
    setChildRelationshipType("biological");
    setChildBirthOrder("");
  }, []);

  const closeParentAdd = useCallback(() => {
    setParentAddStep(null);
    resetParentPanel();
  }, [resetParentPanel]);

  const closeChildAdd = useCallback(() => {
    setChildAddStep(null);
    resetChildPanel();
  }, [resetChildPanel]);

  useEffect(() => {
    setFamilyEditTab("events");
    setParentAddStep(null);
    setChildAddStep(null);
    setParentSlotRulesOpen(false);
    setFinalizeErr(null);
    resetParentPanel();
    resetChildPanel();
  }, [familyId, resetParentPanel, resetChildPanel]);

  const membershipApi =
    membership.error instanceof Error ? membership.error.message : "";
  const updateErr =
    updateFamily.error instanceof Error ? updateFamily.error.message : "";
  const createIndErr =
    mode === "create" && createIndividual.error instanceof Error
      ? createIndividual.error.message
      : "";
  const [finalizeErr, setFinalizeErr] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);

  const saveMarriageAndDivorce = async () => {
    const marriageVal = keyFactToApiValue(marriageFact);
    const divorceVal = keyFactToApiValue(divorceFact);
    await updateFamily.mutateAsync({
      id: familyId,
      marriage: marriageVal,
      divorce: divorceVal,
      isDivorced,
    });
    await refetch();
  };

  const onAddParentById = async (individualId: string) => {
    await membership.mutateAsync({ action: "addParent", individualId });
    closeParentAdd();
  };

  const onCreateParent = async () => {
    const sx = miniParent.sex.trim().toUpperCase();
    if (!MINI_PARENT_SEX_VALUES.has(sx)) {
      return;
    }
    const name = miniFieldsDisplayName(miniParent);
    const body = buildMiniIndividualEditorBody({ ...miniParent, sex: sx });
    if (mode === "create") {
      await createIndividual.mutateAsync(body);
      toast.success(`Created ${name}`, {
        description: 'Use "Add existing person" to link them as a parent.',
      });
      closeParentAdd();
      return;
    }
    await membership.mutateAsync({
      action: "createParentAndAdd",
      individual: body,
    });
    toast.success(`Created and added ${name} as a parent.`);
    closeParentAdd();
  };

  const onRemoveParent = async (slot: "husband" | "wife") => {
    const label = slot === "husband" ? `${FAMILY_PARTNER_1_LABEL} (HUSB)` : `${FAMILY_PARTNER_2_LABEL} (WIFE)`;
    if (!window.confirm(`Remove ${label} from this family?`)) return;
    await membership.mutateAsync({ action: "removeParent", slot });
  };

  const onAddChildById = async (childId: string) => {
    const birthOrderRaw = childBirthOrder.trim();
    const birthOrder =
      birthOrderRaw === "" ? null : Math.trunc(Number(birthOrderRaw));
    await membership.mutateAsync({
      action: "addChild",
      childId,
      relationshipType: childRelationshipType,
      ...(birthOrder != null && Number.isFinite(birthOrder) ? { birthOrder } : {}),
    });
    closeChildAdd();
  };

  const onCreateChild = async () => {
    const name = miniFieldsDisplayName(miniChild);
    const body = buildMiniIndividualEditorBody(miniChild);
    if (mode === "create") {
      await createIndividual.mutateAsync(body);
      toast.success(`Created ${name}`, {
        description: 'Use "Add existing person" to link them as a child.',
      });
      closeChildAdd();
      return;
    }
    const birthOrderRaw = childBirthOrder.trim();
    const birthOrder =
      birthOrderRaw === "" ? null : Math.trunc(Number(birthOrderRaw));
    await membership.mutateAsync({
      action: "createChildAndAdd",
      individual: body,
      relationshipType: childRelationshipType,
      ...(birthOrder != null && Number.isFinite(birthOrder) ? { birthOrder } : {}),
    });
    toast.success(`Created and added ${name} as a child.`);
    closeChildAdd();
  };

  const onCreateNewFamily = async () => {
    if (!husband?.id && !wife?.id) {
      setFinalizeErr("Add at least one parent before creating this family.");
      return;
    }
    setFinalizeErr(null);
    setFinalizeBusy(true);
    try {
      const marriageVal = keyFactToApiValue(marriageFact);
      const divorceVal = keyFactToApiValue(divorceFact);
      await updateFamily.mutateAsync({
        id: familyId,
        marriage: marriageVal,
        divorce: divorceVal,
        isDivorced,
      });
      await refetch();
      router.replace(`/admin/families/${familyId}/edit`);
    } catch (e) {
      setFinalizeErr(
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not save family.",
      );
    } finally {
      setFinalizeBusy(false);
    }
  };

  const onRemoveChild = async (childId: string) => {
    const row = familyChildren.find((r) => r.child?.id === childId);
    const name = row?.child
      ? stripSlashesFromName(row.child.fullName) || row.child.xref || childId
      : childId;
    if (!window.confirm(`Remove ${name} from this family?`)) return;
    try {
      await membership.mutateAsync({ action: "removeChild", childId });
      toast.success(`Removed ${name} from family.`);
    } catch {
      toast.error(`Failed to remove ${name}.`);
    }
  };

  const setMiniBirth = (which: "parent" | "child", next: KeyFactFormState) => {
    if (which === "parent") setMiniParent((p) => ({ ...p, birth: next }));
    else setMiniChild((p) => ({ ...p, birth: next }));
  };

  const setMiniDeath = (which: "parent" | "child", next: KeyFactFormState) => {
    if (which === "parent") setMiniParent((p) => ({ ...p, death: next }));
    else setMiniChild((p) => ({ ...p, death: next }));
  };

  const pending =
    membership.isPending ||
    updateFamily.isPending ||
    (mode === "create" && createIndividual.isPending);

  return (
    <DetailPageShell
      backHref="/admin/families"
      backLabel="Families"
      isLoading={isLoading}
      error={error}
      data={fam}
      notFoundMessage="Could not load this family."
      fullWidth
    >
      <header className="space-y-2 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "create" ? "Add New Family" : editModeFamilyTitle}
        </h1>
        {mode === "create" ? (
          <p className="text-sm text-muted-foreground">Add partners, children, and events below.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            XREF <span className="font-mono text-xs">{xref || "—"}</span>
            {" · "}
            <Link href={`/admin/families/${familyId}`} className="link link-primary font-medium">
              View family
            </Link>
          </p>
        )}
      </header>

      {(membershipApi || updateErr || createIndErr) && (
        <p className="text-sm text-destructive">{membershipApi || updateErr || createIndErr}</p>
      )}

      <div className="-mx-4 border-y border-base-300 bg-background/95 py-px backdrop-blur-sm sm:mx-0 dark:border-border">
        <div
          className="flex gap-0 overflow-x-auto overscroll-x-contain"
          role="tablist"
          aria-label="Family editor sections"
        >
          {FAMILY_EDITOR_TAB_ITEMS.map((t) => {
            const Icon = t.icon;
            const selected = familyEditTab === t.id;
            const tabLabel =
              t.id === "children"
                ? `Children (${familyChildren.length})`
                : t.id === "notes"
                  ? `Notes (${familyNotes.length})`
                  : t.id === "media"
                    ? `Media (${familyMedia.length})`
                    : t.id === "sources"
                      ? `Sources (${familySources.length})`
                      : t.label;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`family-editor-panel-${t.id}`}
                id={`family-editor-tab-${t.id}`}
                title={tabLabel}
                className={cn(
                  "flex min-w-[2.75rem] shrink-0 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:min-w-0 md:justify-start",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted hover:text-foreground",
                )}
                onClick={() => setFamilyEditTab(t.id)}
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
        id="family-editor-panel-events"
        role="tabpanel"
        aria-labelledby="family-editor-tab-events"
        hidden={familyEditTab !== "events"}
        className="space-y-8 pt-2"
      >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Marriage & Divorce</CardTitle>
          <p className="text-sm text-muted-foreground">
            Marriage (MARR) and divorce (DIV) are stored as family events with linked date and place rows; marriage
            details are also denormalized on the family record for lists and search.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <KeyFactSection title="Marriage date & place" fact={marriageFact} onChange={setMarriageFact} defaultOpen />
          <KeyFactSection title="Divorce date & place" fact={divorceFact} onChange={setDivorceFact} defaultOpen />
          <div className="flex min-h-11 items-start gap-3 sm:min-h-0">
            <Checkbox
              id="family-is-divorced"
              checked={isDivorced}
              onCheckedChange={(v) => setIsDivorced(v === true)}
              className="mt-0.5 shrink-0"
            />
            <Label htmlFor="family-is-divorced" className="cursor-pointer font-normal leading-snug">
              Divorced (flag on family record; can be used with or without a structured divorce event above)
            </Label>
          </div>
          {mode !== "create" ? (
            <Button type="button" onClick={() => void saveMarriageAndDivorce()} disabled={pending}>
              Save marriage & divorce
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Marriage and divorce are applied when you choose <span className="font-medium text-base-content/90">Create new family</span>{" "}
              below.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">Other events</CardTitle>
            <p className="text-sm text-muted-foreground">
              Events on this family record and each member&apos;s own individual events. Marriage and divorce above are
              saved separately; open an event here to edit it in Events admin.
            </p>
          </div>
          {familyId ? (
            <Link
              href={`/admin/events/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add event
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : eventsErr ? (
            <p className="text-sm text-destructive">{eventsErr}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other events yet.</p>
          ) : (
            <>
              <div className="space-y-3">
                {paginatedEvents.map((e, i) => (
                  <div
                    key={
                      e.eventId ??
                      `fev-${eventPagination.pageIndex}-${i}-${e.sortOrder}-${e.eventType}-${e.source}-${e.memberId ?? ""}`
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
                      <FamilyAdminEventContext e={e} />
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
              {events.length > FAMILY_DETAIL_EVENTS_PAGE_SIZE ? (
                <div className="flex justify-end pt-1">
                  <DataViewerPagination
                    pagination={eventPagination}
                    pageCount={eventPageCount}
                    filteredTotal={events.length}
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
        id="family-editor-panel-parents"
        role="tabpanel"
        aria-labelledby="family-editor-tab-parents"
        hidden={familyEditTab !== "parents"}
        className="space-y-8 pt-2"
      >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Parents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-base-content/10 bg-base-content/[0.02]">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
              aria-expanded={parentSlotRulesOpen}
              aria-controls={parentSlotRulesPanelId}
              onClick={() => setParentSlotRulesOpen((o) => !o)}
            >
              <span className="font-medium text-base-content">Info</span>
              {parentSlotRulesOpen ? (
                <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              ) : (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
            </button>
            <div
              id={parentSlotRulesPanelId}
              hidden={!parentSlotRulesOpen}
              className="space-y-2 border-t border-base-content/10 px-3 pb-3 pt-2"
              role="region"
              aria-label="Partner slot info"
            >
              <p className="text-sm text-muted-foreground">{FAMILY_PARTNER_SLOT_SUBTITLE}</p>
              <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
                {FAMILY_PARTNER_ASSIGNMENT_RULES.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Add existing person still filters by the open partner slot (M/F). Create new person accepts Male, Female,
                Unknown (U), or Other (X); when linking, HUSB/WIFE follow the rules above (including unknown/other with M
                or F).
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-box border border-base-content/[0.08] p-3">
              <p className="text-xs font-medium text-muted-foreground">{FAMILY_PARTNER_1_LABEL}</p>
              <p className="text-[11px] text-muted-foreground/90">GEDCOM husband (HUSB)</p>
              {husband ? (
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <SexIcon sex={husband.sex} />
                    <Link href={`/admin/individuals/${husband.id}`} className="link link-primary truncate font-medium">
                      {stripSlashesFromName(husband.fullName) || husband.xref || husband.id}
                    </Link>
                  </div>
                  {wife ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label={`Remove ${FAMILY_PARTNER_1_LABEL} (HUSB)`}
                      onClick={() => void onRemoveParent("husband")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Cannot remove only parent</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
            <div className="rounded-box border border-base-content/[0.08] p-3">
              <p className="text-xs font-medium text-muted-foreground">{FAMILY_PARTNER_2_LABEL}</p>
              <p className="text-[11px] text-muted-foreground/90">GEDCOM wife (WIFE)</p>
              {wife ? (
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <SexIcon sex={wife.sex} />
                    <Link href={`/admin/individuals/${wife.id}`} className="link link-primary truncate font-medium">
                      {stripSlashesFromName(wife.fullName) || wife.xref || wife.id}
                    </Link>
                  </div>
                  {husband ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label={`Remove ${FAMILY_PARTNER_2_LABEL} (WIFE)`}
                      onClick={() => void onRemoveParent("wife")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Cannot remove only parent</span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Empty</p>
              )}
            </div>
          </div>

          {canAddParent ? (
            <div className="space-y-3 border-t border-base-content/10 pt-4">
              <h3 className="text-sm font-semibold text-base-content">Add Parent(s)</h3>
              {parentAddStep === null ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("existing");
                    }}
                  >
                    Add existing person
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      resetParentPanel();
                      setParentAddStep("create");
                    }}
                  >
                    Create new person
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="text-sm font-medium text-base-content">
                      {parentAddStep === "existing" ? "Add existing person" : "Create new parent"}
                    </Label>
                    <Button type="button" variant="ghost" size="sm" onClick={closeParentAdd}>
                      Cancel
                    </Button>
                  </div>
                  {parentAddStep === "existing" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Search by given or surname, then pick someone who fits the open partner slot (M/F).
                      </p>
                      <Label htmlFor="parent-q">Name search</Label>
                      <Input
                        id="parent-q"
                        value={parentSearchQ}
                        onChange={(e) => setParentSearchQ(e.target.value)}
                        placeholder="Given or surname…"
                        autoComplete="off"
                        className="min-h-11 sm:min-h-10"
                      />
                      <IndividualPickerList
                        query={parentSearchQ}
                        excludeIds={excludeMemberIds}
                        allowedSexes={parentSexFilter}
                        onPick={(indiId) => void onAddParentById(indiId)}
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {mode === "create" ? (
                          <>
                            Creates only the person in the tree (not linked to this family yet). Use{" "}
                            <span className="font-medium text-base-content/90">Add existing person</span> to link them
                            after <span className="font-medium text-base-content/90">Create new family</span>. Choose
                            sex (M, F, U, or X). Open partner slot rules above if needed.
                          </>
                        ) : (
                          <>
                            Minimal person record; sex M, F, U, or X. Open{" "}
                            <span className="font-medium text-base-content/90">Partner slot assignment rules</span> above
                            if you need the full logic.
                          </>
                        )}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-given">Given names</Label>
                          <Input
                            id="np-given"
                            value={miniParent.givenNamesLine}
                            onChange={(e) => setMiniParent((p) => ({ ...p, givenNamesLine: e.target.value }))}
                            placeholder="e.g. Maria Clara"
                            className="min-h-11 sm:min-h-10"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-sur">Surname (use /a /b/ for several)</Label>
                          <Input
                            id="np-sur"
                            value={miniParent.surnameLine}
                            onChange={(e) => setMiniParent((p) => ({ ...p, surnameLine: e.target.value }))}
                            placeholder="e.g. Gonsalves or /Silva /Oliveira/"
                            className="min-h-11 sm:min-h-10"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="np-sex">Sex</Label>
                          <select
                            id="np-sex"
                            className={selectClassName}
                            value={miniParent.sex}
                            onChange={(e) => setMiniParent((p) => ({ ...p, sex: e.target.value }))}
                          >
                            <option value="">Choose…</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                            <option value="U">Unknown</option>
                            <option value="X">Other</option>
                          </select>
                          <p className="text-[11px] text-muted-foreground">
                            GEDCOM sex codes: U = unknown, X = other. Partner slots when linking follow the collapsible
                            rules (M/F/U/X and same-sex ordering).
                          </p>
                        </div>
                      </div>
                      <KeyFactSection title="Birth (optional)" fact={miniParent.birth} onChange={(n) => setMiniBirth("parent", n)} />
                      <KeyFactSection title="Death (optional)" fact={miniParent.death} onChange={(n) => setMiniDeath("parent", n)} />
                      <Button
                        type="button"
                        disabled={pending || !isMiniParentSexChosen(miniParent.sex)}
                        className="w-full sm:w-auto"
                        onClick={() => void onCreateParent()}
                      >
                        {mode === "create" ? "Create" : "Create and link"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>

      <div
        id="family-editor-panel-children"
        role="tabpanel"
        aria-labelledby="family-editor-tab-children"
        hidden={familyEditTab !== "children"}
        className="space-y-8 pt-2"
      >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Children ({familyChildren.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {familyChildren.length === 0 ? (
            <p className="text-sm text-muted-foreground">No children linked.</p>
          ) : (
            <ul className="space-y-2">
              {familyChildren.map((row) => {
                const c = row.child;
                if (!c?.id) return null;
                const label = stripSlashesFromName(c.fullName) || c.xref || c.id;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded-box border border-base-content/[0.08] px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <SexIcon sex={c.sex} />
                      <Link href={`/admin/individuals/${c.id}`} className="link link-primary truncate font-medium">
                        {label}
                      </Link>
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 text-destructive"
                      disabled={pending}
                      aria-label="Remove child"
                      onClick={() => void onRemoveChild(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-3 border-t border-base-content/10 pt-4">
            <h3 className="text-sm font-semibold text-base-content">Add children</h3>
            {childAddStep === null ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    resetChildPanel();
                    setChildAddStep("existing");
                  }}
                >
                  Add existing person
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    resetChildPanel();
                    setChildAddStep("create");
                  }}
                >
                  Create new person
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-box border border-base-content/10 bg-base-content/[0.02] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-base-content">
                    {childAddStep === "existing" ? "Add existing person" : "Create new child"}
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={closeChildAdd}>
                    Cancel
                  </Button>
                </div>
                {(mode === "edit" || childAddStep === "existing") ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ch-rel">Relationship</Label>
                      <select
                        id="ch-rel"
                        className={selectClassName}
                        value={childRelationshipType}
                        onChange={(e) => setChildRelationshipType(e.target.value)}
                      >
                        {RELATIONSHIP_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ch-bo">Birth order (optional)</Label>
                      <Input
                        id="ch-bo"
                        inputMode="numeric"
                        value={childBirthOrder}
                        onChange={(e) => setChildBirthOrder(e.target.value)}
                        placeholder="e.g. 1"
                        className="min-h-11 sm:min-h-10"
                      />
                    </div>
                  </div>
                ) : null}
                {childAddStep === "existing" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Search by given or surname, then pick someone not already in this family.
                    </p>
                    <Label htmlFor="child-q">Name search</Label>
                    <Input
                      id="child-q"
                      value={childSearchQ}
                      onChange={(e) => setChildSearchQ(e.target.value)}
                      placeholder="Given or surname…"
                      autoComplete="off"
                      className="min-h-11 sm:min-h-10"
                    />
                    <IndividualPickerList
                      query={childSearchQ}
                      excludeIds={excludeMemberIds}
                      allowedSexes={null}
                      onPick={(childIndiId) => void onAddChildById(childIndiId)}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {mode === "create" ? (
                        <>
                          Creates only the person in the tree (not linked as a child yet). Use{" "}
                          <span className="font-medium text-base-content/90">Add existing person</span> to link them after{" "}
                          <span className="font-medium text-base-content/90">Create new family</span>.
                        </>
                      ) : (
                        <>Create a minimal person and link them as a child with the relationship and birth order above.</>
                      )}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-given">Given names</Label>
                        <Input
                          id="nc-given"
                          value={miniChild.givenNamesLine}
                          onChange={(e) => setMiniChild((p) => ({ ...p, givenNamesLine: e.target.value }))}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-sur">Surname</Label>
                        <Input
                          id="nc-sur"
                          value={miniChild.surnameLine}
                          onChange={(e) => setMiniChild((p) => ({ ...p, surnameLine: e.target.value }))}
                          className="min-h-11 sm:min-h-10"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="nc-sex">Sex</Label>
                        <select
                          id="nc-sex"
                          className={selectClassName}
                          value={miniChild.sex}
                          onChange={(e) => setMiniChild((p) => ({ ...p, sex: e.target.value }))}
                        >
                          <option value="">Unknown</option>
                          <option value="M">Male</option>
                          <option value="F">Female</option>
                          <option value="U">Unknown (U)</option>
                          <option value="X">Other (X)</option>
                        </select>
                      </div>
                    </div>
                    <KeyFactSection title="Birth (optional)" fact={miniChild.birth} onChange={(n) => setMiniBirth("child", n)} />
                    <KeyFactSection title="Death (optional)" fact={miniChild.death} onChange={(n) => setMiniDeath("child", n)} />
                    <Button type="button" disabled={pending} className="w-full sm:w-auto" onClick={() => void onCreateChild()}>
                      {mode === "create" ? "Create" : "Create and link"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      <div
        id="family-editor-panel-notes"
        role="tabpanel"
        aria-labelledby="family-editor-tab-notes"
        hidden={familyEditTab !== "notes"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">Notes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Notes linked to this family. Manage full text on each note&apos;s admin page.
              </p>
            </div>
            <Link
              href={`/admin/notes/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(
                mode === "create"
                  ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
                  : `/admin/families/${familyId}/edit`,
              )}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              Add note
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {familyNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes linked to this family.</p>
            ) : (
              familyNotes.map((jn) => {
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
        id="family-editor-panel-media"
        role="tabpanel"
        aria-labelledby="family-editor-tab-media"
        hidden={familyEditTab !== "media"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-2">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-lg">Media</CardTitle>
              <p className="text-sm text-muted-foreground">OBJE records linked to this family.</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <MediaPicker
                targetType="family"
                targetId={familyId}
                mode="multiple"
                triggerLabel="Choose from archive"
                excludeMediaIds={linkedFamilyMediaIds}
                onAttach={() => {
                  void refetch();
                }}
              />
              <Link
                href={`/admin/media/new?familyId=${encodeURIComponent(familyId)}&familyLabel=${encodeURIComponent(familyNewEventLabel)}&returnTo=${encodeURIComponent(
                  mode === "create"
                    ? `/admin/families/create?id=${encodeURIComponent(familyId)}`
                    : `/admin/families/${familyId}/edit`,
                )}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
              >
                Add media
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {familyMedia.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media linked to this family.</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Thumbnails for images; other files show a placeholder. Tap a tile to open the media record.
                </p>
                <AssociatedMediaThumbnailGrid items={familyMedia} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div
        id="family-editor-panel-sources"
        role="tabpanel"
        aria-labelledby="family-editor-tab-sources"
        hidden={familyEditTab !== "sources"}
        className="space-y-8 pt-2"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Sources</CardTitle>
            <p className="text-sm text-muted-foreground">Source citations linked to this family.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {familySources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources linked to this family.</p>
            ) : (
              familySources.map((row) => {
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

      {mode === "create" ? (
        <div className="sticky bottom-0 z-10 mt-8 border-t border-base-content/[0.08] bg-background pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Requires at least one parent (Partner 1 or Partner 2). Saves marriage/divorce fields and opens the family
              editor.
            </p>
            <Button
              type="button"
              className="w-full shrink-0 sm:w-auto"
              disabled={pending || finalizeBusy}
              onClick={() => void onCreateNewFamily()}
            >
              {finalizeBusy ? "Saving…" : "Create new family"}
            </Button>
          </div>
          {finalizeErr ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {finalizeErr}
            </p>
          ) : null}
        </div>
      ) : null}
    </DetailPageShell>
  );
}
