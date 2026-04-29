"use client";

import { IndividualEditorIdentityTabPanel } from "@/components/admin/individual-editor/IndividualEditorIdentityTabPanel";
import type { IndividualUserLinkRow } from "@/hooks/useAdminIndividuals";

export type PersonEditorAdvancedFieldsProps = {
  mode: "create" | "edit";
  sex: string;
  onSexChange: (sex: string) => void;
  xrefDisplay: string;
  userLinksLoading: boolean;
  userLinksErrMsg: string;
  userLinks: IndividualUserLinkRow[];
  userLinkBusy: boolean;
  onRemoveUserLink: (userId: string, linkId: string, display: string) => void | Promise<void>;
  linkedUserIds: ReadonlySet<string>;
  userSearch: string;
  onUserSearchChange: (q: string) => void;
  linkUserId: string | null;
  linkUserLabel: string;
  onClearLinkPick: () => void;
  onPickUserForLink: (id: string, label: string) => void;
  onAddUserLinkForEdit: () => void | Promise<void>;
};

/** Record ids, linked logins, and other technical fields (not needed for everyday edits). */
export function PersonEditorAdvancedFields(props: PersonEditorAdvancedFieldsProps) {
  return (
    <IndividualEditorIdentityTabPanel
      hidden={false}
      showSexField={false}
      mode={props.mode}
      sex={props.sex}
      onSexChange={props.onSexChange}
      xrefDisplay={props.xrefDisplay}
      userLinksLoading={props.userLinksLoading}
      userLinksErrMsg={props.userLinksErrMsg}
      userLinks={props.userLinks}
      userLinkBusy={props.userLinkBusy}
      onRemoveUserLink={props.onRemoveUserLink}
      linkedUserIds={props.linkedUserIds}
      userSearch={props.userSearch}
      onUserSearchChange={props.onUserSearchChange}
      linkUserId={props.linkUserId}
      linkUserLabel={props.linkUserLabel}
      onClearLinkPick={props.onClearLinkPick}
      onPickUserForLink={props.onPickUserForLink}
      onAddUserLinkForEdit={props.onAddUserLinkForEdit}
    />
  );
}
