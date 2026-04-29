"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SourceEditForm } from "@/components/admin/source-editor/SourceEditForm";
import { SOURCE_EDITOR_PAGE_ICON } from "@/components/admin/source-editor/source-editor-nav";
import { buttonVariants } from "@/components/ui/button";
import { useAdminSource } from "@/hooks/useAdminSources";
import { cn } from "@/lib/utils";

function sourceHeadline(source: Record<string, unknown>): string {
  const title = typeof source.title === "string" ? source.title.trim() : "";
  if (title) return title;
  const xref = typeof source.xref === "string" ? source.xref.trim() : "";
  if (xref) return xref;
  return "Source";
}

export default function AdminSourceEditPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { data, isLoading, error } = useAdminSource(id);
  const source = data?.source as Record<string, unknown> | undefined;

  const backSources = (
    <Link href="/admin/sources" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-2 inline-flex gap-1.5")}>
      <ArrowLeft className="size-4" />
      Back to sources
    </Link>
  );

  if (!id) {
    return (
      <div>
        {backSources}
        <p className="text-sm text-muted-foreground">Missing id.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div>
        {backSources}
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (error || !source) {
    return (
      <div>
        {backSources}
        <p className="text-sm text-destructive">Could not load this source.</p>
      </div>
    );
  }

  const personLabel = sourceHeadline(source);
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
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight">
            <span className="font-medium text-muted-foreground">Edit source</span>{" "}
            <span className="text-foreground">{personLabel}</span>
          </h1>
        </div>
        <p className="mt-2 text-muted-foreground">Update publication details and repository fields. Citations are managed from person, family, and event screens.</p>
      </div>
      <SourceEditForm key={id} mode="edit" sourceId={id} initialSource={source} />
    </div>
  );
}
