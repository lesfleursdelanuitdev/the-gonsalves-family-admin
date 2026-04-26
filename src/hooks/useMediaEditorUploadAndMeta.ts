"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  isLikelyRasterImage,
  isLikelyVideoFile,
  isPlayableVideoRef,
  resolveMediaImageSrc,
} from "@/lib/admin/mediaPreview";
import { titleFromUploadedFilename } from "@/lib/admin/media-upload-title";
import { ApiError, postFormData } from "@/lib/infra/api";
import { ADMIN_MEDIA_QUERY_KEY, useCreateMedia } from "@/hooks/useAdminMedia";
import type { MediaEditorInitial } from "@/components/admin/media-editor/media-editor-types";

export type UseMediaEditorUploadAndMetaArgs = {
  mode: "create" | "edit";
  initial: MediaEditorInitial | null;
  setErrMsg: (msg: string | null) => void;
  createMedia: ReturnType<typeof useCreateMedia>;
  queryClient: QueryClient;
  router: { push: (href: string) => void };
};

export function useMediaEditorUploadAndMeta({
  mode,
  initial,
  setErrMsg,
  createMedia,
  queryClient,
  router,
}: UseMediaEditorUploadAndMetaArgs) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [fileRef, setFileRef] = useState(initial?.fileRef ?? "");
  const [form, setForm] = useState(initial?.form ?? "");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMimeType, setUploadMimeType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imagePreviewSrc = useMemo(() => resolveMediaImageSrc(fileRef), [fileRef]);
  const showImagePreview = useMemo(
    () => Boolean(imagePreviewSrc && isLikelyRasterImage(fileRef, form, uploadMimeType)),
    [fileRef, form, imagePreviewSrc, uploadMimeType],
  );
  const showVideoPreview = useMemo(
    () =>
      Boolean(
        imagePreviewSrc &&
          !showImagePreview &&
          isLikelyVideoFile(fileRef, form) &&
          isPlayableVideoRef(fileRef),
      ),
    [fileRef, form, imagePreviewSrc, showImagePreview],
  );

  const processUploadFile = useCallback(async (file: File) => {
    setErrMsg(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await postFormData<{
        fileRef: string;
        suggestedForm: string | null;
        originalName: string;
        mimeType: string | null;
      }>("/api/admin/media/upload", fd);
      setFileRef(res.fileRef);
      setUploadMimeType(res.mimeType ?? null);
      if (res.suggestedForm) {
        setForm((prev) => (prev.trim() ? prev : res.suggestedForm!));
      }
      const derived = titleFromUploadedFilename(res.originalName);
      setTitle((t) => (t.trim() ? t : derived));
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [setErrMsg]);

  const processBulkCreateFromFiles = useCallback(
    async (files: File[]) => {
      setErrMsg(null);
      setUploading(true);
      const errors: string[] = [];
      let created = 0;
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i]!;
          if (file.size <= 0) continue;
          const label = file.name?.trim() || `File ${i + 1}`;
          try {
            const fd = new FormData();
            fd.set("file", file);
            const up = await postFormData<{
              fileRef: string;
              suggestedForm: string | null;
              originalName: string;
              mimeType: string | null;
            }>("/api/admin/media/upload", fd);
            const rowTitle = titleFromUploadedFilename(up.originalName);
            await createMedia.mutateAsync({
              title: rowTitle,
              fileRef: up.fileRef,
              form: up.suggestedForm ?? null,
            });
            created++;
          } catch (e) {
            const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Upload failed";
            errors.push(`${label}: ${msg}`);
          }
        }
        await queryClient.invalidateQueries({ queryKey: [...ADMIN_MEDIA_QUERY_KEY] });
        if (errors.length === 0) {
          toast.success(created === 1 ? "Created 1 media item." : `Created ${created} media items.`);
          router.push("/admin/media");
          return;
        }
        if (created > 0) {
          toast.warning(`Created ${created} of ${files.length} items.`, {
            description: errors.slice(0, 5).join(" · "),
          });
          router.push("/admin/media");
          return;
        }
        setErrMsg(errors.slice(0, 6).join("\n"));
      } finally {
        setUploading(false);
      }
    },
    [createMedia, queryClient, router, setErrMsg],
  );

  const onFilesChosenFromPicker = useCallback(
    (list: FileList | null) => {
      const files = list ? Array.from(list).filter((f) => f.size > 0) : [];
      if (files.length === 0) return;
      if (mode === "edit") {
        if (files.length > 1) {
          toast.message("Using the first file only", {
            description: "When editing media, replace one file at a time.",
          });
        }
        void processUploadFile(files[0]!);
        return;
      }
      if (files.length === 1) {
        void processUploadFile(files[0]!);
        return;
      }
      void processBulkCreateFromFiles(files);
    },
    [mode, processBulkCreateFromFiles, processUploadFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const list = e.dataTransfer.files;
      if (list?.length) onFilesChosenFromPicker(list);
    },
    [onFilesChosenFromPicker],
  );

  return {
    title,
    setTitle,
    description,
    setDescription,
    fileRef,
    setFileRef,
    form,
    setForm,
    uploading,
    dragOver,
    setDragOver,
    uploadMimeType,
    fileInputRef,
    imagePreviewSrc,
    showImagePreview,
    showVideoPreview,
    processUploadFile,
    onFilesChosenFromPicker,
    onDrop,
  };
}
