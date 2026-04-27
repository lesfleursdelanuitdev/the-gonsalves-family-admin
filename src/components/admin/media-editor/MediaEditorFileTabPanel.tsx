"use client";

import type { RefObject } from "react";
import { Loader2, Upload } from "lucide-react";
import { MediaRasterImage } from "@/components/admin/MediaRasterImage";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { adminMediaUploadMaxMbForUi } from "@/constants/admin";
import { MediaUploadProgressInline } from "@/components/admin/MediaUploadProgressInline";
import type { MediaEditorUploadProgressState } from "@/hooks/useMediaEditorUploadAndMeta";

export type MediaEditorFileTabPanelProps = {
  panelId: string;
  ariaLabelledBy: string;
  hidden: boolean;
  mode: "create" | "edit";
  initialXref?: string | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  uploading: boolean;
  uploadProgress?: MediaEditorUploadProgressState | null;
  onDrop: (e: React.DragEvent) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFilesChosenFromPicker: (list: FileList | null) => void;
  fileRef: string;
  setFileRef: (v: string) => void;
  showImagePreview: boolean;
  showVideoPreview: boolean;
  imagePreviewSrc: string | null;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  form: string;
  setForm: (v: string) => void;
};

export function MediaEditorFileTabPanel({
  panelId,
  ariaLabelledBy,
  hidden,
  mode,
  initialXref,
  dragOver,
  setDragOver,
  uploading,
  uploadProgress = null,
  onDrop,
  fileInputRef,
  onFilesChosenFromPicker,
  fileRef,
  setFileRef,
  showImagePreview,
  showVideoPreview,
  imagePreviewSrc,
  title,
  setTitle,
  description,
  setDescription,
  form,
  setForm,
}: MediaEditorFileTabPanelProps) {
  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={ariaLabelledBy}
      hidden={hidden}
      className="space-y-6 pt-2"
    >
      <div
        id="media-file-drop"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={cn(
          "flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-base-content/15 bg-base-200/20",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Upload className="size-8 text-muted-foreground" aria-hidden />
        )}
        {uploading && uploadProgress ? (
          <MediaUploadProgressInline
            className="mt-1"
            loaded={uploadProgress.loaded}
            total={uploadProgress.total}
            expectedSize={uploadProgress.expectedBytes}
            caption={uploadProgress.caption ?? null}
            subCaption={uploadProgress.subCaption ?? null}
          />
        ) : null}
        <p className="font-medium text-base-content">
          {mode === "create" ? "Drop multiple files or click to choose several" : "Drop a file or click to choose"}
        </p>
        {mode === "create" && !uploading ? (
          <span className="badge badge-sm border border-primary/30 bg-primary/10 font-normal text-primary">
            Multi-select in the file dialog
          </span>
        ) : null}
        <p className="text-muted-foreground">
          {mode === "create"
            ? `Up to ${adminMediaUploadMaxMbForUi()} MB each · each file becomes a new media row (you return to the media list if you pick more than one)`
            : `Up to ${adminMediaUploadMaxMbForUi()} MB · one file replaces the current upload`}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple={mode === "create"}
          className="sr-only"
          accept="*/*"
          aria-label={
            mode === "create"
              ? "Choose one or more media files (multi-select supported)"
              : "Choose a file to replace the current media upload"
          }
          onChange={(ev) => {
            onFilesChosenFromPicker(ev.target.files);
            ev.target.value = "";
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="media-file-ref">File reference (GEDCOM)</Label>
        <Input
          id="media-file-ref"
          value={fileRef}
          onChange={(e) => setFileRef(e.target.value)}
          placeholder="/uploads/... or https://..."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Populated automatically after upload; you can paste a URL or path instead.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Thumbnail</Label>
        <p className="text-xs text-muted-foreground">
          Same media as the preview above, shown compactly (no separate thumbnail file on disk).
        </p>
        {showImagePreview && imagePreviewSrc ? (
          <div className="relative h-40 w-40 overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
            <MediaRasterImage
              key={`thumb-${imagePreviewSrc}`}
              fileRef={fileRef}
              form={form}
              src={imagePreviewSrc}
              alt=""
              fill
              sizes="160px"
              className="object-contain p-1"
            />
          </div>
        ) : showVideoPreview && imagePreviewSrc ? (
          <div className="max-w-sm overflow-hidden rounded-box border border-base-content/10 bg-base-200/40">
            <video
              key={`thumb-v-${imagePreviewSrc}`}
              src={imagePreviewSrc}
              controls
              playsInline
              className="max-h-40 w-full"
            />
          </div>
        ) : (
          <div className="flex h-40 w-40 items-center justify-center rounded-box border border-dashed border-base-content/15 bg-base-200/20 text-center text-xs text-muted-foreground">
            Set a file reference or upload to show a thumbnail.
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="media-title">Title</Label>
          <Input id="media-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="media-description">Description</Label>
          <textarea
            id="media-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Optional longer caption or notes for this media object"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="media-form">Form (MIME / GEDCOM)</Label>
          <Input id="media-form" value={form} onChange={(e) => setForm(e.target.value)} placeholder="jpeg, pdf, …" />
        </div>
      </div>

      {mode === "edit" && initialXref ? (
        <div className="space-y-1">
          <Label>XREF</Label>
          <p className="font-mono text-sm">{initialXref}</p>
        </div>
      ) : null}
    </div>
  );
}
