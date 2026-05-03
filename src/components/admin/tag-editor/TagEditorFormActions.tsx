"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TagEditorFormActions({
  mode,
  backHref,
  submitting,
}: {
  mode: "create" | "edit";
  backHref: string;
  submitting: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-base-content/10 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md",
        "supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="order-3 w-full text-center text-xs text-muted-foreground sm:order-none sm:w-auto sm:text-left">
          {submitting ? "Saving your changes…" : "Changes apply when you save."}
        </p>
        <div className="flex w-full flex-1 justify-end gap-2 sm:w-auto">
          <Link href={backHref} className={cn(buttonVariants({ variant: "outline", size: "default" }), "min-h-11 min-w-[5.5rem]")}>
            Cancel
          </Link>
          <button type="submit" className={cn(buttonVariants(), "min-h-11 min-w-[8rem]")} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : mode === "create" ? (
              "Create tag"
            ) : (
              "Save tag"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
