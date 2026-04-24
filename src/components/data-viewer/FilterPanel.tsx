import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  onApply: () => void;
  onClear: () => void;
  children: React.ReactNode;
  /** Override the default `space-y-4` on CardContent */
  spacing?: string;
  /**
   * Number of currently active filters.
   * When > 0, shows a badge on the summary: "Filters & structured search (2 active)"
   */
  activeFilterCount?: number;
}

export function FilterPanel({
  onApply,
  onClear,
  children,
  spacing = "space-y-4",
  activeFilterCount = 0,
}: FilterPanelProps) {
  return (
    <Card className="overflow-hidden shadow-md shadow-black/18">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2.5 text-left">
            <CardTitle className="text-base">Filters &amp; structured search</CardTitle>
            {activeFilterCount > 0 && (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                {activeFilterCount} active
              </span>
            )}
          </div>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <CardContent className={cn(spacing, "border-t border-base-content/[0.08] pt-4")}>
          {children}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onApply}>
              Apply filters
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
          </div>
        </CardContent>
      </details>
    </Card>
  );
}
