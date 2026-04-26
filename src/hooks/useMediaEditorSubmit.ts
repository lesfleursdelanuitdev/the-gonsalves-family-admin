"use client";

import { useCallback, useState } from "react";
import { safeAdminContextHref } from "@/lib/admin/safe-admin-context-href";
import { ApiError } from "@/lib/infra/api";

type MediaPayload = {
  title: string | null;
  description: string | null;
  fileRef: string | null;
  form: string | null;
};

type Args = {
  mode: "create" | "edit";
  mediaId: string;
  title: string;
  description: string;
  fileRef: string;
  form: string;
  contextReturnHref?: string;
  setErrMsg: (msg: string | null) => void;
  createMedia: (payload: MediaPayload) => Promise<{ media: { id: string } }>;
  updateMedia: (payload: { id: string } & MediaPayload) => Promise<unknown>;
  persistStagedLinksForNewMedia: (newId: string) => Promise<void>;
  invalidateMediaQueries: () => Promise<void>;
  invalidateMediaListQuery: () => Promise<void>;
  push: (href: string) => void;
};

export function useMediaEditorSubmit({
  mode,
  mediaId,
  title,
  description,
  fileRef,
  form,
  contextReturnHref,
  setErrMsg,
  createMedia,
  updateMedia,
  persistStagedLinksForNewMedia,
  invalidateMediaQueries,
  invalidateMediaListQuery,
  push,
}: Args) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrMsg(null);
      setSubmitting(true);
      try {
        const payload: MediaPayload = {
          title: title.trim() || null,
          description: description.trim() || null,
          fileRef: fileRef.trim() || null,
          form: form.trim() || null,
        };
        if (mode === "create") {
          const res = await createMedia(payload);
          const newId = res.media.id;
          await persistStagedLinksForNewMedia(newId);
          await invalidateMediaListQuery();
          const back = safeAdminContextHref(contextReturnHref);
          push(back ?? `/admin/media/${newId}`);
          return;
        }
        await updateMedia({ id: mediaId, ...payload });
        await invalidateMediaQueries();
        push(`/admin/media/${mediaId}`);
      } catch (err) {
        setErrMsg(err instanceof ApiError ? err.message : "Save failed");
      } finally {
        setSubmitting(false);
      }
    },
    [
      setErrMsg,
      title,
      description,
      fileRef,
      form,
      mode,
      createMedia,
      persistStagedLinksForNewMedia,
      invalidateMediaListQuery,
      contextReturnHref,
      push,
      updateMedia,
      mediaId,
      invalidateMediaQueries,
    ],
  );

  return { submitting, handleSubmit };
}
