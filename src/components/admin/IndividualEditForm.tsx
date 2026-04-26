"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { IndividualEditorTabBar } from "@/components/admin/individual-editor/IndividualEditorTabBar";
import { IndividualEditorNotesTabPanel } from "@/components/admin/individual-editor/IndividualEditorNotesTabPanel";
import { IndividualEditorMediaTabPanel } from "@/components/admin/individual-editor/IndividualEditorMediaTabPanel";
import { IndividualEditorSourcesTabPanel } from "@/components/admin/individual-editor/IndividualEditorSourcesTabPanel";
import { IndividualEditorIdentityTabPanel } from "@/components/admin/individual-editor/IndividualEditorIdentityTabPanel";
import { IndividualEditorNamesTabPanel } from "@/components/admin/individual-editor/IndividualEditorNamesTabPanel";
import { IndividualEditorEventsTabPanel } from "@/components/admin/individual-editor/IndividualEditorEventsTabPanel";
import { IndividualEditorSpouseTabPanel } from "@/components/admin/individual-editor/IndividualEditorSpouseTabPanel";
import { IndividualEditorChildTabPanel } from "@/components/admin/individual-editor/IndividualEditorChildTabPanel";
import { useIndividualEditorFormState } from "@/hooks/useIndividualEditorFormState";
import { useIndividualEditorInitialJoins } from "@/hooks/useIndividualEditorInitialJoins";
import { useIndividualEditorUserLinks } from "@/hooks/useIndividualEditorUserLinks";
import { useIndividualEditorSubmit } from "@/hooks/useIndividualEditorSubmit";

type Props =
  | { mode: "create" }
  | { mode: "edit"; individualId: string; initialIndividual: Record<string, unknown> };

export function IndividualEditForm(props: Props) {
  const router = useRouter();
  const mode = props.mode;
  const individualId = mode === "edit" ? props.individualId : "";
  const initialIndividual = mode === "edit" ? props.initialIndividual : undefined;

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

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-8">
      {errMsg ? (
        <p className="text-sm text-destructive" role="alert">
          {errMsg}
          {errStatus ? ` (HTTP ${errStatus})` : ""}
        </p>
      ) : null}

      <IndividualEditorTabBar
        activeTab={editor.editorTab}
        onTabChange={editor.setEditorTab}
        spouseFamilyCount={editor.seed.familiesAsSpouse.length}
        childFamilyCount={editor.seed.familiesAsChild.length}
        notesCount={individualNotes.length}
        mediaCount={individualMedia.length}
        sourcesCount={individualSources.length}
      />

      <IndividualEditorIdentityTabPanel
        hidden={editor.editorTab !== "identity"}
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

      <IndividualEditorNamesTabPanel
        hidden={editor.editorTab !== "names"}
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

      <IndividualEditorEventsTabPanel
        hidden={editor.editorTab !== "events"}
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

      <IndividualEditorSpouseTabPanel
        hidden={editor.editorTab !== "spouse"}
        mode={mode}
        individualId={individualId}
        pending={pending}
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

      <IndividualEditorChildTabPanel
        hidden={editor.editorTab !== "child"}
        mode={mode}
        individualId={individualId}
        pending={pending}
        familiesAsChild={editor.seed.familiesAsChild}
        hasPendingNewParentsChild={editor.hasPendingNewParentsChild}
        updateChildRow={editor.updateChildRow}
        removeChildRow={editor.removeChildRow}
        addChildRow={editor.addChildRow}
        enrichChildFamilyPick={editor.enrichChildFamilyPick}
        addChildNewParentsDraftRow={editor.addChildNewParentsDraftRow}
        childFamilySearchSlots={editor.childFamilySearchSlots}
        setChildFamilySearchSlots={editor.setChildFamilySearchSlots}
        excludedChildSpouseFamilyIds={editor.excludedChildSpouseFamilyIds}
      />

      <IndividualEditorNotesTabPanel
        hidden={editor.editorTab !== "notes"}
        mode={mode}
        individualId={individualId}
        individualNewEventLabel={editor.individualNewEventLabel}
        individualNotes={individualNotes}
      />

      <IndividualEditorMediaTabPanel
        hidden={editor.editorTab !== "media"}
        mode={mode}
        individualId={individualId}
        individualNewEventLabel={editor.individualNewEventLabel}
        linkedMediaIds={linkedMediaIds}
        individualMedia={individualMedia}
        onMediaAttached={() => {
          router.refresh();
        }}
      />

      <IndividualEditorSourcesTabPanel
        hidden={editor.editorTab !== "sources"}
        mode={mode}
        individualSources={individualSources}
      />

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
