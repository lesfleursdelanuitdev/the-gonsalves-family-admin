"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaUploadProgressInline } from "@/components/admin/MediaUploadProgressInline";
import type { MediaEditorUploadProgressState } from "@/hooks/useMediaEditorUploadAndMeta";
import { cn } from "@/lib/utils";

export function QuickUploadPanel({
  disabled,
  busy,
  uploadProgress,
  onFiles,
  className,
}: {
  disabled?: boolean;
  busy?: boolean;
  uploadProgress?: MediaEditorUploadProgressState | null;
  onFiles: (files: FileList | null) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/*,.pdf,.doc,.docx,application/pdf"
        multiple
        disabled={disabled || busy}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2 sm:w-auto"
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={18} className="shrink-0" aria-hidden />
        Quick upload
      </Button>
      {busy && uploadProgress ? (
        <MediaUploadProgressInline
          loaded={uploadProgress.loaded}
          total={uploadProgress.total}
          expectedSize={uploadProgress.expectedBytes}
          caption={uploadProgress.caption ?? null}
          subCaption={uploadProgress.subCaption ?? null}
        />
      ) : null}
    </div>
  );
}
