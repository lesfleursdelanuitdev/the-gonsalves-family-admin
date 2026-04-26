"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MediaEditorFormHeaderProps = {
  hideBackLink: boolean;
  backHref: string;
  mode: "create" | "edit";
};

export function MediaEditorFormHeader({ hideBackLink, backHref, mode }: MediaEditorFormHeaderProps) {
  return (
    <div className={cn("flex gap-2", hideBackLink ? "flex-col" : "items-center")}>
      {!hideBackLink ? (
        <Link
          href={backHref}
          aria-label="Back to media"
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0")}
        >
          <ArrowLeft className="size-4" />
        </Link>
      ) : null}
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "create" ? "Add media" : "Edit media"}</h1>
        <p className="text-muted-foreground">Upload a file and set details.</p>
      </div>
    </div>
  );
}
