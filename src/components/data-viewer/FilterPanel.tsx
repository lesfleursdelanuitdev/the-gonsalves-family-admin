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
}

export function FilterPanel({
  onApply,
  onClear,
  children,
  spacing = "space-y-4",
}: FilterPanelProps) {
  return (
    <Card className="overflow-hidden shadow-md shadow-black/18">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <div className="text-left">
            <CardTitle className="text-base">Filters &amp; structured search</CardTitle>
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
