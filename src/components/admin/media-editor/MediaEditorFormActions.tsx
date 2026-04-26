"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MediaEditorFormActionsProps = {
  mode: "create" | "edit";
  mediaId: string;
  backHref: string;
  submitting: boolean;
};

export function MediaEditorFormActions({ mode, mediaId, backHref, submitting }: MediaEditorFormActionsProps) {
  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t border-base-content/[0.08] bg-base-100/95 px-0 py-3 backdrop-blur-md">
      <button type="submit" className={cn(buttonVariants())} disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving…
          </>
        ) : mode === "create" ? (
          "Create media"
        ) : (
          "Save changes"
        )}
      </button>
      <Link
        href={mode === "edit" ? `/admin/media/${mediaId}` : backHref}
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        Cancel
      </Link>
    </div>
  );
}
