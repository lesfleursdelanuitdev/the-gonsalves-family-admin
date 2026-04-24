"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type IndividualNameSearchFieldsProps = {
  idPrefix: string;
  givenValue: string;
  lastValue: string;
  onGivenChange: (value: string) => void;
  onLastChange: (value: string) => void;
  /** Shown under last-name field (same copy as IndividualSearchPicker). */
  showLastNameHint?: boolean;
  className?: string;
};

/**
 * Given + last name inputs shared by {@link IndividualSearchPicker} and {@link EventPicker}
 * (structured search, not choosing a row from the individuals list).
 */
export function IndividualNameSearchFields({
  idPrefix,
  givenValue,
  lastValue,
  onGivenChange,
  onLastChange,
  showLastNameHint = true,
  className,
}: IndividualNameSearchFieldsProps) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-given`}>Given name contains</Label>
        <Input
          id={`${idPrefix}-given`}
          value={givenValue}
          onChange={(e) => onGivenChange(e.target.value)}
          placeholder="e.g. Maria"
          autoComplete="off"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${idPrefix}-last`}>Last name prefix</Label>
        <Input
          id={`${idPrefix}-last`}
          value={lastValue}
          onChange={(e) => onLastChange(e.target.value)}
          placeholder="GEDCOM slash-aware prefix (e.g. G)"
          autoComplete="off"
        />
        {showLastNameHint ? (
          <p className="text-xs text-muted-foreground">Matches surnames in slashes, same as the individuals list.</p>
        ) : null}
      </div>
    </div>
  );
}
