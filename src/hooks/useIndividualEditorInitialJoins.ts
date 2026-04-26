"use client";

import { useMemo } from "react";
import type {
  IndividualEditMediaJoin,
  IndividualEditNoteJoin,
  IndividualEditSourceJoin,
} from "@/components/admin/individual-editor/individual-editor-types";

type Args = {
  mode: "create" | "edit";
  initialIndividual: Record<string, unknown> | undefined;
};

export function deriveIndividualEditorInitialJoins({
  mode,
  initialIndividual,
}: Args): {
  individualNotes: IndividualEditNoteJoin[];
  individualMedia: IndividualEditMediaJoin[];
  linkedMediaIds: Set<string>;
  individualSources: IndividualEditSourceJoin[];
} {
  if (mode !== "edit" || !initialIndividual) {
    return {
      individualNotes: [],
      individualMedia: [],
      linkedMediaIds: new Set<string>(),
      individualSources: [],
    };
  }

  const individualNotes = (initialIndividual.individualNotes as IndividualEditNoteJoin[]) ?? [];
  const individualMedia = (initialIndividual.individualMedia as IndividualEditMediaJoin[]) ?? [];
  const linkedMediaIds = new Set<string>();
  for (const row of individualMedia) {
    const id = String(row.media?.id ?? "").trim();
    if (id) linkedMediaIds.add(id);
  }
  const individualSources = (initialIndividual.individualSources as IndividualEditSourceJoin[]) ?? [];

  return { individualNotes, individualMedia, linkedMediaIds, individualSources };
}

export function useIndividualEditorInitialJoins({ mode, initialIndividual }: Args) {
  const derived = useMemo(
    () => deriveIndividualEditorInitialJoins({ mode, initialIndividual }),
    [mode, initialIndividual],
  );

  return derived;
}
