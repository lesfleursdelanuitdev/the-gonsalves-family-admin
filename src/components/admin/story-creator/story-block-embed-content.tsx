"use client";

import type { StoryEmbedBlock } from "@/lib/admin/story-creator/story-types";
import {
  DocumentEmbed,
  EventEmbed,
  FamilyGroupEmbed,
  GalleryEmbed,
  GraphEmbed,
  MapEmbed,
  PersonSpotlightEmbed,
  TimelineEmbed,
  TreeEmbed,
  UnknownEmbed,
  type EmbedBlockContentVariant,
} from "@/components/admin/story-creator/embeds";

export type { EmbedBlockContentVariant } from "@/components/admin/story-creator/embeds";

/**
 * Thin dispatcher that keeps the stored StoryEmbedBlock model generic while letting each embed kind
 * own its rendering semantics.
 */
export function EmbedBlockContentRenderer({
  block,
  variant,
  compact,
  onConfigure,
  onPatchBlock,
}: {
  block: StoryEmbedBlock;
  variant: EmbedBlockContentVariant;
  compact?: boolean;
  onConfigure?: () => void;
  onPatchBlock?: (patch: Partial<StoryEmbedBlock>) => void;
}) {
  const props = { block, variant, compact, onConfigure, onPatchBlock };

  switch (block.embedKind) {
    case "document":
      return <DocumentEmbed {...props} />;
    case "timeline":
      return <TimelineEmbed {...props} />;
    case "gallery":
      return <GalleryEmbed {...props} />;
    case "tree":
      return <TreeEmbed {...props} />;
    case "map":
      return <MapEmbed {...props} />;
    case "personSpotlight":
      return <PersonSpotlightEmbed {...props} />;
    case "familyGroup":
      return <FamilyGroupEmbed {...props} />;
    case "event":
      return <EventEmbed {...props} />;
    case "graph":
      return <GraphEmbed {...props} />;
    default:
      return <UnknownEmbed {...props} />;
  }
}
