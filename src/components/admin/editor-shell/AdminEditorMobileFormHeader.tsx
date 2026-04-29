"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminEditorMobileFormHeader({ title, backHref, backLabel = "Back" }: { title: string; backHref: string; backLabel?: string }) {
  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-base-content/10 pb-4">
      <Link
        href={backHref}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "min-h-11 shrink-0 gap-1.5 px-2")}
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>
      <h1 className="w-full text-xl font-semibold leading-snug tracking-tight text-foreground line-clamp-2">{title}</h1>
    </header>
  );
}
