"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PersonEditorMobileFormHeader({
  title,
  backHref,
  treeHref = "/admin/individuals",
}: {
  title: string;
  backHref: string;
  /** People / tree index — defaults to individuals list. */
  treeHref?: string;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 pb-4">
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-11 shrink-0 gap-1.5 px-2")}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back
      </Link>
      <Link
        href={treeHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-11 text-primary hover:text-primary/90")}
      >
        View tree
      </Link>
      <h1 className="w-full text-xl font-semibold leading-snug tracking-tight text-foreground line-clamp-2">{title}</h1>
    </header>
  );
}
