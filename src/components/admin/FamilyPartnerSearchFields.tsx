"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FamilyPartnerSearchFieldsProps = {
  idPrefix: string;
  p1Given: string;
  p1Last: string;
  p2Given: string;
  p2Last: string;
  onP1GivenChange: (value: string) => void;
  onP1LastChange: (value: string) => void;
  onP2GivenChange: (value: string) => void;
  onP2LastChange: (value: string) => void;
  /** Labels “Partner 1” vs “Linked family — partner 1” etc. */
  partner1Legend?: string;
  partner2Legend?: string;
  showUnorderedPairHint?: boolean;
  className?: string;
};

/**
 * Two-partner name inputs shared by {@link FamilySearchPicker} and {@link EventPicker}.
 */
export function FamilyPartnerSearchFields({
  idPrefix,
  p1Given,
  p1Last,
  p2Given,
  p2Last,
  onP1GivenChange,
  onP1LastChange,
  onP2GivenChange,
  onP2LastChange,
  partner1Legend = "Partner 1",
  partner2Legend = "Partner 2",
  showUnorderedPairHint = true,
  className,
}: FamilyPartnerSearchFieldsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">{partner1Legend}</p>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-p1-given`}>Given name contains</Label>
            <Input
              id={`${idPrefix}-p1-given`}
              value={p1Given}
              onChange={(e) => onP1GivenChange(e.target.value)}
              placeholder="e.g. Alex"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-p1-last`}>Last name prefix</Label>
            <Input
              id={`${idPrefix}-p1-last`}
              value={p1Last}
              onChange={(e) => onP1LastChange(e.target.value)}
              placeholder="GEDCOM slash-aware"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="space-y-2 rounded-md border border-base-content/10 bg-base-100/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">{partner2Legend}</p>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-p2-given`}>Given name contains</Label>
            <Input
              id={`${idPrefix}-p2-given`}
              value={p2Given}
              onChange={(e) => onP2GivenChange(e.target.value)}
              placeholder="e.g. Jordan"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-p2-last`}>Last name prefix</Label>
            <Input
              id={`${idPrefix}-p2-last`}
              value={p2Last}
              onChange={(e) => onP2LastChange(e.target.value)}
              placeholder="GEDCOM slash-aware"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
      {showUnorderedPairHint ? (
        <p className="text-xs text-muted-foreground">
          With two partners filled, either parent order matches the stored family links (same as the families list).
        </p>
      ) : null}
    </div>
  );
}
