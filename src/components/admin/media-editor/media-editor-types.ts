/** Shared types for {@link MediaEditorForm} and tab panels. */

export interface MediaEditorInitial {
  id: string;
  xref?: string | null;
  title?: string | null;
  description?: string | null;
  fileRef?: string | null;
  form?: string | null;
  appTags?: Array<{ id: string; tag: { id: string; name: string; color: string | null } }>;
  albumLinks?: Array<{ id: string; album: { id: string; name: string } }>;
  individualMedia?: Array<{
    id: string;
    individual: { id: string; fullName: string | null; xref: string | null };
  }>;
  familyMedia?: Array<{
    id: string;
    family: {
      id: string;
      xref: string | null;
      husband: { id: string; fullName: string | null } | null;
      wife: { id: string; fullName: string | null } | null;
    };
  }>;
  eventMedia?: Array<{
    id: string;
    event: { id: string; eventType: string; customType: string | null };
  }>;
  placeLinks?: Array<{
    id: string;
    place: {
      id: string;
      original: string;
      name: string | null;
      county: string | null;
      state: string | null;
      country: string | null;
    };
  }>;
  dateLinks?: Array<{
    id: string;
    date: {
      id: string;
      original: string | null;
      dateType: string;
      year: number | null;
      month: number | null;
      day: number | null;
      endYear: number | null;
      endMonth: number | null;
      endDay: number | null;
    };
  }>;
}

export type MediaEditorTab =
  | "file"
  | "individuals"
  | "families"
  | "events"
  | "places"
  | "dates"
  | "organisation";

export type StagedTag = { tagId: string; linkId?: string; name: string; color: string | null };
export type StagedAlbum = { albumId: string; linkId?: string; name: string };
export type StagedIndividualMedia = { individualId: string; linkId?: string; label: string };
export type StagedFamilyMedia = { familyId: string; linkId?: string; label: string };
export type StagedEventMedia = { eventId: string; linkId?: string; label: string };

export type StagedPlaceLink = {
  key: string;
  linkId?: string;
  placeId?: string;
  label: string;
  /** Create mode: applied after the media row exists. */
  pendingPlace?: Record<string, unknown>;
};

export type StagedDateLink = {
  key: string;
  linkId?: string;
  dateId?: string;
  label: string;
  pendingDate?: Record<string, unknown>;
};

/** Narrow row shape returned by some media junction POST bodies. */
export type IndividualSearchRow = {
  id: string;
  xref: string | null;
  fullName: string | null;
};

export type FamilySearchRow = {
  id: string;
  xref: string | null;
  husband: { id: string; fullName: string | null } | null;
  wife: { id: string; fullName: string | null } | null;
};
