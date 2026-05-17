import type {
  StoryEmbedBlock,
  StoryEmbedDataByKind,
  StoryEmbedPresentation,
  StoryEmbedSubject,
  StoryEmbedSubjectType,
  StoryGeneralEmbedKind,
  StoryTimelineEmbedPayload,
  StoryTimelineScope,
} from "@/lib/admin/story-creator/story-types";

const TIMELINE_DATA_KEYS = [
  "viewMode",
  "orient",
  "activeView",
  "anim",
  "vStyle",
  "hStyle",
  "pag",
  "perPage",
  "autoplayPxPerSec",
  "autoplayLoop",
  "showImages",
  "animRevealMinRatio",
  "renderer",
  "perCol",
  "numColumns",
  "columnChunkMode",
  "cardWidthPx",
  "gapPx",
  "showArrows",
  "heightPx",
  "timelineWidthPx",
  "timelineWidthPct",
  "timelinePreviewWidthUnit",
  "timelineShowPlaybackControls",
] as const satisfies readonly (keyof StoryTimelineEmbedPayload)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function defaultStoryEmbedTitle(kind: StoryGeneralEmbedKind): string {
  if (kind === "personSpotlight") return "Person spotlight";
  if (kind === "familyGroup") return "Family group";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export function defaultStoryEmbedPresentation(kind: StoryGeneralEmbedKind): StoryEmbedPresentation {
  if (kind === "timeline") return { chrome: "minimal", controls: true };
  if (kind === "map" || kind === "tree") return { chrome: "minimal", controls: true };
  return { chrome: "minimal", controls: false };
}

export function defaultStoryEmbedData<K extends StoryGeneralEmbedKind>(kind: K): StoryEmbedDataByKind[K] {
  switch (kind) {
    case "tree":
      return { generations: 5, chartType: "fan" } as StoryEmbedDataByKind[K];
    case "personSpotlight":
      return { fields: ["profileImage", "name", "lifespan", "birthPlace", "parents", "spouses", "children"] } as StoryEmbedDataByKind[K];
    case "gallery":
      return { sourceType: "custom" } as StoryEmbedDataByKind[K];
    case "map":
      return { eventIds: [], mapMode: "events" } as unknown as StoryEmbedDataByKind[K];
    case "timeline":
      return { sourceType: "custom", timelineMode: "custom", filters: { includeUndated: true } } as StoryEmbedDataByKind[K];
    case "event":
      return { fields: ["type", "date", "place", "people"] } as StoryEmbedDataByKind[K];
    case "familyGroup":
      return { fields: ["partners", "children", "marriage"] } as StoryEmbedDataByKind[K];
    case "document":
      return {} as StoryEmbedDataByKind[K];
    case "graph":
      return {} as StoryEmbedDataByKind[K];
    case "recipe":
      return { ingredientGroups: [], stepGroups: [] } as unknown as StoryEmbedDataByKind[K];
  }
}

function timelineScopeToSubjectType(scope: StoryTimelineScope | null | undefined): StoryEmbedSubjectType | undefined {
  if (scope === "individual" || scope === "family" || scope === "note") return scope;
  return undefined;
}

function subjectTypeToTimelineScope(subjectType: StoryEmbedSubjectType | undefined): StoryTimelineScope | undefined {
  if (subjectType === "individual" || subjectType === "family" || subjectType === "note") return subjectType;
  return undefined;
}

function subjectFromLegacyTimeline(block: StoryEmbedBlock): StoryEmbedSubject | undefined {
  const type = timelineScopeToSubjectType(block.scope ?? null);
  if (!type) return undefined;
  return {
    type,
    ...(block.entityId ? { id: block.entityId } : {}),
  };
}

function timelineSourceTypeFromScope(scope: StoryTimelineScope | null | undefined): StoryEmbedDataByKind["timeline"]["sourceType"] {
  if (scope === "individual") return "personEvents";
  if (scope === "family") return "familyEvents";
  if (scope === "note") return "noteEvents";
  return "custom";
}

function timelineScopeFromSourceType(sourceType: StoryEmbedDataByKind["timeline"]["sourceType"] | undefined): StoryTimelineScope | undefined {
  if (sourceType === "personEvents") return "individual";
  if (sourceType === "familyEvents") return "family";
  if (sourceType === "noteEvents") return "note";
  return undefined;
}

function normalizeDataForKind(block: StoryEmbedBlock): StoryEmbedBlock["data"] {
  const data = { ...asRecord(defaultStoryEmbedData(block.embedKind)), ...asRecord(block.data) };
  if (block.embedKind === "timeline") {
    const sourceType =
      typeof data.sourceType === "string"
        ? (data.sourceType as StoryEmbedDataByKind["timeline"]["sourceType"])
        : timelineSourceTypeFromScope(block.scope);
    const sourceId = typeof data.sourceId === "string" ? data.sourceId : block.entityId ?? undefined;
    return {
      ...data,
      sourceType,
      ...(sourceId ? { sourceId } : {}),
      timelineMode:
        typeof data.timelineMode === "string"
          ? (data.timelineMode as StoryEmbedDataByKind["timeline"]["timelineMode"])
          : sourceType === "personEvents"
            ? "life"
            : sourceType === "familyEvents"
              ? "family"
              : sourceType === "noteEvents"
                ? "note"
                : "custom",
    } as StoryEmbedBlock["data"];
  }
  return data as StoryEmbedBlock["data"];
}

function applyTimelineCompatibilityAliases(block: StoryEmbedBlock): StoryEmbedBlock {
  if (block.embedKind !== "timeline") return block;

  const out: StoryEmbedBlock = { ...block };
  const data = asRecord(out.data);
  for (const key of TIMELINE_DATA_KEYS) {
    if (data[key] !== undefined) {
      (out as unknown as Record<string, unknown>)[key] = data[key];
    }
  }

  const timelineScope = subjectTypeToTimelineScope(out.subject?.type);
  if (timelineScope) {
    out.scope = timelineScope;
    out.entityId = out.subject?.id ?? null;
  }

  return out;
}

export function normalizeStoryEmbedBlock(block: StoryEmbedBlock): StoryEmbedBlock {
  const title = (block.title ?? block.label?.trim()) || defaultStoryEmbedTitle(block.embedKind);
  const subject = block.subject ?? subjectFromLegacyTimeline(block);
  const presentation = block.presentation ?? defaultStoryEmbedPresentation(block.embedKind);
  const data = normalizeDataForKind(block);

  return applyTimelineCompatibilityAliases({
    ...block,
    title,
    label: block.label?.trim() ? block.label : title,
    subject,
    presentation,
    data,
  } as StoryEmbedBlock);
}

export function patchStoryEmbedBlock(block: StoryEmbedBlock, patch: Partial<StoryEmbedBlock>): StoryEmbedBlock {
  const current = normalizeStoryEmbedBlock(block);
  const kind = patch.embedKind ?? current.embedKind;
  const nextData = patch.data
    ? { ...asRecord(current.embedKind === kind ? current.data : defaultStoryEmbedData(kind)), ...asRecord(patch.data) }
    : current.embedKind === kind
      ? current.data
      : defaultStoryEmbedData(kind);
  const next = {
    ...current,
    ...patch,
    data: nextData,
  } as StoryEmbedBlock;

  if (patch.title !== undefined && patch.label === undefined) {
    next.label = patch.title ?? "";
  }
  if (patch.label !== undefined && patch.title === undefined) {
    next.title = patch.label;
  }
  if (patch.scope !== undefined || patch.entityId !== undefined) {
    next.subject = subjectFromLegacyTimeline(next);
  }
  if (patch.subject !== undefined) {
    const timelineScope = subjectTypeToTimelineScope(patch.subject?.type);
    if (timelineScope) {
      next.scope = timelineScope;
      next.entityId = patch.subject?.id ?? null;
    }
  }
  if (next.embedKind === "timeline" && isRecord(next.data)) {
    const sourceType = next.data.sourceType as StoryEmbedDataByKind["timeline"]["sourceType"] | undefined;
    const timelineScope = timelineScopeFromSourceType(sourceType);
    if (timelineScope) {
      next.scope = timelineScope;
      next.entityId = typeof next.data.sourceId === "string" ? next.data.sourceId : null;
    }
  }

  return normalizeStoryEmbedBlock(next);
}

export function storyTimelinePayloadFromEmbedBlock(block: StoryEmbedBlock): StoryTimelineEmbedPayload {
  const normalized = normalizeStoryEmbedBlock(block);
  const data = normalized.embedKind === "timeline" ? normalized.data : undefined;
  const scope = timelineScopeFromSourceType(data?.sourceType) ?? normalized.scope ?? null;
  const entityId = data?.sourceId ?? normalized.entityId ?? null;
  return {
    scope,
    entityId,
    viewMode: normalized.viewMode,
    orient: normalized.orient,
    activeView: normalized.activeView,
    anim: normalized.anim,
    vStyle: normalized.vStyle,
    hStyle: normalized.hStyle,
    pag: normalized.pag,
    perPage: normalized.perPage,
    autoplayPxPerSec: normalized.autoplayPxPerSec,
    autoplayLoop: normalized.autoplayLoop,
    showImages: normalized.showImages,
    animRevealMinRatio: normalized.animRevealMinRatio,
    renderer: normalized.renderer,
    perCol: normalized.perCol,
    numColumns: normalized.numColumns,
    columnChunkMode: normalized.columnChunkMode,
    cardWidthPx: normalized.cardWidthPx,
    gapPx: normalized.gapPx,
    showArrows: normalized.showArrows,
    heightPx: normalized.heightPx,
    timelineWidthPx: normalized.timelineWidthPx,
    timelineWidthPct: normalized.timelineWidthPct,
    timelinePreviewWidthUnit: normalized.timelinePreviewWidthUnit,
    timelineShowPlaybackControls: normalized.timelineShowPlaybackControls,
  };
}
