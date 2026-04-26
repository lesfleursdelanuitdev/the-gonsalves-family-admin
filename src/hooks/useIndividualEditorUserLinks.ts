"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/infra/api";
import {
  useAdminIndividualUserLinks,
  type IndividualUserLinkRow,
} from "@/hooks/useAdminIndividuals";
import { useCreateUserLink, useDeleteUserLink } from "@/hooks/useAdminUsers";

const STABLE_EMPTY_USER_LINKS: IndividualUserLinkRow[] = [];

type UseIndividualEditorUserLinksArgs = {
  individualId: string;
  xref: string;
  linkUserId: string | null;
  linkUserLabel: string;
  setLinkUserId: (id: string | null) => void;
  setLinkUserLabel: (label: string) => void;
  setUserSearch: (next: string) => void;
};

export function useIndividualEditorUserLinks(args: UseIndividualEditorUserLinksArgs) {
  const {
    individualId,
    xref,
    linkUserId,
    linkUserLabel,
    setLinkUserId,
    setLinkUserLabel,
    setUserSearch,
  } = args;

  const { data: userLinksRes, isLoading: userLinksLoading, error: userLinksError } =
    useAdminIndividualUserLinks(individualId);
  const userLinks = userLinksRes?.links != null ? userLinksRes.links : STABLE_EMPTY_USER_LINKS;
  const userLinksErrMsg = userLinksError instanceof Error ? userLinksError.message : "";
  const linkedUserIds = useMemo(() => new Set(userLinks.map((row) => row.user.id)), [userLinks]);

  const createUserLink = useCreateUserLink();
  const deleteUserLink = useDeleteUserLink();
  const userLinkBusy = createUserLink.isPending || deleteUserLink.isPending;

  const onRemoveUserLink = useCallback(
    async (userId: string, linkId: string, label: string) => {
      if (!window.confirm(`Remove the link between this person and "${label}"?`)) return;
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
    const x = xref.trim();
    if (!linkUserId) {
      toast.error("Search and select a user to link.");
      return;
    }
    if (!x) {
      toast.error("This person needs an XREF before linking (save the record if it is missing).");
      return;
    }
    try {
      await createUserLink.mutateAsync({ userId: linkUserId, individualXref: x });
      toast.success(`Linked ${linkUserLabel || linkUserId} to this person.`);
      setLinkUserId(null);
      setLinkUserLabel("");
      setUserSearch("");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Could not create link";
      toast.error(msg);
    }
  }, [xref, linkUserId, linkUserLabel, createUserLink, setLinkUserId, setLinkUserLabel, setUserSearch]);

  const onClearLinkPick = useCallback(() => {
    setLinkUserId(null);
    setLinkUserLabel("");
  }, [setLinkUserId, setLinkUserLabel]);

  const onPickUserForLink = useCallback(
    (id: string, label: string) => {
      setLinkUserId(id);
      setLinkUserLabel(label);
      setUserSearch("");
    },
    [setLinkUserId, setLinkUserLabel, setUserSearch],
  );

  return {
    userLinks,
    userLinksLoading,
    userLinksErrMsg,
    linkedUserIds,
    userLinkBusy,
    onRemoveUserLink,
    onAddUserLinkForEdit,
    onClearLinkPick,
    onPickUserForLink,
  };
}
