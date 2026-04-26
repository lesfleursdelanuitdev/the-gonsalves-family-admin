"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { toast } from "sonner";
import { isMiniParentSexChosen } from "@/components/admin/family-editor/family-parent-mini-fields";
import type {
  FamilyEditChildRow,
  FamilyEditMediaJoin,
  FamilyEditNoteJoin,
  FamilyEditPartner,
  FamilyEditSourceJoin,
  FamilyEditTab,
  FamilyMemberAddStep,
} from "@/components/admin/family-editor/family-editor-types";
import { FAMILY_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import { useAdminFamily, useUpdateFamily } from "@/hooks/useAdminFamilies";
import { useAdminFamilyEvents, type AdminFamilyEventRow } from "@/hooks/useAdminFamilyEvents";
import { useCreateIndividual } from "@/hooks/useAdminIndividuals";
import { useFamilyMembershipMutation } from "@/hooks/useFamilyMembershipMutation";
import { buildMiniIndividualEditorBody, type MiniIndividualFields } from "@/lib/forms/family-mini-individual-payload";
import {
  emptyKeyFactFormState,
  enrichKeyFactFromDenormalized,
  keyFactStateFromDateAndPlace,
  keyFactToApiValue,
  type KeyFactFormState,
} from "@/lib/forms/individual-editor-form";
import { ApiError } from "@/lib/infra/api";
import { stripSlashesFromName } from "@/lib/gedcom/display-name";
import { FAMILY_PARTNER_1_LABEL, FAMILY_PARTNER_2_LABEL } from "@/lib/gedcom/family-partner-slots";
import { editFamilyPageTitle } from "@/lib/gedcom/family-page-title";

function emptyMiniFields(): MiniIndividualFields {
  return {
    givenNamesLine: "",
    surnameLine: "",
    sex: "",
    birth: emptyKeyFactFormState(),
    death: emptyKeyFactFormState(),
  };
}

function miniFieldsDisplayName(fields: MiniIndividualFields): string {
  const parts = [fields.givenNamesLine.trim(), fields.surnameLine.trim()].filter(Boolean);
  return parts.join(" ") || "Unknown";
}

const STABLE_EMPTY_CHILDREN: FamilyEditChildRow[] = [];
const STABLE_EMPTY_MEDIA: FamilyEditMediaJoin[] = [];
const STABLE_EMPTY_NOTES: FamilyEditNoteJoin[] = [];
const STABLE_EMPTY_SOURCES: FamilyEditSourceJoin[] = [];
const STABLE_EMPTY_EVENTS: AdminFamilyEventRow[] = [];

function allowedParentSexes(husbandId: string | null | undefined, wifeId: string | null | undefined): Set<"M" | "F"> | null {
  const h = !!husbandId;
  const w = !!wifeId;
  if (h && w) return new Set();
  if (!h && !w) return null;
  if (h && !w) return new Set(["F"]);
  return new Set(["M"]);
}

export type UseFamilyEditorStateArgs = {
  familyId: string;
  mode?: "create" | "edit";
};

function useFamilyEditorData(
  data: { family?: unknown } | undefined,
  familyId: string,
  mode: "create" | "edit",
) {
  const fam = data?.family as Record<string, unknown> | undefined;
  const husband = (fam?.husband as FamilyEditPartner) ?? null;
  const wife = (fam?.wife as FamilyEditPartner) ?? null;
  const familyChildren =
    fam?.familyChildren != null ? (fam.familyChildren as FamilyEditChildRow[]) : STABLE_EMPTY_CHILDREN;
  const familyNotes =
    fam?.familyNotes != null ? (fam.familyNotes as FamilyEditNoteJoin[]) : STABLE_EMPTY_NOTES;
  const familyMedia = fam?.familyMedia != null ? (fam.familyMedia as FamilyEditMediaJoin[]) : STABLE_EMPTY_MEDIA;
  const familySources =
    fam?.familySources != null ? (fam.familySources as FamilyEditSourceJoin[]) : STABLE_EMPTY_SOURCES;

  const linkedFamilyMediaIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of familyMedia) {
      const id = String(row.media?.id ?? "").trim();
      if (id) ids.add(id);
    }
    return ids;
  }, [familyMedia]);

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

  return {
    fam,
    husband,
    wife,
    familyChildren,
    familyNotes,
    familyMedia,
    familySources,
    linkedFamilyMediaIds,
    xref,
    familyNewEventLabel,
    editModeFamilyTitle,
    excludeMemberIds,
    parentSexFilter,
    canAddParent,
  };
}

function useFamilyEditorEventsState(familyId: string) {
  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminFamilyEvents(familyId);
  const events = eventsRes?.events != null ? eventsRes.events : STABLE_EMPTY_EVENTS;
  const eventsErr = eventsError ? "Events could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: FAMILY_DETAIL_EVENTS_PAGE_SIZE,
  }));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEventPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [familyId]);

  const eventPageCount = Math.max(1, Math.ceil(events.length / eventPagination.pageSize));
  useEffect(() => {
    if (eventPagination.pageIndex >= eventPageCount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  return {
    events,
    eventsLoading,
    eventsErr,
    eventPagination,
    eventPageCount,
    paginatedEvents,
    onEventPaginationChange,
  };
}

function useFamilyMarriageDivorceState(args: {
  familyId: string;
  fam: Record<string, unknown> | undefined;
}) {
  const { familyId, fam } = args;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDivorceFact(keyFactStateFromDateAndPlace(fam.divorceDate, fam.divorcePlace));
  }, [fam, divorceServerKey]);
  useEffect(() => {
    if (!fam || isDivorcedServerKey === isDivorcedSyncKeyRef.current) return;
    isDivorcedSyncKeyRef.current = isDivorcedServerKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsDivorced(Boolean(fam.isDivorced));
  }, [fam, isDivorcedServerKey]);

  return { marriageFact, setMarriageFact, divorceFact, setDivorceFact, isDivorced, setIsDivorced };
}

function useFamilyMemberPanelsState(familyId: string) {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFamilyEditTab("events");
    setParentAddStep(null);
    setChildAddStep(null);
    setParentSlotRulesOpen(false);
    resetParentPanel();
    resetChildPanel();
  }, [familyId, resetParentPanel, resetChildPanel]);

  const setMiniBirth = useCallback((which: "parent" | "child", next: KeyFactFormState) => {
    if (which === "parent") setMiniParent((p) => ({ ...p, birth: next }));
    else setMiniChild((p) => ({ ...p, birth: next }));
  }, []);
  const setMiniDeath = useCallback((which: "parent" | "child", next: KeyFactFormState) => {
    if (which === "parent") setMiniParent((p) => ({ ...p, death: next }));
    else setMiniChild((p) => ({ ...p, death: next }));
  }, []);

  return {
    parentAddStep,
    setParentAddStep,
    parentSearchQ,
    setParentSearchQ,
    miniParent,
    setMiniParent,
    childAddStep,
    setChildAddStep,
    childSearchQ,
    setChildSearchQ,
    miniChild,
    setMiniChild,
    childRelationshipType,
    setChildRelationshipType,
    childBirthOrder,
    setChildBirthOrder,
    familyEditTab,
    setFamilyEditTab,
    parentSlotRulesOpen,
    setParentSlotRulesOpen,
    parentSlotRulesPanelId,
    resetParentPanel,
    resetChildPanel,
    closeParentAdd,
    closeChildAdd,
    setMiniBirth,
    setMiniDeath,
  };
}

export function useFamilyEditorState({ familyId, mode = "edit" }: UseFamilyEditorStateArgs) {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAdminFamily(familyId);
  const membership = useFamilyMembershipMutation(familyId);
  const updateFamily = useUpdateFamily();
  const createIndividual = useCreateIndividual();
  const {
    fam,
    husband,
    wife,
    familyChildren,
    familyNotes,
    familyMedia,
    familySources,
    linkedFamilyMediaIds,
    xref,
    familyNewEventLabel,
    editModeFamilyTitle,
    excludeMemberIds,
    parentSexFilter,
    canAddParent,
  } = useFamilyEditorData(data, familyId, mode);
  const {
    events,
    eventsLoading,
    eventsErr,
    eventPagination,
    eventPageCount,
    paginatedEvents,
    onEventPaginationChange,
  } = useFamilyEditorEventsState(familyId);
  const { marriageFact, setMarriageFact, divorceFact, setDivorceFact, isDivorced, setIsDivorced } =
    useFamilyMarriageDivorceState({ familyId, fam });
  const {
    parentAddStep,
    setParentAddStep,
    parentSearchQ,
    setParentSearchQ,
    miniParent,
    setMiniParent,
    childAddStep,
    setChildAddStep,
    childSearchQ,
    setChildSearchQ,
    miniChild,
    setMiniChild,
    childRelationshipType,
    setChildRelationshipType,
    childBirthOrder,
    setChildBirthOrder,
    familyEditTab,
    setFamilyEditTab,
    parentSlotRulesOpen,
    setParentSlotRulesOpen,
    parentSlotRulesPanelId,
    resetParentPanel,
    resetChildPanel,
    closeParentAdd,
    closeChildAdd,
    setMiniBirth,
    setMiniDeath,
  } = useFamilyMemberPanelsState(familyId);

  const [finalizeErr, setFinalizeErr] = useState<string | null>(null);
  const [finalizeBusy, setFinalizeBusy] = useState(false);

  useEffect(() => {
    setFinalizeErr(null);
  }, [familyId]);

  const membershipApi =
    membership.error instanceof Error ? membership.error.message : "";
  const updateErr =
    updateFamily.error instanceof Error ? updateFamily.error.message : "";
  const createIndErr =
    mode === "create" && createIndividual.error instanceof Error
      ? createIndividual.error.message
      : "";

  const saveMarriageAndDivorce = useCallback(async () => {
    const marriageVal = keyFactToApiValue(marriageFact);
    const divorceVal = keyFactToApiValue(divorceFact);
    await updateFamily.mutateAsync({
      id: familyId,
      marriage: marriageVal,
      divorce: divorceVal,
      isDivorced,
    });
    await refetch();
  }, [marriageFact, divorceFact, isDivorced, updateFamily, familyId, refetch]);

  const onAddParentById = useCallback(
    async (individualId: string) => {
      await membership.mutateAsync({ action: "addParent", individualId });
      closeParentAdd();
    },
    [membership, closeParentAdd],
  );

  const onCreateParent = useCallback(async () => {
    const sx = miniParent.sex.trim().toUpperCase();
    if (!isMiniParentSexChosen(sx)) {
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
  }, [miniParent, mode, createIndividual, membership, closeParentAdd]);

  const onRemoveParent = useCallback(
    async (slot: "husband" | "wife") => {
      const label = slot === "husband" ? `${FAMILY_PARTNER_1_LABEL} (HUSB)` : `${FAMILY_PARTNER_2_LABEL} (WIFE)`;
      if (!window.confirm(`Remove ${label} from this family?`)) return;
      await membership.mutateAsync({ action: "removeParent", slot });
    },
    [membership],
  );

  const onAddChildById = useCallback(
    async (childId: string) => {
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
    },
    [childBirthOrder, childRelationshipType, membership, closeChildAdd],
  );

  const onCreateChild = useCallback(async () => {
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
  }, [miniChild, mode, createIndividual, membership, childBirthOrder, childRelationshipType, closeChildAdd]);

  const onCreateNewFamily = useCallback(async () => {
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
  }, [husband?.id, wife?.id, marriageFact, divorceFact, isDivorced, updateFamily, familyId, refetch, router]);

  const onRemoveChild = useCallback(
    async (childId: string) => {
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
    },
    [familyChildren, membership],
  );

  const pending =
    membership.isPending ||
    updateFamily.isPending ||
    (mode === "create" && createIndividual.isPending);

  const onMediaAttached = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    mode,
    familyId,
    fam,
    isLoading,
    error,
    refetch,
    husband,
    wife,
    familyChildren,
    familyNotes,
    familyMedia,
    familySources,
    linkedFamilyMediaIds,
    eventsLoading,
    eventsErr,
    events,
    paginatedEvents,
    eventPagination,
    eventPageCount,
    onEventPaginationChange,
    marriageFact,
    setMarriageFact,
    divorceFact,
    setDivorceFact,
    isDivorced,
    setIsDivorced,
    saveMarriageAndDivorce,
    xref,
    familyNewEventLabel,
    editModeFamilyTitle,
    excludeMemberIds,
    parentSexFilter,
    canAddParent,
    parentAddStep,
    setParentAddStep,
    parentSearchQ,
    setParentSearchQ,
    miniParent,
    setMiniParent,
    resetParentPanel,
    closeParentAdd,
    onAddParentById,
    onCreateParent,
    onRemoveParent,
    childAddStep,
    setChildAddStep,
    childSearchQ,
    setChildSearchQ,
    childRelationshipType,
    setChildRelationshipType,
    childBirthOrder,
    setChildBirthOrder,
    miniChild,
    setMiniChild,
    resetChildPanel,
    closeChildAdd,
    onAddChildById,
    onCreateChild,
    onRemoveChild,
    setMiniBirth,
    setMiniDeath,
    familyEditTab,
    setFamilyEditTab,
    parentSlotRulesOpen,
    setParentSlotRulesOpen,
    parentSlotRulesPanelId,
    membershipApi,
    updateErr,
    createIndErr,
    finalizeErr,
    finalizeBusy,
    onCreateNewFamily,
    pending,
    onMediaAttached,
  };
}
