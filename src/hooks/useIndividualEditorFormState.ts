"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaginationState, Updater } from "@tanstack/react-table";
import type {
  ChildFamilySearchSlot,
  SpouseFamilySearchSlot,
  SpouseNewFamilyExistingSearchSlot,
} from "@/components/admin/individual-editor/individual-family-editor-slots";
import type { ChildFamilyParentPickLabels } from "@/components/admin/individual-editor/individual-family-search-types";
import type { IndividualEditorTab } from "@/components/admin/individual-editor/individual-editor-types";
import {
  emptyIndividualEditorFormSeed,
  familyChildrenToSummaries,
  individualDetailToFormSeed,
  keyFactToApiValue,
  newEmptyNameFormEditorRow,
  previewFullNameFromParts,
  spouseFamilyRowFromFamilyRecord,
  type ChildFamilyFormRow,
  type ChildInFamilySummary,
  type IndividualEditorFormSeed,
  type NameFormRole,
  type SpouseFamilyFormRow,
  type SurnameFormRow,
} from "@/lib/forms/individual-editor-form";
import { FAMILY_PARTNER_1_LABEL, FAMILY_PARTNER_2_LABEL } from "@/lib/gedcom/family-partner-slots";
import { fetchJson } from "@/lib/infra/api";
import { INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE } from "@/constants/admin";
import type { IndividualDetailEvent } from "@/lib/detail/individual-detail-events";
import { useAdminIndividualEvents } from "@/hooks/useAdminIndividuals";

const STABLE_EMPTY_TIMELINE_EVENTS: IndividualDetailEvent[] = [];

function parseYm(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export type UseIndividualEditorFormStateArgs = {
  mode: "create" | "edit";
  individualId: string;
  initialIndividual: Record<string, unknown> | undefined;
};

function useIndividualEditorUiState() {
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

  return {
    spouseFamilySearchSlots,
    setSpouseFamilySearchSlots,
    spouseNewFamilyExistingSearchSlots,
    setSpouseNewFamilyExistingSearchSlots,
    spouseAddChildExistingSearch,
    setSpouseAddChildExistingSearch,
    childFamilySearchSlots,
    setChildFamilySearchSlots,
    userSearch,
    setUserSearch,
    linkUserId,
    setLinkUserId,
    linkUserLabel,
    setLinkUserLabel,
    editorTab,
    setEditorTab,
  };
}

function useIndividualEditorEventsState(individualId: string) {
  const { data: eventsRes, isLoading: eventsLoading, error: eventsError } = useAdminIndividualEvents(individualId);
  const timelineEvents = eventsRes?.events != null ? eventsRes.events : STABLE_EMPTY_TIMELINE_EVENTS;
  const eventsErr = eventsError ? "Events could not be loaded." : null;

  const [eventPagination, setEventPagination] = useState<PaginationState>(() => ({
    pageIndex: 0,
    pageSize: INDIVIDUAL_DETAIL_EVENTS_PAGE_SIZE,
  }));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- reset pagination when switching individuals */
    setEventPagination((p) => ({ ...p, pageIndex: 0 }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [individualId]);

  const eventPageCount = Math.max(1, Math.ceil(timelineEvents.length / eventPagination.pageSize));

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- clamp page index when event list shrinks */
    if (eventPagination.pageIndex >= eventPageCount) {
      setEventPagination((p) => ({ ...p, pageIndex: Math.max(0, eventPageCount - 1) }));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [eventPageCount, eventPagination.pageIndex]);

  const paginatedTimelineEvents = useMemo(() => {
    const { pageIndex, pageSize } = eventPagination;
    return timelineEvents.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }, [timelineEvents, eventPagination]);

  const onEventPaginationChange = useCallback((updater: Updater<PaginationState>) => {
    setEventPagination((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  return {
    eventsLoading,
    eventsErr,
    timelineEvents,
    paginatedTimelineEvents,
    eventPagination,
    eventPageCount,
    onEventPaginationChange,
  };
}

function useIndividualEditorDerivedState(seed: IndividualEditorFormSeed, individualId: string, mode: "create" | "edit") {
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

  const individualNewEventLabel = useMemo(() => {
    const x = seed.xref.trim();
    if (x) return x;
    return displayPreview.trim() || individualId || "Individual";
  }, [seed.xref, displayPreview, individualId]);

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
  const hasPendingSpouseFamilyChildAdds = seed.familiesAsSpouse.some(
    (r) => (r.pendingSpouseFamilyChildren?.length ?? 0) > 0,
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

  return {
    displayPreview,
    individualNewEventLabel,
    excludedSpousePartnerIndividualIds,
    excludedChildSpouseFamilyIds,
    livingStatus,
    spouseSlotHelp,
    hasPendingNewSpouseFamily,
    hasPendingSpouseFamilyChildAdds,
    hasPendingNewParentsChild,
    spouseFamiliesNeedSex,
  };
}

export function useIndividualEditorFormState({
  mode,
  individualId,
  initialIndividual,
}: UseIndividualEditorFormStateArgs) {
  const [seed, setSeed] = useState<IndividualEditorFormSeed>(() =>
    mode === "edit" && initialIndividual
      ? individualDetailToFormSeed(initialIndividual)
      : emptyIndividualEditorFormSeed(),
  );

  const {
    spouseFamilySearchSlots,
    setSpouseFamilySearchSlots,
    spouseNewFamilyExistingSearchSlots,
    setSpouseNewFamilyExistingSearchSlots,
    spouseAddChildExistingSearch,
    setSpouseAddChildExistingSearch,
    childFamilySearchSlots,
    setChildFamilySearchSlots,
    userSearch,
    setUserSearch,
    linkUserId,
    setLinkUserId,
    linkUserLabel,
    setLinkUserLabel,
    editorTab,
    setEditorTab,
  } = useIndividualEditorUiState();

  const syncedIndividualIdRef = useRef<string | null>(null);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- sync local editor state to server props when `individualId` changes */
    if (mode !== "edit" || !initialIndividual) return;
    if (syncedIndividualIdRef.current === individualId) return;
    syncedIndividualIdRef.current = individualId;
    setSeed(individualDetailToFormSeed(initialIndividual));
    setChildFamilySearchSlots([]);
    setSpouseFamilySearchSlots([]);
    setSpouseNewFamilyExistingSearchSlots([]);
    setSpouseAddChildExistingSearch(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    mode,
    individualId,
    initialIndividual,
    setChildFamilySearchSlots,
    setSpouseFamilySearchSlots,
    setSpouseNewFamilyExistingSearchSlots,
    setSpouseAddChildExistingSearch,
  ]);

  const {
    eventsLoading,
    eventsErr,
    timelineEvents,
    paginatedTimelineEvents,
    eventPagination,
    eventPageCount,
    onEventPaginationChange,
  } = useIndividualEditorEventsState(individualId);
  const {
    displayPreview,
    individualNewEventLabel,
    excludedSpousePartnerIndividualIds,
    excludedChildSpouseFamilyIds,
    livingStatus,
    spouseSlotHelp,
    hasPendingNewSpouseFamily,
    hasPendingSpouseFamilyChildAdds,
    hasPendingNewParentsChild,
    spouseFamiliesNeedSex,
  } = useIndividualEditorDerivedState(seed, individualId, mode);

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
  const enrichSpouseFamilyRow = useCallback(async (familyId: string) => {
    let extra: Partial<Omit<SpouseFamilyFormRow, "familyId">> | undefined;
    try {
      const data = await fetchJson<{ family: Record<string, unknown> }>(`/api/admin/families/${familyId}`);
      const built = spouseFamilyRowFromFamilyRecord(familyId, data.family);
      const { familyId: builtFamilyId, ...rest } = built;
      void builtFamilyId;
      extra = rest;
    } catch {
      /* row is family id only */
    }
    return extra;
  }, []);

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
  const enrichChildFamilyPick = useCallback(
    async (familyId: string, labels: ChildFamilyParentPickLabels) => {
      let children: ChildInFamilySummary[] | undefined;
      let mergedLabels: ChildFamilyParentPickLabels = { ...labels };
      try {
        const data = await fetchJson<{ family: Record<string, unknown> }>(`/api/admin/families/${familyId}`);
        const fam = data.family;
        children = familyChildrenToSummaries(fam?.familyChildren);
        const h = fam?.husband as Record<string, unknown> | null | undefined;
        const w = fam?.wife as Record<string, unknown> | null | undefined;
        if (h && typeof h.id === "string") mergedLabels = { ...mergedLabels, husbandId: h.id };
        if (w && typeof w.id === "string") mergedLabels = { ...mergedLabels, wifeId: w.id };
      } catch {
        /* roster / parent ids may be incomplete; picker still sent labels */
      }
      return { mergedLabels, children };
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

  return {
    seed,
    setSeed,
    editorTab,
    setEditorTab,
    spouseFamilySearchSlots,
    setSpouseFamilySearchSlots,
    spouseNewFamilyExistingSearchSlots,
    setSpouseNewFamilyExistingSearchSlots,
    spouseAddChildExistingSearch,
    setSpouseAddChildExistingSearch,
    childFamilySearchSlots,
    setChildFamilySearchSlots,
    userSearch,
    setUserSearch,
    linkUserId,
    setLinkUserId,
    linkUserLabel,
    setLinkUserLabel,
    displayPreview,
    eventsLoading,
    eventsErr,
    timelineEvents,
    paginatedTimelineEvents,
    eventPagination,
    eventPageCount,
    onEventPaginationChange,
    individualNewEventLabel,
    livingStatus,
    setNameFormRole,
    addNameForm,
    removeNameForm,
    setGiven,
    updateSurnameRow,
    addGiven,
    moveGiven,
    removeGiven,
    addSurname,
    removeSurname,
    addSpouseRow,
    enrichSpouseFamilyRow,
    addSpouseNewFamilyExisting,
    addSpouseNewFamilyNewPersonRow,
    excludedSpousePartnerIndividualIds,
    updateSpouseRow,
    removeSpouseRow,
    excludedChildSpouseFamilyIds,
    addChildRow,
    enrichChildFamilyPick,
    addChildNewParentsDraftRow,
    updateChildRow,
    removeChildRow,
    spouseSlotHelp,
    hasPendingNewSpouseFamily,
    hasPendingSpouseFamilyChildAdds,
    hasPendingNewParentsChild,
    spouseFamiliesNeedSex,
  };
}
