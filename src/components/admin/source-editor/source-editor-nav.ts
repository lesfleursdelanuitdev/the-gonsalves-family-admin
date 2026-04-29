import { BookOpen, FileText, Hash, Landmark, Link2 } from "lucide-react";
import type { AdminEditorNavItem } from "@/components/admin/editor-shell/AdminEditorSidebarNav";

export type SourceEditorSectionId =
  | "source-main"
  | "source-repository"
  | "source-citations"
  | "source-record";

export const SOURCE_EDITOR_NAV: readonly AdminEditorNavItem[] = [
  {
    id: "source-main",
    label: "Publication",
    description: "Title, author, and how this source is cited.",
    icon: FileText,
  },
  {
    id: "source-repository",
    label: "Repository",
    description: "Archive or library reference (GEDCOM REPO pointer).",
    icon: Landmark,
  },
  {
    id: "source-citations",
    label: "Linked citations",
    description: "People, families, and events that cite this source.",
    icon: Link2,
  },
  {
    id: "source-record",
    label: "Record ids",
    description: "Stable identifiers from import and the database.",
    icon: Hash,
  },
] as const;

/** Icon for page chrome (list / header) where a single icon represents “sources”. */
export const SOURCE_EDITOR_PAGE_ICON = BookOpen;
