"use client";

import { IconGenderFemale, IconGenderMale, IconHelpCircle } from "@tabler/icons-react";

const parentSexIconProps = { size: 18, stroke: 1.5 } as const;

export function ParentSexIcon({ sex }: { sex?: string | null }) {
  const s = (sex ?? "").trim().toUpperCase();
  if (s === "M") {
    return (
      <IconGenderMale {...parentSexIconProps} className="shrink-0 text-muted-foreground" aria-hidden />
    );
  }
  if (s === "F") {
    return (
      <IconGenderFemale {...parentSexIconProps} className="shrink-0 text-muted-foreground" aria-hidden />
    );
  }
  return <IconHelpCircle {...parentSexIconProps} className="shrink-0 text-muted-foreground" aria-hidden />;
}
