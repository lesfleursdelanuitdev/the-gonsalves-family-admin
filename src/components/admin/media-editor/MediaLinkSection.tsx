"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { MEDIA_TREE_PICKER_CARD_CLASS } from "@/components/admin/media-editor/constants";

type MediaLinkSectionProps = {
  description: string;
  label: string;
  pills: ReactNode;
  children: ReactNode;
};

/**
 * Shared layout for “linked X” tabs: hint text, label, pill strip, then picker card.
 */
export function MediaLinkSection({ description, label, pills, children }: MediaLinkSectionProps) {
  return (
    <div className="space-y-5 rounded-box border border-base-content/10 bg-base-content/[0.02] p-4">
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="space-y-3">
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-2">{pills}</div>
        <div className={MEDIA_TREE_PICKER_CARD_CLASS}>{children}</div>
      </div>
    </div>
  );
}
