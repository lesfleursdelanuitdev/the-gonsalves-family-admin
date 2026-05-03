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

type CreateMediaScope = "family-tree" | "site-assets" | "my-media";

type Args = {
  mode: "create" | "edit";
  mediaId: string;
  title: string;
  description: string;
  fileRef: string;
  form: string;
  /** Merged into create/update JSON for site-assets / my-media (e.g. isPublic, visibility). */
  getScopedExtraBody?: () => Record<string, unknown>;
  contextReturnHref?: string;
  createScope: CreateMediaScope;
  setErrMsg: (msg: string | null) => void;
  createMediaByScope: (
    scope: CreateMediaScope,
    payload: MediaPayload,
  ) => Promise<{ media: { id: string } }>;
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
  getScopedExtraBody,
  contextReturnHref,
  createScope,
  setErrMsg,
  createMediaByScope,
  updateMedia,
  persistStagedLinksForNewMedia,
  invalidateMediaQueries,
  invalidateMediaListQuery,
  push,
}: Args) {
  const [submitting, setSubmitting] = useState(false);

  const scopedHref = useCallback((href: string, scope: CreateMediaScope) => {
    if (scope === "family-tree") return href;
    const sep = href.includes("?") ? "&" : "?";
    return `${href}${sep}scope=${scope}`;
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrMsg(null);
      if (mode === "create" && !fileRef.trim()) {
        setErrMsg("Upload a file or enter a file reference in Advanced details before creating media.");
        return;
      }
      setSubmitting(true);
      try {
        const scopedExtra = getScopedExtraBody?.() ?? {};
        const payload: MediaPayload & Record<string, unknown> = {
          title: title.trim() || null,
          description: description.trim() || null,
          fileRef: fileRef.trim() || null,
          form: form.trim() || null,
          ...scopedExtra,
        };
        if (mode === "create") {
          const res = await createMediaByScope(createScope, payload);
          const newId = res.media.id;
          await persistStagedLinksForNewMedia(newId);
          await invalidateMediaListQuery();
          const back = safeAdminContextHref(contextReturnHref);
          if (back) {
            push(back);
          } else {
            push(scopedHref(`/admin/media/${newId}`, createScope));
          }
          return;
        }
        await updateMedia({ id: mediaId, ...payload });
        await invalidateMediaQueries();
        push(scopedHref(`/admin/media/${mediaId}`, createScope));
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
      getScopedExtraBody,
      mode,
      createScope,
      createMediaByScope,
      persistStagedLinksForNewMedia,
      invalidateMediaListQuery,
      contextReturnHref,
      push,
      scopedHref,
      updateMedia,
      mediaId,
      invalidateMediaQueries,
    ],
  );

  return { submitting, handleSubmit };
}
