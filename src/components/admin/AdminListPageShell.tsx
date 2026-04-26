import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AdminListPageShellProps {
  title: string;
  /** Primary blurb under the title. Plain strings are wrapped in `text-muted-foreground`. */
  description?: ReactNode;
  /** Extra lines under the description (e.g. secondary help). */
  headerExtra?: ReactNode;
  /** Typically a `FilterPanel`; omit when the list has no filter strip. */
  filters?: ReactNode;
  /** `DataViewer` and any siblings (alerts, pagination, dialogs). */
  children: ReactNode;
  /** Merged onto the root; default vertical rhythm is `space-y-6`. */
  className?: string;
}

function renderDescription(description: ReactNode | undefined) {
  if (description == null || description === false) return null;
  if (typeof description === "string" || typeof description === "number") {
    return <p className="text-muted-foreground">{description}</p>;
  }
  return description;
}

/**
 * Thin layout for admin list pages: title block, optional filters, then main content.
 * Phase 4.4 — reduces repeated `space-y-6` + heading markup across DataViewer list screens.
 */
export function AdminListPageShell({
  title,
  description,
  headerExtra,
  filters,
  children,
  className,
}: AdminListPageShellProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {renderDescription(description)}
        {headerExtra}
      </div>
      {filters}
      {children}
    </div>
  );
}
