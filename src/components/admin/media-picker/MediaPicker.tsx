"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MediaPickerModal } from "@/components/admin/media-picker/MediaPickerModal";
import type { AdminMediaListItem } from "@/hooks/useAdminMedia";
import type {
  MediaPickerMode,
  MediaPickerPurpose,
  MediaPickerTargetType,
} from "@/components/admin/media-picker/types";
import { cn } from "@/lib/utils";

export type MediaPickerProps = {
  targetType: MediaPickerTargetType;
  targetId: string;
  mode?: MediaPickerMode;
  allowedTypes?: readonly ("photo" | "document" | "video" | "audio")[];
  purpose?: MediaPickerPurpose;
  initialSelectedIds?: readonly string[];
  excludeMediaIds?: ReadonlySet<string>;
  onAttach?: (media: AdminMediaListItem[]) => void;
  onUploadComplete?: (media: AdminMediaListItem[]) => void;
  onClose?: () => void;
  canUpload?: boolean;
  canLink?: boolean;
  /** Label when using the default outline trigger button. */
  triggerLabel?: string;
  triggerClassName?: string;
};

/**
 * Archive-style media selector: search, album/tag filters, quick upload, and attach to a GEDCOM or album entity.
 * Full metadata editing stays on `/admin/media/[id]/edit`.
 */
export function MediaPicker({
  triggerLabel = "Add media",
  triggerClassName,
  onClose,
  ...modal
}: MediaPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("shrink-0", triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <MediaPickerModal
        {...modal}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose?.();
        }}
      />
    </>
  );
}
