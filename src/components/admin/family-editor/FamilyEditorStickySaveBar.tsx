"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FamilyEditorStickySaveBar({
  mode,
  pending,
  finalizeBusy,
  cancelHref,
  onSave,
}: {
  mode: "create" | "edit";
  pending: boolean;
  finalizeBusy?: boolean;
  cancelHref: string;
  onSave: () => void | Promise<void>;
}) {
  const busy = Boolean(finalizeBusy) || pending;
  const primaryLabel =
    busy ? "Saving…" : mode === "create" ? "Create new family" : "Save family";

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-base-content/10 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md",
        "supports-[padding:max(0px)]:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p className="order-3 w-full text-center text-xs text-muted-foreground sm:order-none sm:w-auto sm:text-left">
          {busy
            ? "Saving…"
            : mode === "create"
              ? "Add partners, then create the family record."
              : "Saves marriage and divorce details on this relationship."}
        </p>
        <div className="flex w-full flex-1 justify-end gap-2 sm:w-auto">
          <Link
            href={cancelHref}
            className={cn(buttonVariants({ variant: "outline", size: "default" }), "min-h-11 min-w-[5.5rem]")}
          >
            Cancel
          </Link>
          <Button
            type="button"
            disabled={busy}
            className="min-h-11 min-w-[8rem] bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => void onSave()}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
