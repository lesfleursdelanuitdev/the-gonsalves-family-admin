"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function CollapsibleFormSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** When true, the section starts expanded. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-lg border border-base-content/12 bg-base-200/20 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md text-left hover:bg-base-content/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-base-content/20"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="text-sm font-semibold text-base-content">{title}</h3>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open ? (
        <div id={panelId} className="mt-3 space-y-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
