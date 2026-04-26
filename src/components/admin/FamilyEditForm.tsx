"use client";

import Link from "next/link";
import { DetailPageShell } from "@/components/admin/DetailPageShell";
import { FamilyEditorTabBar } from "@/components/admin/family-editor/FamilyEditorTabBar";
import { FamilyEditorEventsTabPanel } from "@/components/admin/family-editor/FamilyEditorEventsTabPanel";
import { FamilyEditorParentsTabPanel } from "@/components/admin/family-editor/FamilyEditorParentsTabPanel";
import { FamilyEditorChildrenTabPanel } from "@/components/admin/family-editor/FamilyEditorChildrenTabPanel";
import { FamilyEditorNotesTabPanel } from "@/components/admin/family-editor/FamilyEditorNotesTabPanel";
import { FamilyEditorMediaTabPanel } from "@/components/admin/family-editor/FamilyEditorMediaTabPanel";
import { FamilyEditorSourcesTabPanel } from "@/components/admin/family-editor/FamilyEditorSourcesTabPanel";
import { Button } from "@/components/ui/button";
import { useFamilyEditorState } from "@/hooks/useFamilyEditorState";

export function FamilyEditForm({
  familyId,
  mode = "edit",
}: {
  familyId: string;
  /** `create`: add flow (e.g. `/admin/families/create`); omits parent-based edit title and XREF line. */
  mode?: "create" | "edit";
}) {
  const e = useFamilyEditorState({ familyId, mode });

  return (
    <DetailPageShell
      backHref="/admin/families"
      backLabel="Families"
      isLoading={e.isLoading}
      error={e.error}
      data={e.fam}
      notFoundMessage="Could not load this family."
      fullWidth
    >
      <header className="space-y-2 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {e.mode === "create" ? "Add New Family" : e.editModeFamilyTitle}
        </h1>
        {e.mode === "create" ? (
          <p className="text-sm text-muted-foreground">Add partners, children, and events below.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            XREF <span className="font-mono text-xs">{e.xref || "—"}</span>
            {" · "}
            <Link href={`/admin/families/${e.familyId}`} className="link link-primary font-medium">
              View family
            </Link>
          </p>
        )}
      </header>

      {(e.membershipApi || e.updateErr || e.createIndErr) && (
        <p className="text-sm text-destructive">{e.membershipApi || e.updateErr || e.createIndErr}</p>
      )}

      <FamilyEditorTabBar
        activeTab={e.familyEditTab}
        onTabChange={e.setFamilyEditTab}
        childrenCount={e.familyChildren.length}
        notesCount={e.familyNotes.length}
        mediaCount={e.familyMedia.length}
        sourcesCount={e.familySources.length}
      />

      <FamilyEditorEventsTabPanel
        hidden={e.familyEditTab !== "events"}
        mode={e.mode}
        marriageFact={e.marriageFact}
        setMarriageFact={e.setMarriageFact}
        divorceFact={e.divorceFact}
        setDivorceFact={e.setDivorceFact}
        isDivorced={e.isDivorced}
        setIsDivorced={e.setIsDivorced}
        onSaveMarriageAndDivorce={e.saveMarriageAndDivorce}
        saveMarriageDisabled={e.pending}
        familyId={e.familyId}
        familyNewEventLabel={e.familyNewEventLabel}
        eventsLoading={e.eventsLoading}
        eventsErr={e.eventsErr}
        events={e.events}
        paginatedEvents={e.paginatedEvents}
        eventPagination={e.eventPagination}
        eventPageCount={e.eventPageCount}
        onEventPaginationChange={e.onEventPaginationChange}
      />

      <FamilyEditorParentsTabPanel
        hidden={e.familyEditTab !== "parents"}
        mode={e.mode}
        husband={e.husband}
        wife={e.wife}
        pending={e.pending}
        onRemoveParent={e.onRemoveParent}
        canAddParent={e.canAddParent}
        parentSlotRulesOpen={e.parentSlotRulesOpen}
        setParentSlotRulesOpen={e.setParentSlotRulesOpen}
        parentSlotRulesPanelId={e.parentSlotRulesPanelId}
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

      <FamilyEditorChildrenTabPanel
        hidden={e.familyEditTab !== "children"}
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

      <FamilyEditorNotesTabPanel
        hidden={e.familyEditTab !== "notes"}
        mode={e.mode}
        familyId={e.familyId}
        familyNewEventLabel={e.familyNewEventLabel}
        familyNotes={e.familyNotes}
      />

      <FamilyEditorMediaTabPanel
        hidden={e.familyEditTab !== "media"}
        mode={e.mode}
        familyId={e.familyId}
        familyNewEventLabel={e.familyNewEventLabel}
        linkedFamilyMediaIds={e.linkedFamilyMediaIds}
        familyMedia={e.familyMedia}
        onMediaAttached={e.onMediaAttached}
      />

      <FamilyEditorSourcesTabPanel hidden={e.familyEditTab !== "sources"} familySources={e.familySources} />

      {e.mode === "create" ? (
        <div className="sticky bottom-0 z-10 mt-8 border-t border-base-content/[0.08] bg-background pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Requires at least one parent (Partner 1 or Partner 2). Saves marriage/divorce fields and opens the family
              editor.
            </p>
            <Button
              type="button"
              className="w-full shrink-0 sm:w-auto"
              disabled={e.pending || e.finalizeBusy}
              onClick={() => void e.onCreateNewFamily()}
            >
              {e.finalizeBusy ? "Saving…" : "Create new family"}
            </Button>
          </div>
          {e.finalizeErr ? (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {e.finalizeErr}
            </p>
          ) : null}
        </div>
      ) : null}
    </DetailPageShell>
  );
}
