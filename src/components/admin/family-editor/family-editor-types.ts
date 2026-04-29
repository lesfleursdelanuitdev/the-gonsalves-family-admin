export type FamilyMemberAddStep = "existing" | "create";

/** Partner slot row (husband / wife) in the family editor. */
export type FamilyEditPartner = {
  id: string;
  xref: string | null;
  fullName: string | null;
  sex: string | null;
} | null;

/** `familyChildren` row shape used by the children tab. */
export type FamilyEditChildRow = {
  child: {
    id: string;
    xref: string | null;
    fullName: string | null;
    sex?: string | null;
    birthYear?: number | null;
  };
};

/** Note junction row on the family detail payload. */
export type FamilyEditNoteJoin = { note: Record<string, unknown> };

/** Media junction row on the family detail payload. */
export type FamilyEditMediaJoin = { media: Record<string, unknown> };

/** Source citation row on the family detail payload. */
export type FamilyEditSourceJoin = {
  source: Record<string, unknown>;
  page: string | null;
  quality: number | null;
  citationText: string | null;
};
