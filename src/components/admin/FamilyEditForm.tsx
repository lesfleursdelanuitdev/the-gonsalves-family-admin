"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { FamilyEditorAdvancedFamilyPanel } from "@/components/admin/family-editor/FamilyEditorAdvancedFamilyPanel";
import { FamilyEditorChildrenTabPanel } from "@/components/admin/family-editor/FamilyEditorChildrenTabPanel";
import { FamilyEditorEventsTabPanel } from "@/components/admin/family-editor/FamilyEditorEventsTabPanel";
import { FamilyEditorMediaTabPanel } from "@/components/admin/family-editor/FamilyEditorMediaTabPanel";
import { FamilyEditorMobileSectionSelect } from "@/components/admin/family-editor/FamilyEditorMobileSectionSelect";
import { FamilyEditorNotesTabPanel } from "@/components/admin/family-editor/FamilyEditorNotesTabPanel";
import { FamilyEditorParentsTabPanel } from "@/components/admin/family-editor/FamilyEditorParentsTabPanel";
import { FAMILY_EDITOR_NAV, type FamilyEditorSectionId } from "@/components/admin/family-editor/family-editor-nav";
import {
  familyEditorChildrenSummary,
  familyEditorMediaSummary,
  familyEditorNotesSummary,
  familyEditorPartnersSummary,
  familyEditorSourcesSummary,
  familyEditorTimelineSummary,
} from "@/components/admin/family-editor/family-editor-mobile-summaries";
import type { FamilyEditorAccordionKey } from "@/components/admin/family-editor/FamilyEditorResponsiveSection";
import { FamilyEditorResponsiveSection } from "@/components/admin/family-editor/FamilyEditorResponsiveSection";
import { FamilyEditorSidebarNav } from "@/components/admin/family-editor/FamilyEditorSidebarNav";
import { FamilyEditorSourcesTabPanel } from "@/components/admin/family-editor/FamilyEditorSourcesTabPanel";
import { FamilyEditorStickySaveBar } from "@/components/admin/family-editor/FamilyEditorStickySaveBar";
import { PersonEditorLayout } from "@/components/admin/individual-editor/PersonEditorLayout";
import { PersonEditorMobileFormHeader } from "@/components/admin/individual-editor/PersonEditorMobileFormHeader";
import { buttonVariants } from "@/components/ui/button";
import { useFamilyEditorState } from "@/hooks/useFamilyEditorState";
import { useMediaQueryMinLg } from "@/hooks/useMediaQueryMinLg";
import { cn } from "@/lib/utils";

export function FamilyEditForm({
  familyId,
  mode = "edit",
}: {
  familyId: string;
  /** `create`: add flow (e.g. `/admin/families/create`); omits parent-based edit title and XREF line. */
  mode?: "create" | "edit";
}) {
  const e = useFamilyEditorState({ familyId, mode });
  const isDesktop = useMediaQueryMinLg();
  const [activeSection, setActiveSection] = useState<FamilyEditorSectionId>("family-partners");
  const [mobileExpanded, setMobileExpanded] = useState<FamilyEditorAccordionKey | null>("family-partners");

  const goToSection = useCallback((id: FamilyEditorSectionId) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const onMobileToggle = useCallback((key: FamilyEditorAccordionKey) => {
    setMobileExpanded((cur) => (cur === key ? null : key));
  }, []);

  useEffect(() => {
    if (!isDesktop || typeof IntersectionObserver === "undefined") return;
    const idList = FAMILY_EDITOR_NAV.map((n) => n.id) as FamilyEditorSectionId[];
    const obs = new IntersectionObserver(
      (entries) => {
        let best: FamilyEditorSectionId | null = null;
        let bestRatio = 0;
        for (const ent of entries) {
          if (!ent.isIntersecting) continue;
          const id = ent.target.id as FamilyEditorSectionId;
          if (!idList.includes(id)) continue;
          if (ent.intersectionRatio > bestRatio) {
            bestRatio = ent.intersectionRatio;
            best = id;
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

  const partnersSummary = useMemo(
    () => familyEditorPartnersSummary(e.husband, e.wife),
    [e.husband, e.wife],
  );
  const timelineSummary = useMemo(
    () => familyEditorTimelineSummary(e.marriageFact, e.divorceFact),
    [e.marriageFact, e.divorceFact],
  );
  const childrenSummary = useMemo(() => familyEditorChildrenSummary(e.familyChildren), [e.familyChildren]);
  const notesSummary = useMemo(() => familyEditorNotesSummary(e.familyNotes.length), [e.familyNotes.length]);
  const mediaSummary = useMemo(() => familyEditorMediaSummary(e.familyMedia.length), [e.familyMedia.length]);
  const sourcesSummary = useMemo(() => familyEditorSourcesSummary(e.familySources.length), [e.familySources.length]);
  const advancedSummary = "GEDCOM and technical fields";

  const cancelHref = e.mode === "edit" ? `/admin/families/${e.familyId}` : "/admin/families";
  const mobileBackHref = e.mode === "edit" ? `/admin/families/${e.familyId}` : "/admin/families";
  const mobileTitle = e.mode === "create" ? "Add new family" : "Edit family";

  const onStickySave = useCallback(async () => {
    if (e.mode === "create") {
      await e.onCreateNewFamily();
      return;
    }
    try {
      await e.saveMarriageAndDivorce();
      toast.success("Family saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save family.");
    }
  }, [e]);

  const desktopHeader = (
    <header className="space-y-3 border-b border-base-content/10 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {e.mode === "create" ? "Add new family" : "Edit family"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {e.mode === "create"
              ? "Add partners, children, and events for this new relationship."
              : "Edit details about this relationship and their children."}
          </p>
          {e.mode === "edit" ? (
            <p className="text-sm text-foreground">
              {e.editModeFamilyTitle}
              {e.xref?.trim() ? (
                <>
                  {" "}
                  <span className="font-mono text-xs text-muted-foreground">({e.xref.trim()})</span>
                </>
              ) : null}
              {" · "}
              <Link href={`/admin/families/${e.familyId}`} className="link link-primary font-medium">
                View family
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/admin/individuals"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-primary hover:text-primary/90")}
          >
            View tree
          </Link>
        </div>
      </div>
    </header>
  );

  const partnersBody = (
    <FamilyEditorParentsTabPanel
      mode={e.mode}
      husband={e.husband}
      wife={e.wife}
      pending={e.pending}
      onRemoveParent={e.onRemoveParent}
      canAddParent={e.canAddParent}
      parentAddStep={e.parentAddStep}
      setParentAddStep={e.setParentAddStep}
      parentSearchQ={e.parentSearchQ}
      setParentSearchQ={e.setParentSearchQ}
      miniParent={e.miniParent}
      setMiniParent={e.setMiniParent}
      resetParentPanel={e.resetParentPanel}
      closeParentAdd={e.closeParentAdd}
      onAddParentById={e.onAddParentById}
      onCreateParent={e.onCreateParent}
      excludeMemberIds={e.excludeMemberIds}
      parentSexFilter={e.parentSexFilter}
      setMiniBirth={e.setMiniBirth}
      setMiniDeath={e.setMiniDeath}
    />
  );

  const timelineBody = (
    <FamilyEditorEventsTabPanel
      mode={e.mode}
      marriageFact={e.marriageFact}
      setMarriageFact={e.setMarriageFact}
      divorceFact={e.divorceFact}
      setDivorceFact={e.setDivorceFact}
      isDivorced={e.isDivorced}
      familyId={e.familyId}
      familyNewEventLabel={e.familyNewEventLabel}
    />
  );

  const childrenBody = (
    <FamilyEditorChildrenTabPanel
      mode={e.mode}
      familyChildren={e.familyChildren}
      pending={e.pending}
      onRemoveChild={e.onRemoveChild}
      childAddStep={e.childAddStep}
      setChildAddStep={e.setChildAddStep}
      childSearchQ={e.childSearchQ}
      setChildSearchQ={e.setChildSearchQ}
      childRelationshipType={e.childRelationshipType}
      setChildRelationshipType={e.setChildRelationshipType}
      childBirthOrder={e.childBirthOrder}
      setChildBirthOrder={e.setChildBirthOrder}
      miniChild={e.miniChild}
      setMiniChild={e.setMiniChild}
      resetChildPanel={e.resetChildPanel}
      closeChildAdd={e.closeChildAdd}
      onAddChildById={e.onAddChildById}
      onCreateChild={e.onCreateChild}
      excludeMemberIds={e.excludeMemberIds}
      setMiniBirth={e.setMiniBirth}
      setMiniDeath={e.setMiniDeath}
    />
  );

  const notesBody = (
    <FamilyEditorNotesTabPanel
      mode={e.mode}
      familyId={e.familyId}
      familyNewEventLabel={e.familyNewEventLabel}
      familyNotes={e.familyNotes}
    />
  );

  const mediaBody = (
    <FamilyEditorMediaTabPanel
      mode={e.mode}
      familyId={e.familyId}
      familyNewEventLabel={e.familyNewEventLabel}
      linkedFamilyMediaIds={e.linkedFamilyMediaIds}
      familyMedia={e.familyMedia}
      onMediaAttached={e.onMediaAttached}
    />
  );

  const sourcesBody = <FamilyEditorSourcesTabPanel mode={e.mode} familySources={e.familySources} />;

  const advancedBody = (
    <FamilyEditorAdvancedFamilyPanel
      mode={e.mode}
      xref={e.xref}
      familyId={e.familyId}
      isDivorced={e.isDivorced}
      setIsDivorced={e.setIsDivorced}
      parentSlotRulesOpen={e.parentSlotRulesOpen}
      setParentSlotRulesOpen={e.setParentSlotRulesOpen}
      parentSlotRulesPanelId={e.parentSlotRulesPanelId}
      eventsLoading={e.eventsLoading}
      eventsErr={e.eventsErr}
      events={e.events}
      paginatedEvents={e.paginatedEvents}
      eventPagination={e.eventPagination}
      eventPageCount={e.eventPageCount}
      onEventPaginationChange={e.onEventPaginationChange}
    />
  );

  const allSections = (desktop: boolean) => (
    <>
      <FamilyEditorResponsiveSection
        id="family-partners"
        sectionKey="family-partners"
        title="Partners"
        description="The people in this relationship."
        icon={FAMILY_EDITOR_NAV[0]!.icon}
        summary={partnersSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {partnersBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-timeline"
        sectionKey="family-timeline"
        title="Relationship timeline"
        description="Marriage, divorce, and custom events."
        icon={FAMILY_EDITOR_NAV[1]!.icon}
        summary={timelineSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {timelineBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-children"
        sectionKey="family-children"
        title="Children"
        description="Children linked to this relationship."
        icon={FAMILY_EDITOR_NAV[2]!.icon}
        summary={childrenSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {childrenBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-notes"
        sectionKey="family-notes"
        title="Notes"
        description="Notes about this family."
        icon={FAMILY_EDITOR_NAV[3]!.icon}
        summary={notesSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {notesBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-media"
        sectionKey="family-media"
        title="Media"
        description="Photos and documents."
        icon={FAMILY_EDITOR_NAV[4]!.icon}
        summary={mediaSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {mediaBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-sources"
        sectionKey="family-sources"
        title="Sources"
        description="Source citations for this family."
        icon={FAMILY_EDITOR_NAV[5]!.icon}
        summary={sourcesSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {sourcesBody}
      </FamilyEditorResponsiveSection>
      <FamilyEditorResponsiveSection
        id="family-advanced"
        sectionKey="family-advanced"
        title="Advanced details"
        description="GEDCOM identifiers, flags, and other events."
        icon={FAMILY_EDITOR_NAV[6]!.icon}
        summary={advancedSummary}
        isDesktop={desktop}
        mobileExpanded={mobileExpanded}
        onMobileToggle={onMobileToggle}
      >
        {advancedBody}
      </FamilyEditorResponsiveSection>
    </>
  );

  return (
    <DetailPageShell
      backHref="/admin/families"
      backLabel="Back to families"
      isLoading={e.isLoading}
      error={e.error}
      data={e.fam}
      notFoundMessage="Could not load this family."
      fullWidth
      hideBackLink={!isDesktop && Boolean(e.fam)}
    >
      <div className="w-full pb-32">
        {(e.membershipApi || e.updateErr || e.createIndErr) && (
          <p className="mb-4 text-sm text-destructive">{e.membershipApi || e.updateErr || e.createIndErr}</p>
        )}

        {isDesktop ? desktopHeader : null}

        {isDesktop ? (
          <PersonEditorLayout
            mobileNav={
              <FamilyEditorMobileSectionSelect items={FAMILY_EDITOR_NAV} value={activeSection} onChange={goToSection} />
            }
            sidebar={
              <FamilyEditorSidebarNav items={FAMILY_EDITOR_NAV} activeId={activeSection} onSelect={goToSection} />
            }
          >
            {allSections(true)}
          </PersonEditorLayout>
        ) : (
          <div className="space-y-3">
            <PersonEditorMobileFormHeader title={mobileTitle} backHref={mobileBackHref} treeHref="/admin/individuals" />
            {e.mode === "create" ? (
              <p className="text-sm text-muted-foreground">
                Add partners, children, and events for this new relationship.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Edit details about this relationship and their children.</p>
            )}
            {allSections(false)}
          </div>
        )}

        {e.finalizeErr ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {e.finalizeErr}
          </p>
        ) : null}

        <FamilyEditorStickySaveBar
          mode={e.mode}
          pending={e.pending}
          finalizeBusy={e.finalizeBusy}
          cancelHref={cancelHref}
          onSave={onStickySave}
        />
      </div>
    </DetailPageShell>
  );
}
