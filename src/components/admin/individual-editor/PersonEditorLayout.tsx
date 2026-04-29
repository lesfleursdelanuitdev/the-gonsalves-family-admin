"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PersonEditorLayout({
  mobileNav,
  sidebar,
  children,
  className,
  sidebarNavAriaLabel = "Person editor sections",
}: {
  mobileNav: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
  className?: string;
  /** Landmark label for the desktop section nav (e.g. source editor). */
  sidebarNavAriaLabel?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10", className)}>
      <div className="lg:hidden">{mobileNav}</div>
      <aside className="hidden w-56 shrink-0 lg:block lg:self-start">
        <nav
          className="space-y-1 border-r border-base-content/10 pr-3 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto"
          aria-label={sidebarNavAriaLabel}
        >
          {sidebar}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 space-y-8">{children}</div>
    </div>
  );
}
