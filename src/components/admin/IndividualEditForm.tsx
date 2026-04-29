"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, CaseSensitive, Cog, Image, Lightbulb, StickyNote, User, Users } from "lucide-react";
import { IndividualEditorNotesTabPanel } from "@/components/admin/individual-editor/IndividualEditorNotesTabPanel";
import { IndividualEditorMediaTabPanel } from "@/components/admin/individual-editor/IndividualEditorMediaTabPanel";
import { IndividualEditorSourcesTabPanel } from "@/components/admin/individual-editor/IndividualEditorSourcesTabPanel";
import { IndividualEditorNamesTabPanel } from "@/components/admin/individual-editor/IndividualEditorNamesTabPanel";
import { IndividualEditorEventsTabPanel } from "@/components/admin/individual-editor/IndividualEditorEventsTabPanel";
import { IndividualEditorSpouseTabPanel } from "@/components/admin/individual-editor/IndividualEditorSpouseTabPanel";
import { IndividualEditorChildTabPanel } from "@/components/admin/individual-editor/IndividualEditorChildTabPanel";
import { PersonEditorAdvancedFields } from "@/components/admin/individual-editor/PersonEditorAdvancedFields";
import { PersonEditorBasicFields } from "@/components/admin/individual-editor/PersonEditorBasicFields";
import { PersonEditorLayout } from "@/components/admin/individual-editor/PersonEditorLayout";
import { PERSON_EDITOR_NAV } from "@/components/admin/individual-editor/person-editor-nav";
import type { PersonEditorSectionId } from "@/components/admin/individual-editor/person-editor-nav";
import { PersonEditorMobileSectionSelect } from "@/components/admin/individual-editor/PersonEditorMobileSectionSelect";
import { PersonEditorMobileFormHeader } from "@/components/admin/individual-editor/PersonEditorMobileFormHeader";
import type { PersonEditorAccordionKey } from "@/components/admin/individual-editor/PersonEditorResponsiveSection";
import { PersonEditorResponsiveSection } from "@/components/admin/individual-editor/PersonEditorResponsiveSection";
import { PersonEditorSidebarNav } from "@/components/admin/individual-editor/PersonEditorSidebarNav";
import { PersonEditorStickySaveBar } from "@/components/admin/individual-editor/PersonEditorStickySaveBar";
import {
  personEditorBasicSummary,
  personEditorLifeEventsSummary,
  personEditorMediaSummary,
  personEditorNamesSummary,
  personEditorNotesSummary,
  personEditorRelationshipsSummary,
  personEditorSourcesSummary,
} from "@/components/admin/individual-editor/person-editor-mobile-summaries";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { useIndividualEditorFormState } from "@/hooks/useIndividualEditorFormState";
import { useIndividualEditorInitialJoins } from "@/hooks/useIndividualEditorInitialJoins";
import { useIndividualEditorUserLinks } from "@/hooks/useIndividualEditorUserLinks";
import { useIndividualEditorSubmit } from "@/hooks/useIndividualEditorSubmit";

type Props =
  | { mode: "create" }
  | { mode: "edit"; individualId: string; initialIndividual: Record<string, unknown>; personLabel?: string };

export function IndividualEditForm(props: Props) {
  const router = useRouter();
  const mode = props.mode;
  const individualId = mode === "edit" ? props.individualId : "";
  const initialIndividual = mode === "edit" ? props.initialIndividual : undefined;
  const personLabel = mode === "edit" ? props.personLabel?.trim() : undefined;
  const isDesktop = useMediaQueryMinLg();

  const editor = useIndividualEditorFormState({ mode, individualId, initialIndividual });
  const {
    userLinks,
    userLinksLoading,
    userLinksErrMsg,
    linkedUserIds,
    userLinkBusy,
    onRemoveUserLink,
    onAddUserLinkForEdit,
    onClearLinkPick,
    onPickUserForLink,
  } = useIndividualEditorUserLinks({
    individualId,
    xref: editor.seed.xref,
    linkUserId: editor.linkUserId,
    linkUserLabel: editor.linkUserLabel,
    setLinkUserId: editor.setLinkUserId,
    setLinkUserLabel: editor.setLinkUserLabel,
    setUserSearch: editor.setUserSearch,
  });
  const { pending, errMsg, errStatus, handleSubmit } = useIndividualEditorSubmit({
    mode,
    individualId,
    seed: editor.seed,
    linkUserId: editor.linkUserId,
  });
  const { individualNotes, individualMedia, linkedMediaIds, individualSources } =
    useIndividualEditorInitialJoins({ mode, initialIndividual });

  const [activeSection, setActiveSection] = useState<PersonEditorSectionId>("person-basic");
  const [mobileExpanded, setMobileExpanded] = useState<PersonEditorAccordionKey | null>("person-basic");

  const goToSection = useCallback((id: PersonEditorSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const onMobileToggle = useCallback((key: PersonEditorAccordionKey) => {
    setMobileExpanded((cur) => (cur === key ? null : key));
  }, []);

  const openNamesAny = useCallback(() => {
    if (isDesktop) {
      goToSection("person-names");
    } else {
      setMobileExpanded("person-names");
    }
  }, [goToSection, isDesktop]);

  useEffect(() => {
    if (!isDesktop || typeof IntersectionObserver === "undefined") return;
    const idList = PERSON_EDITOR_NAV.map((n) => n.id) as PersonEditorSectionId[];
    const obs = new IntersectionObserver(
      (entries) => {
        let best: PersonEditorSectionId | null = null;
        let bestRatio = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id as PersonEditorSectionId;
          if (!idList.includes(id)) continue;
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = id as PersonEditorSectionId;
          }
        }
        if (best != null && bestRatio >= 0.12) {
          setActiveSection(best);
        }
      },
      { root: null, rootMargin: "-10% 0px -45% 0px", threshold: [0, 0.1, 0.2, 0.35, 0.5, 0.75, 1] },
    );
    for (const id of idList) {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [isDesktop]);

  const primaryFormIndex = useMemo(() => {
    const i = editor.seed.nameForms.findIndex((r) => r.role === "primary");
    return i >= 0 ? i : 0;
  }, [editor.seed.nameForms]);

  const firstNamesDisplay = useMemo(() => {
    const row = editor.seed.nameForms[primaryFormIndex];
    return row ? row.givenNames.filter(Boolean).join(" ") : "";
  }, [editor.seed.nameForms, primaryFormIndex]);

  const lastNameDisplay = useMemo(() => {
    const row = editor.seed.nameForms[primaryFormIndex];
    return row?.surnames[0]?.text ?? "";
  }, [editor.seed.nameForms, primaryFormIndex]);

  const cancelHref = mode === "edit" ? `/admin/individuals/${individualId}` : "/admin/individuals";
  const mobileBackHref = mode === "edit" ? `/admin/individuals/${individualId}` : "/admin/individuals";
  const formTitle =
    mode === "create" ? "New person" : personLabel ? `Edit · ${personLabel}` : "Edit person";

  const basicSummary = useMemo(
    () =>
      personEditorBasicSummary({
        firstNames: firstNamesDisplay,
        lastName: lastNameDisplay,
        sex: editor.seed.sex,
        livingText: editor.livingStatus.text,
      }),
    [firstNamesDisplay, lastNameDisplay, editor.seed.sex, editor.livingStatus.text],
  );

  const namesSummary = useMemo(() => personEditorNamesSummary(editor.seed.nameForms), [editor.seed.nameForms]);
  const lifeSummary = useMemo(
    () => personEditorLifeEventsSummary(editor.seed.birth, editor.seed.death),
    [editor.seed.birth, editor.seed.death],
  );
  const relSummary = useMemo(
    () =>
      personEditorRelationshipsSummary(
        editor.seed.familiesAsChild.length,
        editor.seed.familiesAsSpouse.length,
      ),
    [editor.seed.familiesAsChild.length, editor.seed.familiesAsSpouse.length],
  );

  const advancedSummary = "GEDCOM and technical fields";

  const advancedBody = (
    <PersonEditorAdvancedFields
      mode={mode}
      sex={editor.seed.sex}
      onSexChange={(next) => editor.setSeed((s) => ({ ...s, sex: next }))}
      xrefDisplay={editor.seed.xref}
      userLinksLoading={userLinksLoading}
      userLinksErrMsg={userLinksErrMsg}
      userLinks={userLinks}
      userLinkBusy={userLinkBusy}
      onRemoveUserLink={onRemoveUserLink}
      linkedUserIds={linkedUserIds}
      userSearch={editor.userSearch}
      onUserSearchChange={editor.setUserSearch}
      linkUserId={editor.linkUserId}
      linkUserLabel={editor.linkUserLabel}
      onClearLinkPick={onClearLinkPick}
      onPickUserForLink={onPickUserForLink}
      onAddUserLinkForEdit={onAddUserLinkForEdit}
    />
  );

  const basicBody = (
    <PersonEditorBasicFields
      firstNamesDisplay={firstNamesDisplay}
      lastNameDisplay={lastNameDisplay}
      onFirstNamesChange={editor.setPrimaryGivenNamesFromJoined}
      onLastNameChange={editor.setPrimaryFirstSurnameText}
      sex={editor.seed.sex}
      onSexChange={(next) => editor.setSeed((s) => ({ ...s, sex: next }))}
      livingStatus={editor.livingStatus}
      livingMode={editor.seed.livingMode}
      onLivingModeChange={(next) => editor.setSeed((s) => ({ ...s, livingMode: next }))}
      onOpenNamesSection={openNamesAny}
    />
  );

  const namesBody = (
    <IndividualEditorNamesTabPanel
      hidden={false}
      displayPreview={editor.displayPreview}
      nameForms={editor.seed.nameForms}
      onAddNameForm={editor.addNameForm}
      onNameFormRoleChange={editor.setNameFormRole}
      onRemoveNameForm={editor.removeNameForm}
      onAddGiven={editor.addGiven}
      onSetGiven={editor.setGiven}
      onMoveGiven={editor.moveGiven}
      onRemoveGiven={editor.removeGiven}
      onAddSurname={editor.addSurname}
      onRemoveSurname={editor.removeSurname}
      onUpdateSurnameRow={editor.updateSurnameRow}
    />
  );

  const eventsBody = (
    <IndividualEditorEventsTabPanel
      hidden={false}
      omitLivingBlock
      birth={editor.seed.birth}
      onBirthChange={(next) => editor.setSeed((s) => ({ ...s, birth: next }))}
      death={editor.seed.death}
      onDeathChange={(next) => editor.setSeed((s) => ({ ...s, death: next }))}
      livingStatus={editor.livingStatus}
      livingMode={editor.seed.livingMode}
      onLivingModeChange={(next) => editor.setSeed((s) => ({ ...s, livingMode: next }))}
      individualId={individualId}
      individualNewEventLabel={editor.individualNewEventLabel}
      eventsLoading={editor.eventsLoading}
      eventsErr={editor.eventsErr}
      timelineEvents={editor.timelineEvents}
      paginatedTimelineEvents={editor.paginatedTimelineEvents}
      eventPagination={editor.eventPagination}
      eventPageCount={editor.eventPageCount}
      onEventPaginationChange={editor.onEventPaginationChange}
    />
  );

  const relationshipsBody = (
    <div className="max-lg:space-y-8 lg:space-y-10">
      <IndividualEditorChildTabPanel
        hidden={false}
        mode={mode}
        individualId={individualId}
        familiesAsChild={editor.seed.familiesAsChild}
        hasPendingNewParentsChild={editor.hasPendingNewParentsChild}
        updateChildRow={editor.updateChildRow}
        removeChildRow={editor.removeChildRow}
        addChildRow={editor.addChildRow}
        enrichChildFamilyPick={editor.enrichChildFamilyPick}
        addChildNewParentsDraftRow={editor.addChildNewParentsDraftRow}
        addChildSingleNewParentDraftRow={editor.addChildSingleNewParentDraftRow}
        childFamilySearchSlots={editor.childFamilySearchSlots}
        setChildFamilySearchSlots={editor.setChildFamilySearchSlots}
        excludedChildSpouseFamilyIds={editor.excludedChildSpouseFamilyIds}
        spouseLinkOptionsForNewParent={editor.spouseLinkOptionsForNewParent}
      />
      <div className="border-t border-base-content/10 pt-8 lg:pt-8">
        <IndividualEditorSpouseTabPanel
          hidden={false}
          mode={mode}
          individualId={individualId}
          familiesAsSpouse={editor.seed.familiesAsSpouse}
          spouseSlotHelp={editor.spouseSlotHelp}
          spouseFamiliesNeedSex={editor.spouseFamiliesNeedSex}
          hasPendingNewSpouseFamily={editor.hasPendingNewSpouseFamily}
          hasPendingSpouseFamilyChildAdds={editor.hasPendingSpouseFamilyChildAdds}
          removeSpouseRow={editor.removeSpouseRow}
          updateSpouseRow={editor.updateSpouseRow}
          addSpouseRow={editor.addSpouseRow}
          enrichSpouseFamilyRow={editor.enrichSpouseFamilyRow}
          addSpouseNewFamilyExisting={editor.addSpouseNewFamilyExisting}
          addSpouseNewFamilyNewPersonRow={editor.addSpouseNewFamilyNewPersonRow}
          spouseFamilySearchSlots={editor.spouseFamilySearchSlots}
          setSpouseFamilySearchSlots={editor.setSpouseFamilySearchSlots}
          spouseNewFamilyExistingSearchSlots={editor.spouseNewFamilyExistingSearchSlots}
          setSpouseNewFamilyExistingSearchSlots={editor.setSpouseNewFamilyExistingSearchSlots}
          spouseAddChildExistingSearch={editor.spouseAddChildExistingSearch}
          setSpouseAddChildExistingSearch={editor.setSpouseAddChildExistingSearch}
          excludedChildSpouseFamilyIds={editor.excludedChildSpouseFamilyIds}
          excludedSpousePartnerIndividualIds={editor.excludedSpousePartnerIndividualIds}
        />
      </div>
    </div>
  );

  const notesBody = (
    <IndividualEditorNotesTabPanel
      hidden={false}
      noCardShell
      mode={mode}
      individualId={individualId}
      individualNewEventLabel={editor.individualNewEventLabel}
      individualNotes={individualNotes}
    />
  );

  const mediaBody = (
    <IndividualEditorMediaTabPanel
      hidden={false}
      noCardShell
      mode={mode}
      individualId={individualId}
      individualNewEventLabel={editor.individualNewEventLabel}
      linkedMediaIds={linkedMediaIds}
      individualMedia={individualMedia}
      onMediaAttached={() => {
        router.refresh();
      }}
    />
  );

  const sourcesBody = (
    <IndividualEditorSourcesTabPanel
      hidden={false}
      noCardShell
      mode={mode}
      individualSources={individualSources}
    />
  );

  const allSections = (desktop: boolean) => (
    <>
      <PersonEditorResponsiveSection
        id="person-basic"
        sectionKey="person-basic"
        title="Basic information"
        description="The essentials: how we display and classify this person."
        icon={User}
        summary={basicSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {basicBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-names"
        sectionKey="person-names"
        title="Names"
        description="Primary label plus any alternate names."
        icon={CaseSensitive}
        summary={namesSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {namesBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-events"
        sectionKey="person-events"
        title="Life events"
        description="Birth, death, and the rest of their timeline."
        icon={CalendarDays}
        summary={lifeSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {eventsBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-relationships"
        sectionKey="person-relationships"
        title="Relationships"
        description="Parents, partners, and children in the family tree."
        icon={Users}
        summary={relSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {relationshipsBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-notes"
        sectionKey="person-notes"
        title="Notes"
        description="Research notes and narratives."
        icon={StickyNote}
        summary={personEditorNotesSummary(individualNotes.length)}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {notesBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-media"
        sectionKey="person-media"
        title="Media"
        description="Photos and documents linked to this person."
        icon={Image}
        summary={personEditorMediaSummary(individualMedia.length)}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {mediaBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-sources"
        sectionKey="person-sources"
        title="Sources"
        description="Where facts about this person come from."
        icon={BookOpen}
        summary={personEditorSourcesSummary(individualSources.length)}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {sourcesBody}
      </PersonEditorResponsiveSection>
      <PersonEditorResponsiveSection
        id="person-advanced"
        sectionKey="person-advanced"
        title="Advanced details"
        description="Record ids, imports, and linked logins."
        icon={Cog}
        summary={advancedSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {advancedBody}
      </PersonEditorResponsiveSection>
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="w-full pb-32">
      {errMsg ? (
        <p className="mb-6 text-sm text-destructive" role="alert">
          {errMsg}
          {errStatus ? ` (HTTP ${errStatus})` : ""}
        </p>
      ) : null}

      {isDesktop ? (
        <PersonEditorLayout
          mobileNav={
            <PersonEditorMobileSectionSelect
              items={PERSON_EDITOR_NAV}
              value={activeSection}
              onChange={(id) => goToSection(id)}
            />
          }
          sidebar={<PersonEditorSidebarNav items={PERSON_EDITOR_NAV} activeId={activeSection} onSelect={goToSection} />}
        >
          {allSections(true)}
          <div className="flex gap-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p>
              <span className="font-medium">Tip:</span> You can save with the essentials and come back later for notes,
              media, and sources.
            </p>
          </div>
        </PersonEditorLayout>
      ) : (
        <div className="space-y-3">
          <PersonEditorMobileFormHeader title={formTitle} backHref={mobileBackHref} />
          {allSections(false)}
        </div>
      )}

      <PersonEditorStickySaveBar mode={mode} pending={pending} cancelHref={cancelHref} />
    </form>
  );
}
