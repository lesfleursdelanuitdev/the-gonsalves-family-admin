export type IndSearchHit = {
  id: string;
  xref: string;
  fullName: string | null;
  sex: string | null;
  birthDateDisplay?: string | null;
  birthYear?: number | null;
};

export type FamilyHit = {
  id: string;
  xref: string;
  husband: { id: string; fullName: string | null; sex?: string | null; gender?: string | null } | null;
  wife: { id: string; fullName: string | null; sex?: string | null; gender?: string | null } | null;
};

export const STABLE_EMPTY_SEARCH_HITS: IndSearchHit[] = [];
export const STABLE_EMPTY_FAMILY_HITS: FamilyHit[] = [];

export type ChildFamilyParentPickLabels = {
  husband: string;
  wife: string;
  husbandSex?: string;
  wifeSex?: string;
  husbandId?: string;
  wifeId?: string;
};
