import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  Calendar,
  CalendarClock,
  Columns2,
  FileText,
  GitBranch,
  Heading2,
  BetweenHorizontalEnd,
  ImageIcon,
  Images,
  LayoutPanelLeft,
  LayoutTemplate,
  List,
  MapPin,
  Megaphone,
  Minus,
  MoveVertical,
  Quote,
  ScrollText,
  Sparkles,
  SplitSquareVertical,
  Table2,
  User,
  Users,
} from "lucide-react";
import type { StoryAddBlockPresetId } from "@/lib/admin/story-creator/story-block-presets";

const STORY_ADD_BLOCK_PRESET_ICONS = {
  text_paragraph: AlignLeft,
  text_heading: Heading2,
  text_list: List,
  text_verse: ScrollText,
  text_quote: Quote,
  data_table: Table2,
  media_default: ImageIcon,
  media_wrapped: LayoutPanelLeft,
  embed_gallery: Images,
  embed_timeline: CalendarClock,
  embed_map: MapPin,
  embed_person: User,
  embed_family: Users,
  embed_event: Calendar,
  embed_tree: GitBranch,
  embed_document: FileText,
  layout_columns: Columns2,
  layout_split: SplitSquareVertical,
  layout_container: LayoutTemplate,
  layout_callout: Megaphone,
  layout_hero: Sparkles,
  layout_divider: Minus,
  layout_divider_ornamental: Sparkles,
  layout_section_break: BetweenHorizontalEnd,
  layout_spacer: MoveVertical,
} as const satisfies Record<StoryAddBlockPresetId, LucideIcon>;

/** Lucide icon for Add block / placement preset rows. */
export function storyAddBlockPresetLucideIcon(id: StoryAddBlockPresetId): LucideIcon {
  return STORY_ADD_BLOCK_PRESET_ICONS[id];
}
