"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { PersonEditorSectionCard } from "@/components/admin/individual-editor/PersonEditorSectionCard";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  sectionKey: string;
  title: string;
  description: string;
  icon: LucideIcon;
  summary: string;
  isDesktop: boolean;
  mobileExpanded: string | null;
  onMobileToggle: (key: string) => void;
  children: ReactNode;
};

/**
 * Desktop: always-open section card (reuses {@link PersonEditorSectionCard}).
 * Mobile: collapsible summary row + body (accordion).
 */
export function AdminEditorResponsiveSection({
  id,
  sectionKey,
  title,
  description,
  icon: Icon,
  summary,
  isDesktop,
  mobileExpanded,
  onMobileToggle,
  children,
}: Props) {
  if (isDesktop) {
    return (
      <PersonEditorSectionCard id={id} title={title} description={description} icon={Icon}>
        {children}
      </PersonEditorSectionCard>
    );
  }

  const expanded = mobileExpanded === sectionKey;

  return (
    <section
      id={id}
      className="overflow-hidden rounded-xl border border-base-content/10 bg-card/80 shadow-sm backdrop-blur-sm"
    >
      <button
        type="button"
        className="flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-base-content/[0.04]"
        aria-expanded={expanded}
        onClick={() => onMobileToggle(sectionKey)}
      >
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icon className="size-5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{title}</span>
          <span className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{summary}</span>
        </span>
        <ChevronDown
          className={cn("mt-1 size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
          aria-hidden
        />
      </button>
      {expanded ? <div className="border-t border-base-content/10 px-4 py-4">{children}</div> : null}
    </section>
  );
}
