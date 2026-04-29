"use client";

import { IconHeartbeat, IconSkull } from "@tabler/icons-react";
import { CollapsibleFormSection } from "@/components/admin/individual-editor/CollapsibleFormSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectClassName } from "@/components/data-viewer/constants";
import type { LivingMode } from "@/lib/admin/admin-individual-living";
import { cn } from "@/lib/utils";

const SEX_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Unknown" },
  { value: "M", label: "Male" },
  { value: "F", label: "Female" },
  { value: "U", label: "Unspecified" },
  { value: "X", label: "Other" },
];

export type PersonEditorBasicFieldsProps = {
  firstNamesDisplay: string;
  lastNameDisplay: string;
  onFirstNamesChange: (v: string) => void;
  onLastNameChange: (v: string) => void;
  sex: string;
  onSexChange: (sex: string) => void;
  livingStatus: { text: string; deceased: boolean };
  livingMode: LivingMode;
  onLivingModeChange: (mode: LivingMode) => void;
  onOpenNamesSection?: () => void;
};

export function PersonEditorBasicFields({
  firstNamesDisplay,
  lastNameDisplay,
  onFirstNamesChange,
  onLastNameChange,
  sex,
  onSexChange,
  livingStatus,
  livingMode,
  onLivingModeChange,
  onOpenNamesSection,
}: PersonEditorBasicFieldsProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="person-first-names">First name(s)</Label>
        <Input
          id="person-first-names"
          value={firstNamesDisplay}
          onChange={(e) => onFirstNamesChange(e.target.value)}
          placeholder="e.g. Maria Jose"
          autoComplete="given-name"
          className="min-h-11"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="person-last-name">Last name</Label>
        <Input
          id="person-last-name"
          value={lastNameDisplay}
          onChange={(e) => onLastNameChange(e.target.value)}
          placeholder="e.g. Gonsalves"
          autoComplete="family-name"
          className="min-h-11"
        />
      </div>

      <div className="space-y-2">
        <Label>Sex</Label>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="Sex">
          {SEX_OPTIONS.map((opt) => (
            <Button
              key={opt.value || "unk"}
              type="button"
              variant={sex === opt.value ? "default" : "outline"}
              size="sm"
              className={cn(
                "min-h-11 w-full justify-center sm:w-auto sm:min-w-[5.5rem]",
                sex === opt.value && "bg-primary text-primary-foreground",
              )}
              onClick={() => onSexChange(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-base-content/10 bg-base-content/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="living-mode-basic" className="shrink-0">
            Living status
          </Label>
          <p
            className={cn(
              "ml-auto flex items-center gap-2 text-sm font-semibold",
              livingStatus.deceased ? "text-destructive" : "text-green-600 dark:text-green-400",
            )}
          >
            {livingStatus.deceased ? (
              <IconSkull size={20} stroke={1.5} className="shrink-0" aria-hidden />
            ) : (
              <IconHeartbeat size={20} stroke={1.5} className="shrink-0" aria-hidden />
            )}
            {livingStatus.text}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="living-mode-basic" className="sr-only">
            How living status is determined
          </Label>
          <select
            id="living-mode-basic"
            className={selectClassName}
            value={livingMode}
            onChange={(e) => onLivingModeChange(e.target.value as LivingMode)}
          >
            <option value="auto">Automatic (from death date and age rules)</option>
            <option value="living">Always treat as living</option>
            <option value="deceased">Always treat as deceased</option>
          </select>
        </div>
      </div>

      {onOpenNamesSection ? (
        <CollapsibleFormSection title="More name options">
          <p className="text-sm text-muted-foreground">
            Nicknames, prefixes, multiple surnames, and other name rows live in Names.
          </p>
          <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11 w-full sm:w-auto" onClick={onOpenNamesSection}>
            Open names
          </Button>
        </CollapsibleFormSection>
      ) : null}
    </div>
  );
}
