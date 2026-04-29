"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SourceEditForm } from "@/components/admin/source-editor/SourceEditForm";
import { SOURCE_EDITOR_PAGE_ICON } from "@/components/admin/source-editor/source-editor-nav";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminNewSourcePage() {
  const Icon = SOURCE_EDITOR_PAGE_ICON;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/sources"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden gap-1.5 lg:inline-flex")}
      >
        <ArrowLeft className="size-4" />
        Back to sources
      </Link>
      <div className="hidden lg:block">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-muted sm:size-14" aria-hidden>
            <Icon className="size-6 text-primary sm:size-7" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New source</h1>
            <p className="mt-2 text-muted-foreground">
              Add a publication or reference. The server assigns the next GEDCOM source xref (for example <span className="font-mono text-foreground">@S12@</span>
              ) when you save.
            </p>
          </div>
        </div>
      </div>
      <SourceEditForm mode="create" />
    </div>
  );
}
