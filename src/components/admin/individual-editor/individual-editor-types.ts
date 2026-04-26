export type IndividualEditorTab =
  | "identity"
  | "names"
  | "events"
  | "spouse"
  | "child"
  | "notes"
  | "media"
  | "sources";

/** Note junction row on the individual detail payload. */
export type IndividualEditNoteJoin = { note: Record<string, unknown> };

/** Media junction row on the individual detail payload. */
export type IndividualEditMediaJoin = { media: Record<string, unknown> };

/** Source citation row on the individual detail payload. */
export type IndividualEditSourceJoin = {
  source: Record<string, unknown>;
  page: string | null;
  quality: number | null;
  citationText: string | null;
};
